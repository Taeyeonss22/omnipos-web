'use client';

import { useState, useEffect } from 'react';
import { Truck, Plus, ArrowRight, CheckCircle, Package } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function TransfersPage() {
  const { data: session } = useSession();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [targetBranchId, setTargetBranchId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [transferItems, setTransferItems] = useState<{productId: string, productName: string, quantity: number}[]>([]);

  useEffect(() => {
    fetchTransfers();
    fetchBranchesAndProducts();
  }, []);

  const fetchBranchesAndProducts = async () => {
    const [bRes, pRes] = await Promise.all([
      fetch('/api/branches'),
      fetch('/api/products')
    ]);
    setBranches(await bRes.json());
    setProducts(await pRes.json());
  };

  const fetchTransfers = async () => {
    try {
      const res = await fetch('/api/transfers');
      const data = await res.json();
      setTransfers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product || !quantity || parseInt(quantity) <= 0) return;

    setTransferItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: parseInt(quantity)
    }]);
    setSelectedProductId('');
    setQuantity('1');
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranchId || transferItems.length === 0) {
      alert('Debes seleccionar una sucursal destino y al menos un artículo.');
      return;
    }

    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetBranchId,
          items: transferItems.map(i => ({ productId: i.productId, quantity: i.quantity }))
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setTargetBranchId('');
        setTransferItems([]);
        fetchTransfers();
        alert('Solicitud de traspaso creada exitosamente.');
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAction = async (id: string, action: string) => {
    if (!confirm(`¿Estás seguro de marcar este traspaso como ${action}?`)) return;
    
    try {
      const res = await fetch('/api/transfers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        fetchTransfers();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: any = {
      PENDING: <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">Pendiente</span>,
      APPROVED: <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Aprobado</span>,
      SHIPPED: <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">Enviado</span>,
      RECEIVED: <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Recibido</span>,
    };
    return badges[status] || <span>{status}</span>;
  };

  return (
    <div className="space-y-6 relative">
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-[600px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Solicitar Traspaso</h2>
            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Sucursal Destino</label>
                <select required value={targetBranchId} onChange={e => setTargetBranchId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black">
                  <option value="">Selecciona una sucursal...</option>
                  {branches.filter(b => b.id !== (session?.user as any)?.branchId).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="border p-4 rounded bg-gray-50">
                <h3 className="font-semibold text-gray-700 mb-2">Agregar Artículos</h3>
                <div className="flex gap-2">
                  <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="flex-1 rounded-md border border-gray-300 p-2 text-black">
                    <option value="">Selecciona producto...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.inventories?.[0]?.quantity || 0})</option>
                    ))}
                  </select>
                  <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-24 rounded-md border border-gray-300 p-2 text-black" placeholder="Cant." />
                  <button type="button" onClick={handleAddItem} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-medium hover:bg-gray-300">Añadir</button>
                </div>
                
                {transferItems.length > 0 && (
                  <ul className="mt-4 space-y-1 divide-y">
                    {transferItems.map((item, idx) => (
                      <li key={idx} className="py-2 text-sm flex justify-between">
                        <span>{item.quantity}x {item.productName}</span>
                        <button type="button" onClick={() => setTransferItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:underline">Eliminar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Crear Solicitud</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Traspasos de Inventario</h1>
          <p className="text-sm text-gray-500">Gestiona los movimientos de mercancía entre sucursales.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Nueva Solicitud
        </button>
      </div>

      <div className="rounded-lg bg-white shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-3">Folio</th>
                <th className="px-6 py-3">Ruta</th>
                <th className="px-6 py-3">Artículos</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10">Cargando...</td></tr>
              ) : transfers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10">No hay traspasos registrados.</td></tr>
              ) : (
                transfers.map((transfer) => {
                  const isIncoming = transfer.targetBranchId === (session?.user as any)?.branchId;
                  const isOutgoing = transfer.sourceBranchId === (session?.user as any)?.branchId;

                  return (
                    <tr key={transfer.id} className="bg-white hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{transfer.folio}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{transfer.sourceBranch.name}</span>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold text-gray-900">{transfer.targetBranch.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {transfer.items.reduce((acc: number, item: any) => acc + item.quantity, 0)} pzas
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(transfer.status)}</td>
                      <td className="px-6 py-4">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-center">
                        {transfer.status === 'PENDING' && isOutgoing && (
                          <button onClick={() => handleAction(transfer.id, 'APPROVE')} className="text-blue-600 hover:underline">Aprobar</button>
                        )}
                        {transfer.status === 'APPROVED' && isOutgoing && (
                          <button onClick={() => handleAction(transfer.id, 'SHIP')} className="text-purple-600 hover:underline font-medium">Enviar Mercancía</button>
                        )}
                        {transfer.status === 'SHIPPED' && isIncoming && (
                          <button onClick={() => handleAction(transfer.id, 'RECEIVE')} className="text-green-600 hover:underline font-bold">Recibir</button>
                        )}
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
