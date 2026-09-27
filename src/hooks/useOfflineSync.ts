'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PendingSale {
  id: string; // uuid local
  items: any[];
  paymentMethod: string;
  sessionId: string;
  customerId?: string;
  timestamp: number;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQueue, setPendingQueue] = useState<PendingSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Inicializar estado de red y cargar cola existente
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const savedQueue = localStorage.getItem('omnipos_offline_sales');
    if (savedQueue) {
      setPendingQueue(JSON.parse(savedQueue));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Guardar en localStorage siempre que cambie la cola
  useEffect(() => {
    localStorage.setItem('omnipos_offline_sales', JSON.stringify(pendingQueue));
  }, [pendingQueue]);

  const addToOfflineQueue = (sale: Omit<PendingSale, 'id' | 'timestamp'>) => {
    const newSale: PendingSale = {
      ...sale,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    setPendingQueue(prev => [...prev, newSale]);
  };

  const syncQueue = useCallback(async () => {
    if (!isOnline || pendingQueue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    try {
      const res = await fetch('/api/sales/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales: pendingQueue })
      });

      if (res.ok) {
        // Vaciamos la cola porque el backend ya procesó todo
        setPendingQueue([]);
      } else {
        console.warn('Fallo en sincronización. Reintentando más tarde.');
      }
    } catch (error) {
      console.error('Error de red al sincronizar', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, pendingQueue, isSyncing]);

  // Intentar sincronizar cuando vuelve el internet o cambia la cola
  useEffect(() => {
    if (isOnline && pendingQueue.length > 0) {
      syncQueue();
    }
  }, [isOnline, pendingQueue.length, syncQueue]);

  return {
    isOnline,
    pendingCount: pendingQueue.length,
    addToOfflineQueue,
    syncQueue,
    isSyncing
  };
}
