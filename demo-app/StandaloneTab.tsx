import React, { useState } from 'react';
import { CATALOG, formatMoney } from './types';
import { useDemoCart, getStoredCart } from './cart-store';
import { RotateCcw, ExternalLink } from 'lucide-react';

export function StandaloneTab({ tab }: { tab: 'Tab A' | 'Tab B' }) {
  const [isFixed, setIsFixed] = useState(false);
  const cart = useDemoCart(tab, isFixed);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col justify-between font-sans">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h1 className="text-xl font-black text-white">{tab}</h1>
            <p className="text-xs text-slate-400">StateGhost Real Browser Window Test</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-teal-400 font-mono">
              {formatMoney(cart.totalMinor)}
            </div>
            <div className="text-[10px] text-slate-400">Total in Minor Units: {cart.totalMinor}</div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs">
          <span>Mode:</span>
          <button
            onClick={() => setIsFixed(!isFixed)}
            className={`px-2.5 py-1 rounded font-bold transition ${
              isFixed ? 'bg-teal-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {isFixed ? 'Fixed (Listening)' : 'Buggy (Stale Memory)'}
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">In-Memory Cart Items ({cart.items.length}):</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {cart.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-slate-900 rounded border border-slate-800 text-xs">
                <span>{item.name}</span>
                <span className="font-mono text-slate-400">{formatMoney(item.priceMinor)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-slate-300">Add Item:</div>
          <div className="grid grid-cols-2 gap-2">
            {CATALOG.slice(1).map(cat => (
              <button
                key={cat.id}
                onClick={() => cart.addItem(cat)}
                className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition text-left truncate"
              >
                + {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Storage: {formatMoney(getStoredCart().reduce((s, i) => s + i.priceMinor, 0))}
          </span>
          <button
            onClick={cart.refreshTab}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-500 text-white rounded font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Refresh Tab
          </button>
        </div>
        <div className="text-[11px] text-slate-500 font-mono truncate">{cart.lastEvent}</div>
      </div>
    </div>
  );
}
