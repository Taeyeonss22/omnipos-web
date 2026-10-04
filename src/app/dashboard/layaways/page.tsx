'use client';

import { useState, useEffect } from 'react';
import { PackageOpen, Search, DollarSign } from 'lucide-react';

export default function LayawaysPage() {
  const [layaways, setLayaways] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchLayaways();
  }, []);

  const fetchLayaways = async () => {
    try {
      const res = await fetch('/api/sales');
      if (res.ok) {
        const data = await res.json();
        // Filtramos solo los apartados
        setLayaways(Array.isArray(data) ? data.filter(s => s.status === 'LAYAWAY') : []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayment = async (sale: any) => {
    const totalPaid = sale.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
    const remaining = sale.total - totalPaid;
    
    if (remaining <= 0) {
      return alert('Este apartado ya está liquidado.');
    }

    const amountStr = prompt(`Saldo restante: $${remaining.toFixed(2)}\n¿Cuánto va a abonar el cliente en EFECTIVO?`);
    if (!amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > remaining) {
      return alert('Monto inválido.');
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method: 'CASH' })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert('Abono registrado exitosamente en tu corte actual.');
        fetchLayaways();
      } else {
        alert('Error registrando abono: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Error de red');
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = layaways.filter(s => 
    s.folio.toLowerCase().includes(search.toLowerCase()) || 
    (s.customer?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Apartados Activos</h1>
          <p className="text-sm text-gray-500">Registra los abonos de los clientes. El dinero entrará directo a tu corte de caja actual.</p>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por folio o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-3">Folio</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Abonado</th>
                <th className="px-6 py-3">Resta</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10">Cargando apartados...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10">No hay apartados activos.</td></tr>
              ) : (
                filtered.map((sale) => {
                  const totalPaid = sale.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
                  const remaining = sale.total - totalPaid;
                  
                  return (
                    <tr key={sale.id} className="bg-white hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                        <PackageOpen className="h-4 w-4 text-orange-600" />
                        {sale.folio}
                      </td>
                      <td className="px-6 py-4">{sale.customer?.name || 'Cliente de Mostrador'}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">${sale.total.toFixed(2)}</td>
                      <td className="px-6 py-4 text-green-600">${totalPaid.toFixed(2)}</td>
                      <td className="px-6 py-4 text-orange-600 font-bold">${remaining.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          disabled={isProcessing || remaining <= 0}
                          onClick={() => handleAddPayment(sale)}
                          className="inline-flex items-center gap-1 rounded bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                        >
                          <DollarSign className="h-4 w-4" />
                          Registrar Abono
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
