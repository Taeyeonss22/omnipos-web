'use client';

import { useState, useEffect } from 'react';
import { Receipt, Search, Printer, Eye } from 'lucide-react';
import { useSession } from 'next-auth/react';
import TicketPreviewModal from '@/components/pos/TicketPreviewModal';

export default function SalesHistoryPage() {
  const { data: session } = useSession();
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [previewTicket, setPreviewTicket] = useState<any>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const res = await fetch('/api/sales');
      if (res.ok) {
        const data = await res.json();
        setSales(data);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReprint = async (sale: any) => {
    try {
      const localSettingsRaw = localStorage.getItem('printerSettings');
      let localSettings = { header: 'CRIMEN SANTO', footer: '¡Gracias por su compra!', width: '80mm', printerName: 'printer:impresora_termica' };
      if (localSettingsRaw) {
        localSettings = JSON.parse(localSettingsRaw);
      }

      await fetch('http://127.0.0.1:8080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: `REIMPRESION-${sale.folio}`,
          branchName: localSettings.header,
          date: sale.createdAt,
          cashier: sale.user?.firstName || 'Cajero',
          items: sale.items.map((i: any) => ({ quantity: i.quantity, product: i.product.name, subtotal: i.subtotal })),
          subtotal: sale.subtotal,
          tax: sale.tax,
          total: sale.total,
          method: sale.payments?.[0]?.method || 'CASH',
          footer: localSettings.footer,
          width: localSettings.width,
          printerName: localSettings.printerName
        })
      });
      alert('Ticket enviado a impresión local.');
    } catch (error) {
      console.error(error);
      alert('No se pudo contactar a la impresora. Asegúrate de que Print Bridge esté corriendo.');
    }
  };

  const filteredSales = sales.filter(s => s.folio.toLowerCase().includes(search.toLowerCase()) || s.total.toString().includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Historial de Ventas</h1>
          <p className="text-sm text-gray-500">Consulta todos los tickets emitidos y reimprime comprobantes.</p>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por folio o monto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-3">Folio</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Cajero</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10">Cargando ventas...</td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10">No se encontraron ventas.</td></tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="bg-white hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-blue-600" />
                      {sale.folio}
                    </td>
                    <td className="px-6 py-4">{new Date(sale.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4">{sale.user?.firstName} {sale.user?.lastName}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${sale.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">${sale.total.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleReprint(sale)}
                        className="inline-flex items-center gap-1 rounded bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200"
                      >
                        <Printer className="h-4 w-4" />
                        Reimprimir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
