'use client';

import { useState, useRef, useEffect } from 'react';
import { ShoppingCart, Search, Trash2, Lock, Unlock, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import TicketPreviewModal from '@/components/pos/TicketPreviewModal';
import PaymentModal from '@/components/pos/PaymentModal';
import LayawayModal from '@/components/pos/LayawayModal';
import CloseRegisterModal from '@/components/pos/CloseRegisterModal';
import ProductSelectionModal from '@/components/pos/ProductSelectionModal';

interface CartItem {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export default function POSPage() {
  const { data: session } = useSession();
  const [barcode, setBarcode] = useState('');
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewTicket, setPreviewTicket] = useState<any>(null);
  const [isLayawayModalOpen, setIsLayawayModalOpen] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, method: string}>({ isOpen: false, method: '' });
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectionModal, setSelectionModal] = useState<{isOpen: boolean, matches: any[]}>({ isOpen: false, matches: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado de Caja
  const [cashSession, setCashSession] = useState<any>(null);
  const [availableRegisters, setAvailableRegisters] = useState<any[]>([]);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [selectedRegister, setSelectedRegister] = useState('');

  // Clientes
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');

  const [productsCatalog, setProductsCatalog] = useState<any[]>([]);
  const { isOnline, pendingCount, addToOfflineQueue, isSyncing } = useOfflineSync();

  useEffect(() => {
    fetchSession();
    fetchCustomers();
    fetchCatalog(); // Precargar catálogo para búsquedas offline
  }, []);

  useEffect(() => {
    if (cashSession && !showOpenModal) {
      inputRef.current?.focus();
    }
  }, [cart, cashSession, showOpenModal, selectedCustomer, isOnline]);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/cash-registers/session');
      if (!res.ok) throw new Error('Offline');
      const data = await res.json();
      if (data.activeSession) {
        setCashSession(data.activeSession);
      } else {
        setCashSession(null);
        setAvailableRegisters(data.availableRegisters || []);
        if (data.availableRegisters?.length > 0) {
          setSelectedRegister(data.availableRegisters[0].id);
        }
        setShowOpenModal(true);
      }
    } catch {
      console.warn('POS Offline: No se pudo verificar la sesión.');
      // Si estamos offline y no tenemos sesión, no podemos cobrar.
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        localStorage.setItem('omnipos_customers_cache', JSON.stringify(data));
      }
    } catch {
      const cached = localStorage.getItem('omnipos_customers_cache');
      if (cached) setCustomers(JSON.parse(cached));
    }
  };

  const fetchCatalog = async () => {
    try {
      // Descargamos todo el catálogo. En producción grande se paginaría o se usaría IndexedDB.
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProductsCatalog(data);
        localStorage.setItem('omnipos_products_cache', JSON.stringify(data));
      }
    } catch {
      const cached = localStorage.getItem('omnipos_products_cache');
      if (cached) setProductsCatalog(JSON.parse(cached));
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) return alert('Debes estar conectado a internet para abrir la caja.');
    
    try {
      const res = await fetch('/api/cash-registers/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerId: selectedRegister, openingBalance }),
      });
      if (res.ok) {
        setShowOpenModal(false);
        fetchSession();
      } else {
        alert('Error al abrir la caja');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCloseRegisterClick = () => {
    if (!isOnline) return alert('Debes estar conectado a internet para cerrar la caja y hacer el corte Z.');
    if (pendingCount > 0) return alert('Aún tienes ventas pendientes de sincronizar. Espera a que termine antes de cerrar.');
    setIsCloseModalOpen(true);
  };

  const processCloseRegister = async (totalAmount: number, breakdown: any) => {
    if (!isOnline) return alert('Debes estar conectado a internet para cerrar la caja y hacer el corte Z.');
    if (pendingCount > 0) return alert('Aún tienes ventas pendientes de sincronizar. Espera a que termine antes de cerrar.');

    
    
    try {
      const res = await fetch('/api/cash-registers/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: cashSession.id, closingBalance: totalAmount }),
      });
      if (res.ok) {
        const data = await res.json();
        
        // Imprimir Corte Z Automáticamente
        const localSettingsRaw = localStorage.getItem('printerSettings');
        let localSettings = { header: 'CRIMEN SANTO', footer: '', width: '80mm', printerName: 'printer:impresora_termica' };
        if (localSettingsRaw) localSettings = JSON.parse(localSettingsRaw);
        
        try {
          await fetch('http://127.0.0.1:8080/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              folio: `CORTE-Z-${cashSession.id.slice(0, 6).toUpperCase()}`,
              branchName: localSettings.header,
              date: new Date().toISOString(),
              cashier: session?.user?.name || 'Cajero',
              items: [
                { quantity: 1, product: 'FONDO INICIAL', subtotal: cashSession.openingBalance },
                { quantity: 1, product: 'VENTAS EFECTIVO', subtotal: totalAmount - cashSession.openingBalance },
                { quantity: breakdown.b1000, product: 'Billetes $1000', subtotal: breakdown.b1000 * 1000 },
                { quantity: breakdown.b500, product: 'Billetes $500', subtotal: breakdown.b500 * 500 },
                { quantity: breakdown.b200, product: 'Billetes $200', subtotal: breakdown.b200 * 200 },
                { quantity: breakdown.b100, product: 'Billetes $100', subtotal: breakdown.b100 * 100 },
                { quantity: breakdown.b50, product: 'Billetes $50', subtotal: breakdown.b50 * 50 },
                { quantity: breakdown.b20, product: 'Billetes $20', subtotal: breakdown.b20 * 20 },
                { quantity: breakdown.m10, product: 'Monedas $10', subtotal: breakdown.m10 * 10 },
                { quantity: breakdown.m5, product: 'Monedas $5', subtotal: breakdown.m5 * 5 },
                { quantity: breakdown.m2, product: 'Monedas $2', subtotal: breakdown.m2 * 2 },
                { quantity: breakdown.m1, product: 'Monedas $1', subtotal: breakdown.m1 * 1 },
                { quantity: breakdown.m05, product: 'Monedas $0.50', subtotal: breakdown.m05 * 0.5 },
              ].filter(i => i.quantity > 0),
              subtotal: totalAmount - cashSession.openingBalance,
              tax: 0,
              total: totalAmount,
              method: 'Z-REPORT',
              footer: `Declarado: ${totalAmount.toFixed(2)}\nDiferencia (Sobrante/Faltante): ${data.difference.toFixed(2)}\n\nFirma del Cajero:\n\n_________________________`, 
              width: localSettings.width,
              printerName: localSettings.printerName
            })
          });
        } catch(e) { console.warn(e); }

        alert(`Caja cerrada exitosamente. Diferencia: ${data.difference}`);
        setIsCloseModalOpen(false);
        setCashSession(null);
        fetchSession();
      } else {
        alert('Error al cerrar la caja');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const tax = 0;
  const total = subtotal;

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcode.trim().toLowerCase();
    if (!query) return;

    // Búsqueda en caché local (instantánea y funciona offline)
    const matches = productsCatalog.filter(p => {
      if (!p) return false;
      const codeStr = p.code ? String(p.code).toLowerCase() : '';
      const nameStr = p.name ? String(p.name).toLowerCase() : '';
      return codeStr.includes(query) || nameStr.includes(query);
    });

    if (matches.length === 1) {
      addToCart(matches[0]);
      setBarcode('');
    } else if (matches.length > 1) {
      setSelectionModal({ isOpen: true, matches });
      setBarcode('');
    } else {
      alert('Producto no encontrado en el catálogo');
      setBarcode('');
    }
  };

    const addToCart = (product: any) => {
    const qtyChange = isReturnMode ? -1 : 1;
    setCart(prev => {
      const existing = prev.find((item: any) => item.product.id === product.id);
      if (existing) {
        return prev.map((item: any) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + qtyChange, subtotal: (item.quantity + qtyChange) * product.price }
            : item
        );
      }
      return [...prev, { product, quantity: qtyChange, subtotal: qtyChange * product.price }];
    });
    // Si queremos apagarlo después de cada uso podemos hacerlo aquí, pero mejor dejarlo manual
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleCheckoutClick = (method: string) => {
    if (cart.length === 0 || !cashSession) return;
    if (method === 'CREDIT' && !selectedCustomer) {
      alert('Debes seleccionar un cliente para cobrar a crédito.');
      return;
    }
    if (method === 'CREDIT' && !isOnline) {
      alert('No puedes realizar ventas a crédito mientras estás sin conexión. Reconecta la red para verificar saldo.');
      return;
    }
    setPaymentModal({ isOpen: true, method });
  };


  const handleLayawayConfirm = async (customerId: string, deposit: number, method: string) => {
    setIsLayawayModalOpen(false);
    setIsProcessing(true);
    
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: cart, 
          paymentMethod: method, 
          sessionId: cashSession.id,
          customerId: customerId,
          status: 'LAYAWAY',
          paymentAmount: deposit
        }),
      });
      
      if (!res.ok) throw new Error('Error al crear apartado');
      const sale = await res.json();
      setCart([]);
      setSelectedCustomer('');
      alert(`Apartado creado exitosamente. Folio: ${sale.folio}`);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al crear el apartado.');
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const processCheckout = async (method: string, details: any = {}) => {
    setPaymentModal({ isOpen: false, method: '' });
    setIsProcessing(true);
    
    // Función de impresión aislada
    const printTicket = (folioText: string, ticketMethod: string = method) => {
      const localSettingsRaw = localStorage.getItem('printerSettings');
      let localSettings = { header: 'CRIMEN SANTO', footer: '¡Gracias por su compra!', width: '80mm', printerName: 'printer:impresora_termica' };
      if (localSettingsRaw) {
        localSettings = JSON.parse(localSettingsRaw);
      }
      
      let finalMethod = ticketMethod;
      if (ticketMethod === 'CARD' && details.reference) {
        finalMethod = `TARJETA (Ref: ${details.reference})`;
      } else if (ticketMethod === 'CASH' && details.amountGiven) {
        finalMethod = `EFECTIVO (Recibido: $${details.amountGiven.toFixed(2)} - Cambio: $${details.change.toFixed(2)})`;
      }

      setPreviewTicket({
        folio: folioText,
        branchName: localSettings.header,
        date: new Date().toISOString(),
        cashier: session?.user?.name,
        items: cart.map((i: any) => ({ quantity: i.quantity, product: i.product?.name, subtotal: i.subtotal })),
        subtotal,
        tax,
        total,
        method: finalMethod,
        footer: localSettings.footer,
        width: localSettings.width,
        printerName: localSettings.printerName
      });
    };

    const sendToPrintBridge = async (payload: any) => {
      fetch('http://127.0.0.1:8080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Print bridge no disponible:', err));
    };

    if (isOnline) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            items: cart, 
            paymentMethod: method, 
            sessionId: cashSession.id,
            customerId: selectedCustomer || undefined
          }),
        });
        
        if (!res.ok) throw new Error('Error de servidor al guardar la venta');
        
        const sale = await res.json();
        setCart([]);
        setSelectedCustomer('');
        printTicket(sale.folio);
        alert(`Venta Completada. Folio: ${sale.folio}`);
      } catch (error: any) {
        // Fallback a offline si el fetch falla estando "onLine" = true (falso positivo de red)
        console.warn('Fallback a modo offline por fallo de fetch', error);
        saveOfflineSale(method);
        printTicket('OFFLINE-PENDING');
      } finally {
        setIsProcessing(false);
        inputRef.current?.focus();
      }
    } else {
      // Estamos offline intencionalmente
      saveOfflineSale(method);
      setCart([]);
      setSelectedCustomer('');
      printTicket('OFFLINE-PENDING');
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const saveOfflineSale = (method: string) => {
    addToOfflineQueue({
      items: cart,
      paymentMethod: method,
      sessionId: cashSession.id,
      customerId: selectedCustomer || undefined
    });
    // Se muestra visualmente que fue cobrada localmente
    alert('Modo Offline: La venta ha sido registrada en la memoria local y se sincronizará automáticamente.');
  };

    const getSearchSuggestions = () => {
    const query = barcode.trim().toLowerCase();
    if (query.length < 2) return [];
    return productsCatalog.filter(p => {
      if (!p) return false;
      const codeStr = p.code ? String(p.code).toLowerCase() : '';
      const nameStr = p.name ? String(p.name).toLowerCase() : '';
      return codeStr.includes(query) || nameStr.includes(query);
    }).slice(0, 10);
  };
  const searchSuggestions = getSearchSuggestions();

  return (
    <div className="flex h-[calc(100vh-80px)] gap-6 relative">
      {/* Modal de Apertura de Caja */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black bg-opacity-50 sm:items-start sm:pt-10 items-center overflow-y-auto p-4">
          <div className="w-96 rounded-lg max-h-[90vh] overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3 border-b pb-4">
              <Lock className="h-6 w-6 text-red-500" />
              <h2 className="text-xl font-bold">Caja Cerrada</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">Debes abrir turno en una caja para poder cobrar.</p>
            
            <form onSubmit={handleOpenRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Seleccionar Caja</label>
                <select 
                  value={selectedRegister}
                  onChange={e => setSelectedRegister(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-black"
                >
                  {availableRegisters.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Monto Inicial (Fondo de caja)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-black"
                  required
                />
              </div>
              <button type="submit" className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700">
                Abrir Caja
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Panel Izquierdo: Buscador y Carrito */}
      <div className="flex flex-1 flex-col rounded-lg bg-white shadow">
        <div className="flex items-center justify-between border-b p-4">
                    <button 
            type="button"
            onClick={() => setIsReturnMode(!isReturnMode)}
            className={`mr-3 flex-shrink-0 rounded-md px-3 py-3 text-sm font-bold transition-colors ${isReturnMode ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            {isReturnMode ? '¡MODO DEVOLUCIÓN ACTIVO!' : 'Modo Normal'}
          </button>
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder={isOnline ? "Escanea o busca..." : "Modo Offline - Búsqueda Local..."}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className={`w-full rounded-md border-2 py-3 pl-12 pr-4 text-lg font-medium focus:outline-none disabled:opacity-50 ${isOnline ? 'border-blue-500 focus:border-blue-600' : 'border-orange-500 focus:border-orange-600 bg-orange-50'}`}
              disabled={!cashSession && isOnline}
            />
            {searchSuggestions.length > 0 && barcode.trim().length >= 2 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 shadow-lg rounded-b-lg max-h-60 overflow-y-auto mt-1">
                {searchSuggestions.map(p => (
                  <li 
                    key={p.id} 
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 flex justify-between items-center" 
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevents input from losing focus immediately
                      addToCart(p);
                      setBarcode('');
                      if (inputRef.current) inputRef.current.focus();
                    }}
                  >
                    <div>
                      <span className="block font-bold text-gray-800">{p.name}</span>
                      <span className="text-xs text-gray-500">Cód: {p.code} | Stock: {p.inventories?.reduce((acc, inv) => acc + inv.quantity, 0) || 0}</span>
                    </div>
                    <span className="font-bold text-blue-600">${p.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </form>
          {cashSession && (
             <div className="ml-4 flex items-center gap-4">
               {/* Badge de Red */}
               <div className="flex items-center gap-2">
                 {isOnline ? (
                   <span className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                     <Wifi className="h-4 w-4" /> En línea
                   </span>
                 ) : (
                   <span className="flex items-center gap-1 text-sm font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-200">
                     <WifiOff className="h-4 w-4 animate-pulse" /> Offline
                   </span>
                 )}

                 {pendingCount > 0 && (
                   <span className="flex items-center gap-1 text-sm font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded-md border border-yellow-200">
                     <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> 
                     {pendingCount} Pdt.
                   </span>
                 )}
               </div>

               <span className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                 <Unlock className="h-4 w-4" /> {cashSession.register.name}
               </span>
               <button 
                 onClick={handleCloseRegisterClick}
                 className="text-sm font-medium text-red-600 hover:text-red-800 underline"
               >
                 Cerrar Turno
               </button>
             </div>
          )}
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <ShoppingCart className="mb-4 h-16 w-16 opacity-20" />
              <p className="text-lg">El carrito está vacío</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-sm text-gray-500">
                  <th className="pb-2">Producto</th>
                  <th className="pb-2 text-center">Cant</th>
                  <th className="pb-2 text-right">Precio</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.product?.id || Math.random()} className="border-b">
                    <td className="py-4">
                      <div className="font-medium text-gray-900">{item.product?.name}</div>
                      <div className="text-xs text-gray-500">{item.product?.code}</div>
                    </td>
                    <td className="py-4 text-center font-bold text-blue-600">{item.quantity}</td>
                    <td className="py-4 text-right">${(item.product?.price || 0).toFixed(2)}</td>
                    <td className="py-4 text-right font-medium">${item.subtotal.toFixed(2)}</td>
                    <td className="py-4 text-right">
                      <button onClick={() => removeFromCart(item.product?.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panel Derecho: Totales y Pago */}
      <div className="flex w-96 flex-col justify-between rounded-lg bg-gray-800 p-6 text-white shadow">
        <div>
          <h2 className="mb-6 text-xl font-bold border-b border-gray-700 pb-4">Resumen de Venta</h2>
          
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-300">
              <Users className="h-4 w-4" /> Cliente (Opcional)
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full rounded-md border-gray-600 bg-gray-700 p-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Público en General</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4 text-lg">

            <div className="flex justify-between border-t border-gray-700 pt-4 text-3xl font-bold text-green-400">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            disabled={cart.length === 0 || isProcessing || !cashSession}
            onClick={() => handleCheckoutClick('CASH')}
            className="w-full rounded-md bg-green-600 py-4 text-xl font-bold transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? 'Procesando...' : 'Cobrar en Efectivo'}
          </button>
          
                    <div className="grid grid-cols-2 gap-4">
            <button
              disabled={cart.length === 0 || isProcessing || !cashSession}
              onClick={() => handleCheckoutClick('CARD')}
              className="rounded-md bg-blue-600 py-3 font-semibold transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              Tarjeta
            </button>
            <button
              disabled={cart.length === 0 || isProcessing || !cashSession}
              onClick={() => {
                if (!cashSession && isOnline) return alert('Debes abrir una caja primero');
                setIsLayawayModalOpen(true);
              }}
              className="rounded-md bg-orange-600 py-3 font-semibold transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              Apartar
            </button>
          </div>
        </div>
      </div>

      <PaymentModal 
        isOpen={paymentModal.isOpen}
        method={paymentModal.method}
        total={total}
        customerName={customers.find(c => c.id === selectedCustomer)?.name}
        onClose={() => setPaymentModal({ isOpen: false, method: '' })}
        onConfirm={(method, details) => processCheckout(method, details)}
      />

      
      <CloseRegisterModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onConfirm={(total, breakdown) => processCloseRegister(total, breakdown)}
      />
      <ProductSelectionModal
        isOpen={selectionModal.isOpen}
        onClose={() => setSelectionModal({ isOpen: false, matches: [] })}
        matches={selectionModal.matches}
        onSelect={(product) => {
          addToCart(product);
          setSelectionModal({ isOpen: false, matches: [] });
          if (inputRef.current) inputRef.current.focus();
        }}
      />
      <LayawayModal 
        isOpen={isLayawayModalOpen} 
        onClose={() => setIsLayawayModalOpen(false)} 
        onConfirm={handleLayawayConfirm} 
        total={total} 
        customers={customers} 
        selectedCustomerId={selectedCustomer} 
      />
      <TicketPreviewModal 
        isOpen={!!previewTicket}
        onClose={() => setPreviewTicket(null)}
        ticketData={previewTicket}
        onPrint={() => {
          fetch('http://127.0.0.1:8080/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(previewTicket)
          }).catch(err => console.warn('Print bridge no disponible:', err));
        }}
      />
    </div>
  );
}
