'use client';

import { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Package, Plus, Search, Upload, Printer } from 'lucide-react';

interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  cost: number;
  category: { name: string };
  inventories: { quantity: number; minStock: number }[];
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editProductId, setEditProductId] = useState('');
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    description: '',
    price: '',
    cost: '',
    categoryName: '',
    initialStock: '',
    minStock: '',
    location: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const collectorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async (query = '') => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/products?search=${query}`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching products', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Extraer ubicaciones únicas
  const uniqueLocations = Array.from(new Set(products.map(p => p.inventories?.[0]?.location).filter(Boolean)));
  
  // Filtrar en memoria por ubicación si hay alguna seleccionada
  const displayedProducts = locationFilter 
    ? products.filter(p => p.inventories?.[0]?.location === locationFilter)
    : products;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(search);
  };

  const openEditModal = (product: any) => {
    const inv = product.inventories?.[0];
    setNewProduct({
      code: product.code,
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      cost: product.cost.toString(),
      categoryName: product.category?.name || '',
      initialStock: inv?.quantity.toString() || '0',
      minStock: inv?.minStock.toString() || '5',
      location: inv?.location || ''
    });
    setEditProductId(product.id);
    setIsEditMode(true);
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = isEditMode ? 'PUT' : 'POST';
      const body = isEditMode ? { ...newProduct, id: editProductId } : newProduct;

      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setIsAddModalOpen(false);
        setIsEditMode(false);
        setNewProduct({ code: '', name: '', description: '', price: '', cost: '', categoryName: '', initialStock: '', minStock: '', location: '' });
        fetchProducts();
        alert(isEditMode ? 'Producto actualizado' : 'Producto creado exitosamente');
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({ productId: '', productName: '', currentStock: 0, newQuantity: '', reason: '' });

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/products/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results.data)
          });
          
          if (res.ok) {
            const data = await res.json();
            alert(`¡Importación exitosa! ${data.count} productos agregados/actualizados.`);
            fetchProducts();
          } else {
            const data = await res.json();
            alert(`Error importando: ${data.error}`);
          }
        } catch (error) {
          console.error('CSV Import Error', error);
          alert('Hubo un error importando el CSV');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const handleImportCollectorCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows: any[] = results.data;
          let successCount = 0;
          for (const row of rows) {
            // Se asume CSV: codigo, conteo_fisico
            if (!row.codigo || !row.conteo_fisico) continue;
            
            // Buscar producto por código en memoria
            const product = products.find(p => p.code === row.codigo);
            if (product) {
              const currentStock = product.inventories?.[0]?.quantity || 0;
              await fetch('/api/inventory/adjust', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: product.id,
                  newQuantity: row.conteo_fisico,
                  reason: 'Carga Masiva Colector',
                  snapshotStock: currentStock
                })
              });
              successCount++;
            }
          }
          alert(`Carga de colector exitosa. ${successCount} artículos ajustados.`);
          fetchProducts();
        } catch (error) {
          console.error('Collector CSV Error', error);
          alert('Hubo un error cargando los conteos.');
        }
        if (collectorInputRef.current) collectorInputRef.current.value = '';
      }
    });
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustData.productId,
          newQuantity: adjustData.newQuantity,
          reason: adjustData.reason,
          snapshotStock: adjustData.currentStock
        })
      });
      
      if (res.ok) {
        setIsAdjustModalOpen(false);
        setAdjustData({ productId: '', productName: '', currentStock: 0, newQuantity: '', reason: '' });
        fetchProducts();
        alert('Inventario ajustado correctamente (Captura guardada)');
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openAdjustModal = (product: Product, stock: number) => {
    setAdjustData({
      productId: product.id,
      productName: product.name,
      currentStock: stock,
      newQuantity: stock.toString(),
      reason: 'Conteo Físico'
    });
    setIsAdjustModalOpen(true);
  };

  return (
    <div className="space-y-6 relative">
      {/* Modal Ajuste de Inventario */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black bg-opacity-50 sm:items-start sm:pt-10 items-center overflow-y-auto p-4">
          <div className="w-[400px] rounded-lg max-h-[90vh] overflow-y-auto bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-2">Ajuste de Inventario (Captura)</h2>
            <p className="text-sm text-gray-500 mb-4">{adjustData.productName}</p>
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
                <span className="text-sm text-gray-700">Stock Actual del Sistema:</span>
                <span className="font-bold">{adjustData.currentStock}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nuevo Stock Físico Real</label>
                <input type="number" required value={adjustData.newQuantity} onChange={e => setAdjustData({...adjustData, newQuantity: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black text-lg font-bold" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Motivo del ajuste</label>
                <select required value={adjustData.reason} onChange={e => setAdjustData({...adjustData, reason: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black">
                  <option value="Conteo Físico">Conteo Físico (Auditoría)</option>
                  <option value="Merma / Daño">Merma / Producto Dañado</option>
                  <option value="Robo / Extravío">Robo / Extravío</option>
                  <option value="Corrección de Error">Corrección de Captura</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Guardar Captura</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo/Editar Producto */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black bg-opacity-50 sm:items-start sm:pt-10 items-center overflow-y-auto p-4">
          <div className="w-[500px] rounded-lg max-h-[90vh] overflow-y-auto bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">{isEditMode ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Código (Barras/SKU)</label>
                  <input type="text" required value={newProduct.code} onChange={e => setNewProduct({...newProduct, code: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Precio de Venta</label>
                  <input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Costo (Compra)</label>
                  <input type="number" step="0.01" required value={newProduct.cost} onChange={e => setNewProduct({...newProduct, cost: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Categoría</label>
                  <input type="text" required value={newProduct.categoryName} onChange={e => setNewProduct({...newProduct, categoryName: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stock Inicial</label>
                  <input type="number" required value={newProduct.initialStock} onChange={e => setNewProduct({...newProduct, initialStock: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ubicación (Pasillo/Anaquel)</label>
                  <input type="text" value={newProduct.location} onChange={e => setNewProduct({...newProduct, location: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" placeholder="Ej. Pasillo 3, Nivel 1" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Catálogo e Inventario</h1>
          <p className="text-sm text-gray-500">Gestiona los productos y existencias de tu sucursal.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Zona / Ubicación */}
          <select 
            value={locationFilter} 
            onChange={e => setLocationFilter(e.target.value)}
            className="rounded-md border border-gray-300 p-2 text-sm text-black"
          >
            <option value="">Todas las zonas</option>
            {uniqueLocations.map((loc, idx) => (
              <option key={idx} value={loc as string}>{loc as string}</option>
            ))}
          </select>
          
          <button 
            onClick={() => window.open(`/dashboard/inventory/print?location=${locationFilter}`, '_blank')}
            className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Printer className="h-4 w-4" />
            Imprimir Hoja
          </button>

          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={collectorInputRef}
            onChange={handleImportCollectorCSV} 
          />
          <button 
            onClick={() => collectorInputRef.current?.click()} 
            className="flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            <Upload className="h-4 w-4" />
            Colector (CSV)
          </button>

          <div className="w-px h-6 bg-gray-300 mx-2"></div>

          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImportCSV} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Importar Catálogo
          </button>
          
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <form onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-gray-300 pl-10 pr-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </form>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-100 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-3">Código</th>
                <th className="px-6 py-3">Producto</th>
                <th className="px-6 py-3">Ubicación</th>
                <th className="px-6 py-3">Categoría</th>
                <th className="px-6 py-3 text-right">Precio Venta</th>
                <th className="px-6 py-3 text-center">Stock</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10">Cargando catálogo...</td></tr>
              ) : displayedProducts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10">No hay productos que mostrar.</td></tr>
              ) : (
                displayedProducts.map((product) => {
                  const stock = product.inventories?.[0]?.quantity || 0;
                  const loc = product.inventories?.[0]?.location || '-';
                  const isLowStock = stock <= (product.inventories[0]?.minStock || 0);

                  return (
                    <tr key={product.id} className="border-b bg-white hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{product.code}</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <div className="rounded bg-gray-100 p-2"><Package className="h-4 w-4 text-gray-500" /></div>
                        {product.name}
                      </td>
                      <td className="px-6 py-4">{loc}</td>
                      <td className="px-6 py-4">{product.category?.name || 'N/A'}</td>
                      <td className="px-6 py-4 text-right">${product.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center space-x-2">
                        <button onClick={() => openAdjustModal(product, stock)} className="text-purple-600 font-medium hover:underline">Ajustar (Captura)</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => openEditModal(product)} className="text-blue-600 hover:underline">Editar</button>
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
