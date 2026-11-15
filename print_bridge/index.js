const express = require('express');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8080;

// Función para enviar bytes RAW a cualquier impresora física de Windows vía Spooler (sin drivers C++ externos)
function sendRawToPrinter(buffer, targetPrinterName) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `ticket_${Date.now()}.bin`);
    fs.writeFileSync(tempFile, buffer);

    // Si es IP de red (ej. tcp://192.168.1.100:9100)
    if (targetPrinterName && targetPrinterName.startsWith('tcp://')) {
      const parts = targetPrinterName.replace('tcp://', '').split(':');
      const host = parts[0];
      const port = parseInt(parts[1] || '9100', 10);
      const net = require('net');
      const client = new net.Socket();
      client.connect(port, host, () => {
        client.write(buffer);
        client.end();
        try { fs.unlinkSync(tempFile); } catch (e) {}
        resolve('Ticket enviado por red TCP');
      });
      client.on('error', (err) => {
        try { fs.unlinkSync(tempFile); } catch (e) {}
        reject(err);
      });
      return;
    }

    // Limpiar printerName si viene con prefijo 'printer:' o valor por defecto
    let cleanPrinterName = targetPrinterName ? targetPrinterName.replace(/^printer:/i, '').trim() : '';
    if (cleanPrinterName.toLowerCase() === 'impresora_termica') cleanPrinterName = '';

    const psScript = `
$ErrorActionPreference = 'Stop'
$printerName = "${cleanPrinterName}"

if (-not $printerName) {
    $defaultPrinter = Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -ExpandProperty Name -First 1
    if (-not $defaultPrinter) {
        $defaultPrinter = Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name -First 1
    }
    $printerName = $defaultPrinter
}

if (-not $printerName) {
    throw "No se encontro ninguna impresora instalada en Windows."
}

Write-Host "Enviando ticket a impresora: $printerName"

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytes(string szPrinterName, byte[] pBytes) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Ticket OmniPOS";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                    Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                    int dwWritten = 0;
                    WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
            return true;
        }
        return false;
    }
}
"@

$rawBytes = [System.IO.File]::ReadAllBytes('${tempFile.replace(/\\/g, '\\\\')}')
$ok = [RawPrinterHelper]::SendBytes($printerName, $rawBytes)
if (-not $ok) {
    throw "No se pudo imprimir en $printerName. Verifica que este encendida y conectada por USB."
}
Write-Host "Ticket impreso correctamente en $printerName."
`;

    const psFile = path.join(os.tmpdir(), `print_${Date.now()}.ps1`);
    fs.writeFileSync(psFile, psScript, 'utf8');

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, (error, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      try { fs.unlinkSync(psFile); } catch (e) {}

      if (error) {
        console.error('Error en Spooler de Windows:', stderr || stdout || error.message);
        reject(new Error(stderr || stdout || error.message));
      } else {
        console.log(stdout.trim());
        resolve(stdout.trim());
      }
    });
  });
}

app.get('/printers', (req, res) => {
  exec('powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PortName | ConvertTo-Json"', (err, stdout) => {
    if (err) return res.json([]);
    try {
      const parsed = JSON.parse(stdout);
      res.json(Array.isArray(parsed) ? parsed : [parsed]);
    } catch {
      res.json([]);
    }
  });
});

app.post('/print', async (req, res) => {
  try {
    const { folio, branchName, date, items, subtotal, tax, total, method, cashier, footer, width, printerName } = req.body;

    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: {
        execute: async (buffer) => {
          return await sendRawToPrinter(buffer, printerName);
        },
        isPrinterConnected: async () => true
      },
      characterSet: 'PC858_EURO',
      removeSpecialCharacters: false,
      width: width === '58mm' ? 32 : 48
    });

    printer.alignCenter();
    try {
      const logoPath = path.join(__dirname, 'logo.png');
      if (fs.existsSync(logoPath)) {
        await printer.printImage(logoPath);
      }
    } catch (err) {
      console.warn('No se pudo cargar el logo:', err.message);
    }

    printer.println(branchName || 'OmniPOS');
    printer.drawLine();
    
    printer.alignLeft();
    printer.println(`Folio: ${folio}`);
    printer.println(`Fecha: ${new Date(date).toLocaleString()}`);
    printer.println(`Cajero: ${cashier}`);
    printer.drawLine();

    // Productos
    printer.tableCustom([
      { text: 'Cant', align: 'LEFT', width: 0.15 },
      { text: 'Desc', align: 'LEFT', width: 0.5 },
      { text: 'Total', align: 'RIGHT', width: 0.25 }
    ]);
    
    if (Array.isArray(items)) {
      items.forEach(item => {
        const prodName = (item.product || 'Artículo').substring(0, width === '58mm' ? 12 : 20);
        printer.tableCustom([
          { text: item.quantity.toString(), align: 'LEFT', width: 0.15 },
          { text: prodName, align: 'LEFT', width: 0.5 },
          { text: `$${Number(item.subtotal || 0).toFixed(2)}`, align: 'RIGHT', width: 0.25 }
        ]);
      });
    }

    printer.drawLine();
    printer.alignRight();
    printer.println(`Total: $${Number(total || 0).toFixed(2)}`);
    printer.println(`Pago: ${method || 'EFECTIVO'}`);
    
    printer.drawLine();
    printer.alignCenter();
    if (footer) printer.println(footer);
    
    // Imprimir Código de Barras si no es offline
    if (folio && !String(folio).includes('OFFLINE')) {
      try {
        printer.newLine();
        printer.printBarcode(folio);
      } catch (err) {
        // Algunas impresoras pequeñas de 58mm no soportan códigos de barras por comando estándar
      }
    }
    
    // Espacio para corte
    printer.println(' ');
    printer.println(' ');
    printer.println(' ');
    printer.println(' ');

    // Comandos de corte comunes
    printer.append(Buffer.from([0x1D, 0x56, 0x41, 0x00])); // GS V A 0 (Partial cut)
    printer.append(Buffer.from([0x1B, 0x69])); // ESC i (Full cut)

    // Enviar a la impresora
    await printer.execute();
    
    console.log(`[OK] Ticket ${folio} impreso exitosamente.`);
    res.status(200).json({ success: true, message: 'Impresión exitosa' });
  } catch (error) {
    console.error('Error al imprimir:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🖨️  Print Bridge escuchando en http://localhost:${PORT}`);
  console.log(`➡️  Envíe tickets al endpoint POST /print`);
});
