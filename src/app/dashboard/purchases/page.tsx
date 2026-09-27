'use client';

import { useState, useEffect } from 'react';
import { PackageOpen, Plus, CheckCircle, Truck, TrendingDown } from 'lucide-react';

export default function PurchasesPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [supplierId, setSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [orderItems, setOrderItems] = useState<{productId: string, productName: string, quantity: number, unitCost: number}[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchSuppliersAndProducts();
  }, []);

  const fetchSuppliersAndProducts = async () => {
    const [sRes, pRes] = await Promise.all([
      fetch('/api/suppliers'),
      fetch('/api/products')
    ]);
    setSuppliers(await sRes.json());
    setProducts(await pRes.json());
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/purchases');
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product || !quantity || parseInt(quantity) <= 0 || !unitCost) return;

    setOrderItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: parseInt(quantity),
      unitCost: parseFloat(unitCost)
    }]);
    setSelectedProductId('');
    setQuantity('1');
    setUnitCost('0');
  };

  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    const product = products.find(p => p.id === id);
    if (product) {
      setUnitCost(product.cost.toString());
    }
  };

  const handleAutoRestock = () => {
    // Buscar todos los productos cuyo stock actual es menor o igual al mínimo
    const lowStockItems = products.filter(p => {
      const stock = p.inventories?.[0]?.quantity || 0;
      const minStock = p.inventories?.[0]?.minStock || 0;
      // Solo tomamos en cuenta los que tienen un mínimo configurado > 0 para evitar pedir cosas descontinuadas
      return minStock > 0 && stock <= minStock;
    });

    if (lowStockItems.length === 0) {
      alert('¡Todo está en orden! No hay productos por debajo de su stock mínimo configurado.');
      return;
    }

    // Llenar el carrito de la orden de compra automáticamente
    const suggestedItems = lowStockItems.map(p => {
      const stock = p.inventories?.[0]?.quantity || 0;
      const minStock = p.inventories?.[0]?.minStock || 0;
      // Sugerimos pedir la cantidad necesaria para llegar al mínimo + un 50% extra como margen
      const suggestedQuantity = Math.max(1, Math.ceil((minStock * 1.5) - stock));
      
      return {
        productId: p.id,
        productName: p.name,
        quantity: suggestedQuantity,
        unitCost: p.cost
      };
    });

    setOrderItems(suggestedItems);
    setIsModalOpen(true);
    alert(`Se agregaron ${suggestedItems.length} artículos a la propuesta de resurtido.`);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || orderItems.length === 0) {
      alert('Debes seleccionar un proveedor y al menos un artículo.');
      return;
    }

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          items: orderItems
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setSupplierId('');
        setOrderItems([]);
        fetchOrders();
        alert('Orden de compra creada exitosamente.');
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleReceive = async (id: string) => {
    if (!confirm('¿Estás seguro de marcar esta orden como RECIBIDA? Esto sumará los artículos a tu inventario.')) return;
    
    try {
      const res = await fetch('/api/purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'RECEIVE' }),
      });
      if (res.ok) {
        alert('Mercancía recibida e inventario actualizado.');
        fetchOrders();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 relative">
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-[600px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Nueva Orden de Compra</h2>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Proveedor</label>
                <select required value={supplierId} onChange={e => setSupplierId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black">
                  <option value="">Selecciona un proveedor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="border p-4 rounded bg-gray-50">
                <h3 className="font-semibold text-gray-700 mb-2">Agregar Artículos a la Orden</h3>
                <div className="flex gap-2 mb-2">
                  <select value={selectedProductId} onChange={e => handleProductSelect(e.target.value)} className="flex-1 rounded-md border border-gray-300 p-2 text-black">
                    <option value="">Selecciona producto...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="flex-1 rounded-md border border-gray-300 p-2 text-black" placeholder="Cantidad" />
                  <input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} className="flex-1 rounded-md border border-gray-300 p-2 text-black" placeholder="Costo Unitario" />
                  <button type="button" onClick={handleAddItem} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-medium hover:bg-gray-300">Añadir</button>
                </div>
                
                {orderItems.length > 0 && (
                  <ul className="mt-4 space-y-1 divide-y">
                    {orderItems.map((item, idx) => (
                      <li key={idx} className="py-2 text-sm flex justify-between">
                        <span>{item.quantity}x {item.productName} a ${item.unitCost.toFixed(2)}</span>
                        <button type="button" onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:underline">Eliminar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Crear Orden</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Órdenes de Compra</h1>
          <p className="text-sm text-gray-500">Gestiona compras a proveedores y da entrada a mercancía.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleAutoRestock} className="flex items-center gap-2 rounded-md bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-200">
            <TrendingDown className="h-4 w-4" />
            Auto-Resurtir (Mínimos)
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Nueva Orden
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-3">Folio</th>
                <th className="px-6 py-3">Proveedor</th>
                <th className="px-6 py-3">Artículos</th>
                <th className="px-6 py-3 text-right">Costo Total</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10">Cargando...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10">No hay órdenes registradas.</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="bg-white hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{order.folio}</td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-gray-400" />
                      {order.supplier?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {order.items.reduce((acc: number, item: any) => acc + item.quantity, 0)} pzas
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      ${order.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {order.status === 'PENDING' ? (
                        <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">Pendiente de Recibir</span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Recibido</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {order.status === 'PENDING' ? (
                        <button 
                          onClick={() => handleReceive(order.id)} 
                          className="flex items-center justify-center gap-1 mx-auto text-green-600 hover:text-green-800 font-medium bg-green-50 px-3 py-1 rounded"
                        >
                          <PackageOpen className="h-4 w-4" /> Dar Entrada
                        </button>
                      ) : (
                        <span className="text-gray-400 flex items-center justify-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Completada
                        </span>
                      )}
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
