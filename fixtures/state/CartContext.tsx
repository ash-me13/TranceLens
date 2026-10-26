import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  name: string;
  priceMinor: number; // integer minor units (e.g. 1999 for $19.99)
}

interface CartContextType {
  items: CartItem[];
  totalMinor: number;
  addItem: (item: CartItem) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function BuggyCartProvider({ children }: { children: React.ReactNode }) {
  // BUG A: Initial state read from localStorage once on mount, but NO window 'storage' listener!
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('demo_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const totalMinor = items.reduce((sum, item) => sum + item.priceMinor, 0);

  const addItem = (item: CartItem) => {
    const next = [...items, item];
    setItems(next);
    localStorage.setItem('demo_cart', JSON.stringify(next));
    // Notice: Window storage events do NOT fire in the document that made the change.
    // In buggy mode, other tabs have no listener and retain stale in-memory state.
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem('demo_cart');
  };

  return (
    <CartContext.Provider value={{ items, totalMinor, addItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function FixedCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('demo_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const totalMinor = items.reduce((sum, item) => sum + item.priceMinor, 0);

  // FIXED: Synchronizes when other tabs update localStorage!
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'demo_cart') {
        try {
          const next = e.newValue ? JSON.parse(e.newValue) : [];
          setItems(next);
        } catch {
          // ignore corrupted JSON
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addItem = (item: CartItem) => {
    const next = [...items, item];
    setItems(next);
    localStorage.setItem('demo_cart', JSON.stringify(next));
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem('demo_cart');
  };

  return (
    <CartContext.Provider value={{ items, totalMinor, addItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}
