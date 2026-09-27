import { Printer, X } from 'lucide-react';

interface TicketPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  ticketData: any; // The payload normally sent to the Print Bridge
}

export default function TicketPreviewModal({ isOpen, onClose, onPrint, ticketData }: TicketPreviewModalProps) {
  if (!isOpen || !ticketData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Printer className="w-5 h-5" /> Vista Previa del Ticket
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Ticket Content (Scrollable) */}
        <div className="p-6 overflow-y-auto bg-gray-200 flex justify-center">
          {/* Simulated Thermal Paper */}
          <div className="bg-white p-6 shadow-md w-[300px] text-xs font-mono text-gray-900 leading-tight">
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold">{ticketData.branchName}</h1>
            </div>
            
            <div className="border-t border-dashed border-gray-400 py-2 mb-2">
              <div>Folio: {ticketData.folio}</div>
              <div>Fecha: {new Date(ticketData.date).toLocaleString()}</div>
              <div>Cajero: {ticketData.cashier}</div>
            </div>

            <table className="w-full mb-2">
              <thead>
                <tr className="border-b border-dashed border-gray-400 text-left">
                  <th className="font-normal py-1 w-10">Cant</th>
                  <th className="font-normal py-1">Desc</th>
                  <th className="font-normal py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ticketData.items?.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-1">{item.quantity}</td>
                    <td className="py-1 truncate max-w-[120px]">{item.product}</td>
                    <td className="py-1 text-right">${Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-gray-400 pt-2 mb-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${Number(ticketData.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA:</span>
                <span>${Number(ticketData.tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm mt-1">
                <span>Total:</span>
                <span>${Number(ticketData.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Pago:</span>
                <span>{ticketData.method}</span>
              </div>
            </div>

            {ticketData.footer && (
              <div className="text-center mt-4 border-t border-dashed border-gray-400 pt-4">
                {ticketData.footer}
              </div>
            )}
            
            <div className="text-center mt-4">
              {/* Fake barcode */}
              <div className="font-barcode text-4xl mt-2 tracking-widest opacity-80">||| ||||| |||| ||</div>
              <div className="text-[10px] mt-1">{ticketData.folio}</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-lg">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button 
            onClick={() => {
              onPrint();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded flex items-center gap-2 hover:bg-blue-700 shadow-sm"
          >
            <Printer className="w-4 h-4" /> Enviar a Impresora
          </button>
        </div>

      </div>
    </div>
  );
}
