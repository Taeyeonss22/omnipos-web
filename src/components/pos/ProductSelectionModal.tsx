import { X, Package } from 'lucide-react';

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: any[];
  onSelect: (product: any) => void;
}

export default function ProductSelectionModal({ isOpen, onClose, matches, onSelect }: ProductSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start pt-20 justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden mb-10">
        <div className="flex items-center gap-3 p-4 bg-blue-600 text-white">
          <Package className="w-6 h-6" />
          <h2 className="text-xl font-bold flex-1">Selecciona el producto correcto</h2>
          <button onClick={onClose} className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-gray-500 mb-4">Se encontraron varios productos que coinciden con tu búsqueda. Haz clic en el que deseas agregar al carrito.</p>
          
          <div className="grid grid-cols-1 gap-3">
            {matches.map(product => (
              <button
                key={product.id}
                onClick={() => onSelect(product)}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div>
                  <h3 className="font-bold text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500">Código: {product.code}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-blue-600">${product.price.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">
                    Stock: {product.inventories?.reduce((acc: number, inv: any) => acc + inv.quantity, 0) || 0}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
