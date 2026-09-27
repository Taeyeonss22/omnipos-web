'use client';

import { useState, useEffect } from 'react';
import { Receipt, Calendar, Printer } from 'lucide-react';

export default function ReportsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintZ = async (session: any) => {
    try {
      const localSettingsRaw = localStorage.getItem('printerSettings');
      let localSettings = { header: 'Ferremix', footer: '', width: '80mm', printerName: 'printer:impresora_termica' };
      if (localSettingsRaw) {
        localSettings = JSON.parse(localSettingsRaw);
      }

      await fetch('http://localhost:8080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: `CORTE-Z-${session.id.slice(0, 6).toUpperCase()}`,
          branchName: localSettings.header,
          date: session.closingTime || new Date().toISOString(),
          cashier: session.userName,
          items: [
            { quantity: 1, product: 'Fondo Inicial', subtotal: session.openingBalance },
            { quantity: 1, product: 'Ventas Totales', subtotal: session.totalSales }
          ],
          subtotal: session.totalSales,
          tax: 0,
          total: session.closingBalance || 0,
          method: 'Z-REPORT',
          footer: 'Corte Z Generado Exitosamente',
          width: localSettings.width,
          printerName: localSettings.printerName
        })
      });
      alert(`Imprimiendo Corte Z para la caja ${session.register}...`);
    } catch (err) {
      console.warn('Print bridge no disponible:', err);
      alert('Error: No se pudo contactar a la impresora local (Print Bridge).');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reportes y Cortes de Caja</h1>
          <p className="text-sm text-gray-500">Historial de turnos cerrados (Cortes Z) e indicadores de ventas.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="rounded-lg bg-white p-6 shadow border-t-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-500">Turnos Cerrados (Histórico)</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{sessions.length}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow border-t-4 border-green-500">
          <h3 className="text-sm font-medium text-gray-500">Ventas Totales (Turnos mostrados)</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">
            ${sessions.reduce((acc, s) => acc + s.totalSales, 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow border-t-4 border-red-500">
          <h3 className="text-sm font-medium text-gray-500">Diferencias (Faltantes/Sobrantes)</h3>
          <p className="mt-2 text-3xl font-bold text-red-600">
            ${sessions.reduce((acc, s) => acc + s.difference, 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow overflow-hidden">
        <div className="border-b p-4 bg-gray-50 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold text-gray-700">Historial de Cortes Z</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-100 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-3">Caja / Cajero</th>
                <th className="px-6 py-3">Fecha y Hora (Cierre)</th>
                <th className="px-6 py-3 text-right">Fondo Inicial</th>
                <th className="px-6 py-3 text-right">Ventas</th>
                <th className="px-6 py-3 text-right">Declarado</th>
                <th className="px-6 py-3 text-right">Diferencia</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10">Cargando...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10">No hay cortes de caja registrados.</td></tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="bg-white hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{session.register}</div>
                      <div className="text-xs text-gray-500">Cajero: {session.cashier}</div>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(session.closedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">${session.openingBalance.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-medium text-green-600">
                      ${session.totalSales.toFixed(2)} <span className="text-xs text-gray-400">({session.salesCount} tks)</span>
                    </td>
                    <td className="px-6 py-4 text-right">${session.closingBalance.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${session.difference < 0 ? 'text-red-600' : session.difference > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                        ${session.difference.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handlePrintZ(session)}
                        className="text-gray-500 hover:text-gray-900 flex items-center justify-center gap-1 mx-auto"
                      >
                        <Printer className="h-4 w-4" /> Re-imprimir
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
