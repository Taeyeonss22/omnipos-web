import { useState } from 'react';
import { X, Calculator } from 'lucide-react';

interface CloseRegisterModalProps {
  errorMsg?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (total: number, breakdown: any) => void;
}

export default function CloseRegisterModal({ isOpen, onClose, onConfirm, errorMsg }: CloseRegisterModalProps) {
  const [denominations, setDenominations] = useState({
    b1000: 0,
    b500: 0,
    b200: 0,
    b100: 0,
    b50: 0,
    b20: 0,
    m10: 0,
    m5: 0,
    m2: 0,
    m1: 0,
    m05: 0,
  });

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    const qty = parseInt(value, 10);
    setDenominations({ ...denominations, [field]: isNaN(qty) ? 0 : qty });
  };

  const total = 
    (denominations.b1000 * 1000) +
    (denominations.b500 * 500) +
    (denominations.b200 * 200) +
    (denominations.b100 * 100) +
    (denominations.b50 * 50) +
    (denominations.b20 * 20) +
    (denominations.m10 * 10) +
    (denominations.m5 * 5) +
    (denominations.m2 * 2) +
    (denominations.m1 * 1) +
    (denominations.m05 * 0.5);

  return (
    <div className="fixed inset-0 z-50 flex items-start pt-10 justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden mb-10">
        
        {/* Header */}
        <div className="flex items-center gap-3 p-4 bg-gray-900 text-white">
          <Calculator className="w-6 h-6" />
          <h2 className="text-xl font-bold flex-1">Arqueo de Caja (Denominaciones)</h2>
          <button onClick={onClose} className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4 text-center">Ingresa la CANTIDAD de billetes o monedas que tienes en la caja, no el valor.</p>
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Billetes */}
            <div>
              <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">Billetes</h3>
              {[1000, 500, 200, 100, 50, 20].map(val => (
                <div key={`b${val}`} className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-600 w-20">${val}</label>
                  <input
                    type="number"
                    min="0"
                    value={denominations[`b${val}` as keyof typeof denominations] || ''}
                    onChange={(e) => handleChange(`b${val}`, e.target.value)}
                    className="w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            {/* Monedas */}
            <div>
              <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">Monedas</h3>
              {[10, 5, 2, 1, 0.5].map(val => (
                <div key={`m${val < 1 ? '05' : val}`} className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-600 w-20">${val.toFixed(2)}</label>
                  <input
                    type="number"
                    min="0"
                    value={denominations[`m${val < 1 ? '05' : val}` as keyof typeof denominations] || ''}
                    onChange={(e) => handleChange(`m${val < 1 ? '05' : val}`, e.target.value)}
                    className="w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-500 text-center">Total Contabilizado</p>
            <p className="text-4xl font-black text-center mt-1 text-gray-900">
              ${total.toFixed(2)}
            </p>
          </div>
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
            onClick={() => onConfirm(total, denominations)}
            className="flex-1 py-3 bg-gray-900 rounded-lg text-white font-bold hover:bg-black transition-colors"
          >
            Realizar Corte
          </button>
        </div>
        {errorMsg && <div className="p-4 bg-red-100 text-red-700 text-center font-bold">{errorMsg}</div>}

      </div>
    </div>
  );
}
