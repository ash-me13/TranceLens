export interface DemoCartItem {
  id: string;
  name: string;
  priceMinor: number; // In minor units (cents)
  category: string;
}

export const CATALOG: DemoCartItem[] = [
  { id: 'kb-1', name: 'Ergonomic Mechanical Keyboard', priceMinor: 14900, category: 'Hardware' },
  { id: 'ms-1', name: 'Precision Wireless Mouse', priceMinor: 7900, category: 'Hardware' },
  { id: 'cb-1', name: 'Braided USB-C Cable (2m)', priceMinor: 1900, category: 'Accessories' },
  { id: 'pad-1', name: 'Desk Mat (Extended Dark)', priceMinor: 2900, category: 'Accessories' }
];

export function formatMoney(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}
