'use client';

import { useState, useEffect } from 'react';
import { PackageOpen, Search, DollarSign, Calendar, Phone, Eye, RefreshCw } from 'lucide-react';

export default function LayawaysPage() {
  const [layaways, setLayaways] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null);

  useEffect(() => {
    fetchLayaways();
  }, []);

  const fetchLayaways = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sales?status=LAYAWAY');
      if (res.ok) {
        const data = await res.json();
        setLayaways(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error al cargar apartados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayment = async (sale: any) => {
    const totalPaid = sale.payments?.reduce((acc: number, p: any) => acc + Number(p.amount), 0) || 0;
    const remaining = sale.total - totalPaid;
    
    if (remaining <= 0) {
      return alert('Este apartado ya está liquidado.');
    }

    const amountStr = prompt(`Saldo restante por pagar: $${remaining.toFixed(2)}\n\nIngresa el monto a abonar en EFECTIVO:`, remaining.toFixed(2));
    if (!amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > remaining) {
      return alert('Monto inválido. Debe ser un número mayor a 0 y no mayor al saldo restante.');
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method: 'CASH' })
      });
      
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const isCompleted = (totalPaid + amount) >= sale.total;
        alert(
          isCompleted 
            ? `¡Apartado LIQUIDADO con éxito!\nSe abonaron $${amount.toFixed(2)} y la prenda/producto ya puede ser entregada.`
            : `Abono de $${amount.toFixed(2)} registrado correctamente.\nNuevo saldo restante: $${(remaining - amount).toFixed(2)}`
        );
        fetchLayaways();
      } else {
        alert('Error al registrar abono: ' + (data.error || data.details || 'Error en el servidor'));
      }
    } catch (error: any) {
      console.error(error);
      alert('Error de red al registrar abono: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = layaways.filter(s => 
    s.folio.toLowerCase().includes(search.toLowerCase()) || 
    (s.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.customer?.phone || '').includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <PackageOpen className="h-7 w-7 text-orange-600" />
            Control de Apartados Activos
          </h1>
          <p className="text-sm text-gray-500">
            Consulta los apartados pendientes de entrega, historial de abonos y saldo restante.
          </p>
        </div>
        <button
          onClick={fetchLayaways}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por folio, cliente o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:block">
            {filtered.length} apartados encontrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-3.5">Folio / Fecha</th>
                <th className="px-6 py-3.5">Cliente</th>
                <th className="px-6 py-3.5">Prendas / Artículos</th>
                <th className="px-6 py-3.5 text-right">Total</th>
                <th className="px-6 py-3.5 text-right">Abonado</th>
                <th className="px-6 py-3.5 text-right">Resta</th>
                <th className="px-6 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Cargando apartados...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <PackageOpen className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                    No hay apartados activos pendientes por liquidar.
                  </td>
                </tr>
              ) : (
                filtered.map((sale) => {
                  const totalPaid = sale.payments?.reduce((acc: number, p: any) => acc + Number(p.amount), 0) || 0;
                  const remaining = Math.max(0, sale.total - totalPaid);
                  
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          <PackageOpen className="h-4 w-4 text-orange-600" />
                          {sale.folio}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(sale.createdAt).toLocaleDateString()} {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">{sale.customer?.name || 'Cliente sin registrar'}</div>
                        {sale.customer?.phone && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 text-gray-400" /> {sale.customer.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-xs text-gray-700 truncate" title={sale.items?.map((i: any) => `${i.quantity}x ${i.product?.name}`).join(', ')}>
                          {sale.items && sale.items.length > 0 ? (
                            sale.items.map((i: any) => `${i.quantity}x ${i.product?.name}`).join(', ')
                          ) : (
                            <span className="text-gray-400">Sin detalle</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">${sale.total.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-emerald-600">${totalPaid.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-orange-600 text-base">${remaining.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            disabled={isProcessing || remaining <= 0}
                            onClick={() => handleAddPayment(sale)}
                            className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition-colors"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                            Abonar
                          </button>
                          <button
                            onClick={() => setSelectedSaleDetail(sale)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle de Apartado */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-gray-900">
                Detalle del Apartado: {selectedSaleDetail.folio}
              </h3>
              <button onClick={() => setSelectedSaleDetail(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            
            <div className="text-sm space-y-1">
              <p><span className="font-semibold text-gray-600">Cliente:</span> {selectedSaleDetail.customer?.name || 'Mostrador'}</p>
              {selectedSaleDetail.customer?.phone && <p><span className="font-semibold text-gray-600">Teléfono:</span> {selectedSaleDetail.customer.phone}</p>}
              <p><span className="font-semibold text-gray-600">Fecha de creación:</span> {new Date(selectedSaleDetail.createdAt).toLocaleString()}</p>
              <p><span className="font-semibold text-gray-600">Cajero que apartó:</span> {selectedSaleDetail.user?.firstName} {selectedSaleDetail.user?.lastName}</p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Artículos apartados</h4>
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                {(selectedSaleDetail.items || []).map((item: any) => (
                  <div key={item.id} className="p-2.5 flex justify-between text-sm">
                    <span>{item.quantity}x {item.product?.name}</span>
                    <span className="font-semibold">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Historial de Pagos / Abonos</h4>
              <div className="border rounded-lg divide-y max-h-32 overflow-y-auto">
                {(selectedSaleDetail.payments || []).map((p: any, idx: number) => (
                  <div key={p.id || idx} className="p-2 flex justify-between text-xs">
                    <span>{idx === 0 ? 'Anticipo inicial' : 'Abono'} ({p.method}) - {new Date(p.createdAt).toLocaleDateString()}</span>
                    <span className="font-bold text-emerald-600">+${p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center text-sm">
              <span className="font-medium text-gray-600">Saldo Restante:</span>
              <span className="text-xl font-black text-orange-600">
                ${Math.max(0, selectedSaleDetail.total - (selectedSaleDetail.payments?.reduce((acc: number, p: any) => acc + Number(p.amount), 0) || 0)).toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => setSelectedSaleDetail(null)}
              className="w-full py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-black"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
