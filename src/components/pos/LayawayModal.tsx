import { useState } from 'react';
import { PackageOpen, X } from 'lucide-react';

interface LayawayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerId: string, deposit: number, method: string) => void;
  total: number;
  customers: any[];
  selectedCustomerId: string;
}

export default function LayawayModal({ isOpen, onClose, onConfirm, total, customers, selectedCustomerId }: LayawayModalProps) {
  const [deposit, setDeposit] = useState('');
  const [customerId, setCustomerId] = useState(selectedCustomerId);
  const [method, setMethod] = useState('CASH');

  if (!isOpen) return null;

  const numericDeposit = parseFloat(deposit) || 0;
  const remaining = Math.max(0, total - numericDeposit);
  const isValid = customerId && numericDeposit >= 0 && numericDeposit <= total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
        
        <div className="flex items-center gap-3 p-4 text-white bg-orange-600">
          <PackageOpen className="w-6 h-6" />
          <h2 className="text-xl font-bold flex-1">Nuevo Apartado</h2>
          <button onClick={onClose} className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (Obligatorio)</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 focus:border-orange-500 focus:outline-none"
            >
              <option value="">Selecciona un cliente...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Total a Pagar:</span>
              <span className="font-bold text-gray-900">${total.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anticipo (Monto)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-lg font-bold">$</span>
              </div>
              <input
                type="number"
                min="0"
                max={total}
                step="0.01"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-lg font-bold focus:outline-none focus:border-orange-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago del Anticipo</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 focus:border-orange-500 focus:outline-none"
            >
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
            </select>
          </div>

          {numericDeposit > 0 && (
            <div className="text-center mt-2">
              <p className="text-sm text-gray-500">Resta por pagar</p>
              <p className="text-2xl font-black text-orange-600">${remaining.toFixed(2)}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">Cancelar</button>
          <button
            disabled={!isValid}
            onClick={() => onConfirm(customerId, numericDeposit, method)}
            className="flex-1 py-3 bg-orange-600 rounded-lg text-white font-bold hover:bg-orange-700 disabled:opacity-50"
          >
            Crear Apartado
          </button>
        </div>

      </div>
    </div>
  );
}
