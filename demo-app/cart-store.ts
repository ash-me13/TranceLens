import { useState, useEffect, useCallback } from 'react';
import { DemoCartItem, CATALOG } from './types';

export const CART_STORAGE_KEY = 'tracelens_demo_cart';
export const CHECKOUT_STALE_KEY = 'tracelens_demo_checkout_stale';
export const PROFILE_STORAGE_KEY = 'tracelens_demo_profile';

export function getStoredCart(): DemoCartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [CATALOG[0]]; // Default 1 item ($149.00)
  } catch {
    return [CATALOG[0]];
  }
}

export function saveStoredCart(items: DemoCartItem[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

// Hook for Tab A and Tab B cart management
export function useDemoCart(tabName: 'Tab A' | 'Tab B', isFixed: boolean) {
  const [items, setItems] = useState<DemoCartItem[]>(() => getStoredCart());
  const [lastEvent, setLastEvent] = useState<string>('Initial state loaded from storage');

  // Sync listener: Only active in FIXED mode!
  useEffect(() => {
    if (!isFixed) return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setItems(updated);
          setLastEvent(`[Fixed sync] Received storage event from another tab at ${new Date().toLocaleTimeString()}`);
        } catch {
          // parse error
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isFixed]);

  const addItem = useCallback((item: DemoCartItem) => {
    setItems(prev => {
      const next = [...prev, item];
      saveStoredCart(next);
      setLastEvent(`[${tabName}] Added ${item.name} ($${(item.priceMinor/100).toFixed(2)}) to localStorage`);
      return next;
    });
  }, [tabName]);

  const removeItem = useCallback((index: number) => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== index);
      saveStoredCart(next);
      setLastEvent(`[${tabName}] Removed item at index ${index}`);
      return next;
    });
  }, [tabName]);

  const resetCart = useCallback(() => {
    const initial = [CATALOG[0]];
    saveStoredCart(initial);
    setItems(initial);
    setLastEvent(`[${tabName}] Reset cart to default item`);
  }, [tabName]);

  const refreshTab = useCallback(() => {
    const fromDisk = getStoredCart();
    setItems(fromDisk);
    setLastEvent(`[${tabName}] Manually refreshed state from localStorage`);
  }, [tabName]);

  const totalMinor = items.reduce((sum, item) => sum + item.priceMinor, 0);

  return {
    items,
    totalMinor,
    addItem,
    removeItem,
    resetCart,
    refreshTab,
    lastEvent
  };
}
