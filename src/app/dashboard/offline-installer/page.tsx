'use client';

import { useState, useEffect } from 'react';
import {
  HardDriveDownload,
  Wifi,
  WifiOff,
  Download,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  Store,
  Layers,
  Users,
  Package,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Monitor,
  CloudUpload,
} from 'lucide-react';

export default function OfflineInstallerPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [catalogStats, setCatalogStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [resBranches, resExport] = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/offline/export'),
      ]);

      if (resBranches.ok) {
        const branchesData = await resBranches.json();
        setBranches(branchesData);
        if (branchesData.length > 0) {
          setSelectedBranch(branchesData[0].id);
        }
      }

      if (resExport.ok) {
        const exportData = await resExport.json();
        setCatalogStats(exportData.counts);
      }
    } catch (error) {
      console.error('Error cargando datos para el instalador offline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleDownloadInstaller = (type: 'windows' | 'mac') => {
    window.location.href = `/api/offline/installer?type=${type}`;
  };

  const handleDownloadCatalog = () => {
    window.location.href = `/api/offline/export?download=1&branchId=${encodeURIComponent(selectedBranch)}`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Encabezado Principal */}
      <div className="rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-blue-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              <WifiOff className="h-3.5 w-3.5" /> MODO SUCURSAL SIN INTERNET (1-2 SEMANAS)
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Centro de Instalación Offline
            </h1>
            <p className="text-gray-300 text-sm leading-relaxed">
              Configura la computadora de tu nueva sucursal mientras la tienes conectada a los datos de tu celular.
              El sistema quedará instalado localmente para <strong>abrir turnos, cobrar, emitir tickets y hacer cortes Z sin necesidad de internet</strong>.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15">
            <span className="text-xs uppercase tracking-wider text-gray-300 font-bold">Estado del Catálogo en la Nube:</span>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <RefreshCw className="h-4 w-4 animate-spin" /> Verificando...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block">Productos:</span>
                  <span className="text-lg font-black text-white">{catalogStats?.products || 0}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Categorías:</span>
                  <span className="text-lg font-black text-white">{catalogStats?.categories || 0}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Cajeros:</span>
                  <span className="text-lg font-black text-white">{catalogStats?.users || 0}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Cajas Registradas:</span>
                  <span className="text-lg font-black text-white">{catalogStats?.cashRegisters || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paso 1: Selección de Sucursal */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Selecciona la Sucursal para este Equipo</h2>
            <p className="text-xs text-gray-500">Los tickets, folios y cortes de caja quedarán asignados a esta sucursal.</p>
          </div>
        </div>

        <div className="max-w-md">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.address ? `(${b.address})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Paso 2: Descarga de Instaladores (1 Clic) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Descarga los Archivos de Instalación en la PC Nueva</h2>
            <p className="text-xs text-gray-500">Descarga estos archivos en la computadora que vas a dejar en la sucursal.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Opción Windows */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border-2 border-emerald-500 flex flex-col justify-between space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-lg">
              Recomendado para PC de Caja
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Monitor className="h-8 w-8 text-emerald-600" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Instalador para Windows</h3>
                  <span className="text-xs text-gray-500 font-medium">Compatible con Windows 10, 11 y 7/8</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Archivo automatizado (<code>.bat</code>) que configura Node.js, crea la base de datos local SQLite y deja el acceso directo en el Escritorio.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <button
                onClick={() => handleDownloadInstaller('windows')}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 px-4 font-bold text-white shadow-md hover:bg-emerald-700 transition-all text-sm"
              >
                <Download className="h-4 w-4" />
                Descargar Instalador Windows (.bat)
              </button>
              <button
                onClick={handleDownloadCatalog}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 py-2.5 px-4 font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-xs"
              >
                <Download className="h-3.5 w-3.5 text-gray-500" />
                Descargar Catálogo Inicial (catalogo_offline.json)
              </button>
            </div>
          </div>

          {/* Opción Mac / Linux */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Terminal className="h-8 w-8 text-gray-700" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Instalador para Mac / Linux</h3>
                  <span className="text-xs text-gray-500 font-medium">Script bash (.sh)</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Script de shell para inicializar el servidor local en macOS o distribuciones de Linux.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <button
                onClick={() => handleDownloadInstaller('mac')}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 px-4 font-bold text-white shadow-md hover:bg-black transition-all text-sm"
              >
                <Download className="h-4 w-4" />
                Descargar Script Mac (.sh)
              </button>
              <button
                onClick={handleDownloadCatalog}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 py-2.5 px-4 font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-xs"
              >
                <Download className="h-3.5 w-3.5 text-gray-500" />
                Descargar Catálogo Inicial (catalogo_offline.json)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Paso 3: Guía Rápida de Instalación */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">¿Cómo se instala en 3 pasos?</h2>
            <p className="text-xs text-gray-500">Sigue estos sencillos pasos en la computadora de la sucursal.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-gray-200 p-5 space-y-3 bg-gray-50">
            <span className="text-xs font-black uppercase text-blue-600 tracking-wider">Paso A (Con datos móviles)</span>
            <h4 className="font-bold text-gray-900 text-base">Descargar en la PC</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              En la computadora de la nueva sucursal, conéctate a los datos de tu celular. Abre esta misma página y dale clic a los dos botones: 
              <strong> Instalador (.bat)</strong> y <strong>Catálogo (.json)</strong>. Guarda ambos en la misma carpeta.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-5 space-y-3 bg-gray-50">
            <span className="text-xs font-black uppercase text-emerald-600 tracking-wider">Paso B (Ejecutar)</span>
            <h4 className="font-bold text-gray-900 text-base">Doble Clic al Instalador</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Dale doble clic al archivo <code>instalar-offline-windows.bat</code>. Se abrirá una ventanita negra que descargará todo automáticamente y creará el acceso directo en el Escritorio.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-5 space-y-3 bg-gray-50">
            <span className="text-xs font-black uppercase text-purple-600 tracking-wider">Paso C (Listo para usar)</span>
            <h4 className="font-bold text-gray-900 text-base">Desconectar Internet</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              ¡Apaga los datos de tu celular! Ahora en el Escritorio dale doble clic a <strong>"Iniciar OmniPOS Offline"</strong> y ya puedes cobrar, escanear y hacer cortes Z sin nada de internet.
            </p>
          </div>
        </div>
      </div>

      {/* Paso 4: Sincronización en 1 Semana */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-base">
            <CloudUpload className="h-5 w-5 text-blue-600" />
            ¿Qué hago en 1 semana cuando llegue el internet?
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            El instalador te dejará en el Escritorio un acceso directo llamado <strong>"Sincronizar a la Nube.bat"</strong>. 
            El día que les pongan el módem o cuando le vuelvas a conectar tus datos 2 minutos, solo le das doble clic a ese archivo y automáticamente todas las ventas acumuladas, cobros y cortes Z se subirán a tu cuenta en la nube sin duplicar nada.
          </p>
        </div>

        <div className="shrink-0">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-sm">
            <CheckCircle2 className="h-4 w-4" /> 100% Automatizado
          </span>
        </div>
      </div>

      {/* Alternativa: Comandos para Desarrollador / Terminal */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-gray-700" />
            <h3 className="font-bold text-gray-900 text-sm">Opción alternativa por Terminal / Git</h3>
          </div>
          <span className="text-xs text-gray-400">Para usuarios avanzados</span>
        </div>

        <div className="relative rounded-lg bg-gray-900 p-4 text-xs font-mono text-gray-200 overflow-x-auto">
          <button
            onClick={() =>
              copyToClipboard(
                'git clone https://github.com/Taeyeonss22/omnipos-web.git && cd omnipos-web && npm install && scripts\\instalar-offline-windows.bat',
                1
              )
            }
            className="absolute top-3 right-3 p-1.5 rounded-md bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
            title="Copiar comando"
          >
            {copiedIndex === 1 ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <code>
            git clone https://github.com/Taeyeonss22/omnipos-web.git<br />
            cd omnipos-web<br />
            npm install<br />
            scripts\instalar-offline-windows.bat
          </code>
        </div>
      </div>
    </div>
  );
}
