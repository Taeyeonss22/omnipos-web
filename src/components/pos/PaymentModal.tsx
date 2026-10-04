import { useState } from 'react';
import { Banknote, CreditCard, X, DollarSign } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: string, details: any) => void;
  method: string;
  total: number;
  customerName?: string;
}

export default function PaymentModal({ isOpen, onClose, onConfirm, method, total, customerName }: PaymentModalProps) {
  const [amountGiven, setAmountGiven] = useState('');
  const [reference, setReference] = useState('');

  if (!isOpen) return null;

  const numericAmount = parseFloat(amountGiven) || 0;
  const change = Math.max(0, numericAmount - total);
  const isCashReady = numericAmount >= total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
        
        {/* Header */}
        <div className={`flex items-center gap-3 p-4 text-white ${method === 'CASH' ? 'bg-green-600' : method === 'CARD' ? 'bg-blue-600' : 'bg-purple-600'}`}>
          {method === 'CASH' ? <Banknote className="w-6 h-6" /> : method === 'CARD' ? <CreditCard className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
          <h2 className="text-xl font-bold flex-1">
            {total < 0 ? 'Devolución' : method === 'CASH' ? 'Cobro en Efectivo' : method === 'CARD' ? 'Cobro con Tarjeta' : 'Cobro a Crédito'}
          </h2>
          <button onClick={onClose} className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 font-medium">{total < 0 ? 'Total a Devolver al Cliente' : 'Total a Cobrar'}</p>
            <p className="text-4xl font-black text-gray-900">${total.toFixed(2)}</p>
            {customerName && <p className="text-sm text-blue-600 mt-1">Cliente: {customerName}</p>}
          </div>

          {method === 'CASH' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Efectivo Recibido</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-lg sm:text-xl font-bold">$</span>
                  </div>
                  <input
                    type="number"
                    min={total}
                    step="0.01"
                    autoFocus
                    value={amountGiven}
                    onChange={(e) => setAmountGiven(e.target.value)}
                    className="block w-full pl-8 pr-3 py-3 border-2 border-green-500 rounded-lg text-2xl font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-20"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {amountGiven && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-500 text-center">Cambio a entregar</p>
                  <p className={`text-3xl font-black text-center mt-1 ${isCashReady ? 'text-green-600' : 'text-red-500'}`}>
                    ${change.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {method === 'CARD' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Folio o Referencia de Terminal</label>
                <input
                  type="text"
                  autoFocus
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="block w-full px-4 py-3 border-2 border-blue-500 rounded-lg text-lg font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-20"
                  placeholder="Ej. AUT-123456"
                />
              </div>
              <p className="text-xs text-gray-500 text-center">Desliza o inserta la tarjeta en la terminal física antes de confirmar.</p>
            </div>
          )}
          
          {method === 'CREDIT' && (
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
              <p className="text-sm text-purple-800 text-center">
                El monto se agregará a la cuenta por cobrar del cliente seleccionado.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={(method === 'CASH' && !isCashReady) || (method === 'CARD' && !reference.trim())}
            onClick={() => onConfirm(method, { amountGiven: numericAmount, change, reference })}
            className="flex-1 py-3 bg-gray-900 rounded-lg text-white font-bold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {total < 0 ? 'Confirmar Devolución' : 'Confirmar Cobro'}
          </button>
        </div>

      </div>
    </div>
  );
}
