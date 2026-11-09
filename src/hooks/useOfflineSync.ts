'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PendingSale {
  id: string; // uuid local
  items: any[];
  paymentMethod: string;
  sessionId: string;
  customerId?: string;
  timestamp: number;
}

const STORAGE_KEY = 'omnipos_offline_sales';

function readQueue(): PendingSale[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingSale[]) {
  try {
    if (queue.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage lleno o bloqueado: la cola sigue en memoria
  }
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQueue, setPendingQueue] = useState<PendingSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const syncingRef = useRef(false);

  // Inicializar estado de red y cargar cola existente
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cargar la cola ANTES de permitir cualquier escritura; antes se escribía
    // una cola vacía al montar y podían perderse ventas offline pendientes.
    setPendingQueue(readQueue());
    setLoaded(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Guardar en localStorage siempre que cambie la cola (solo después de cargarla)
  useEffect(() => {
    if (!loaded) return;
    writeQueue(pendingQueue);
  }, [pendingQueue, loaded]);

  const addToOfflineQueue = useCallback((sale: Omit<PendingSale, 'id' | 'timestamp'>) => {
    const newSale: PendingSale = {
      ...sale,
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      timestamp: Date.now()
    };
    setPendingQueue(prev => {
      const next = [...prev, newSale];
      writeQueue(next); // guardar de inmediato por si se cierra la pestaña
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setPendingQueue([]);
    writeQueue([]);
  }, []);

  const syncQueue = useCallback(async (): Promise<boolean> => {
    if (pendingQueue.length === 0) return true;
    if (!isOnline || syncingRef.current) return false;

    syncingRef.current = true;
    setIsSyncing(true);
    const batch = pendingQueue;
    try {
      const res = await fetch('/api/sales/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales: batch })
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        // Quitar solo las ventas que el servidor confirmó. Las que se agregaron
        // mientras se sincronizaba se conservan para el siguiente intento.
        const synced = new Set<string>(
          Array.isArray(data.syncedIds) ? data.syncedIds : batch.map(s => s.id)
        );
        setPendingQueue(prev => prev.filter(s => !synced.has(s.id)));
        return true;
      } else {
        console.warn('Fallo en sincronización. Reintentando más tarde.');
        return false;
      }
    } catch (error) {
      console.error('Error de red al sincronizar', error);
      return false;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, pendingQueue]);

  // Intentar sincronizar cuando vuelve el internet o cambia la cola
  useEffect(() => {
    if (isOnline && pendingQueue.length > 0) {
      syncQueue();
    }
  }, [isOnline, pendingQueue.length, syncQueue]);

  // Reintento periódico por si una sincronización anterior falló
  useEffect(() => {
    if (!isOnline || pendingQueue.length === 0) return;
    const timer = setInterval(() => { syncQueue(); }, 60000);
    return () => clearInterval(timer);
  }, [isOnline, pendingQueue.length, syncQueue]);

  return {
    isOnline,
    pendingCount: pendingQueue.length,
    addToOfflineQueue,
    syncQueue,
    clearQueue,
    isSyncing
  };
}
