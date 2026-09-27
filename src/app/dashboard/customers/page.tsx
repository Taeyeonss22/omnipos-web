'use client';

import { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Users, Plus, Search, CreditCard, Upload } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  credit?: {
    creditLimit: number;
    balance: number;
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    rfc: '',
    creditLimit: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewCustomer({ name: '', email: '', phone: '', rfc: '', creditLimit: '' });
        fetchCustomers();
        alert('Cliente creado exitosamente');
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/customers/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results.data)
          });
          
          if (res.ok) {
            const data = await res.json();
            alert(`¡Importación exitosa! ${data.count} clientes agregados.`);
            fetchCustomers();
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

  return (
    <div className="space-y-6 relative">
      {/* Modal Nuevo Cliente */}
      {isAddModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-[400px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Nuevo Cliente</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre o Razón Social</label>
                <input type="text" required value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">RFC (Opcional)</label>
                <input type="text" value={newCustomer.rfc} onChange={e => setNewCustomer({...newCustomer, rfc: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                <input type="text" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Límite de Crédito Autorizado (Opcional)</label>
                <input type="number" step="0.01" value={newCustomer.creditLimit} onChange={e => setNewCustomer({...newCustomer, creditLimit: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" placeholder="Ej. 10000" />
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Clientes y Créditos</h1>
          <p className="text-sm text-gray-500">Directorio de clientes y estados de cuenta.</p>
        </div>
        <div className="flex items-center gap-3">
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
            <Upload className="h-4 w-4" />
            Importar CSV
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o RFC..."
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Contacto</th>
                <th className="px-6 py-3">RFC</th>
                <th className="px-6 py-3 text-right">Límite Crédito</th>
                <th className="px-6 py-3 text-right">Saldo Deudor</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10">Cargando...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10">No hay clientes registrados.</td></tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b bg-white hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                      <div className="rounded-full bg-blue-100 p-2"><Users className="h-4 w-4 text-blue-600" /></div>
                      {customer.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{customer.phone || 'N/A'}</div>
                      <div className="text-xs">{customer.email}</div>
                    </td>
                    <td className="px-6 py-4">{customer.rfc || 'N/A'}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {customer.credit ? `$${customer.credit.creditLimit.toFixed(2)}` : 'Sin crédito'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {customer.credit ? (
                        <span className={`font-bold ${customer.credit.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${customer.credit.balance.toFixed(2)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {/* <button className="text-blue-600 hover:underline">Ver Historial</button> */}
                      -
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
