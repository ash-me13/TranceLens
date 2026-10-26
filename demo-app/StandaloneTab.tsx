import React, { useState } from 'react';
import { CATALOG, formatMoney } from './types';
import { useDemoCart, getStoredCart } from './cart-store';
import { RotateCcw } from 'lucide-react';

export function StandaloneTab({ tab }: { tab: 'Tab A' | 'Tab B' }) {
  const [isFixed, setIsFixed] = useState(false);
  const cart = useDemoCart(tab, isFixed);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 flex flex-col justify-between font-sans selection:bg-teal-500/25 selection:text-teal-200">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">{tab}</h1>
            <p className="text-xs text-slate-400">TraceLens Real Browser Window Test</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-teal-400 font-mono tracking-tight">
              {formatMoney(cart.totalMinor)}
            </div>
            <div className="text-[10px] text-slate-400">Total in Minor Units: {cart.totalMinor}</div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#0e1626] p-3 rounded-xl border border-white/[0.08] text-xs shadow-sm">
          <span className="font-medium text-slate-300">Mode:</span>
          <button
            onClick={() => setIsFixed(!isFixed)}
            className={`px-3 py-1 rounded-lg font-bold transition-all shadow-sm active:scale-95 ${
              isFixed
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {isFixed ? 'Fixed (Listening)' : 'Buggy (Stale Memory)'}
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">In-Memory Cart Items ({cart.items.length}):</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {cart.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2.5 bg-[#0e1626] rounded-xl border border-white/[0.06] text-xs">
                <span>{item.name}</span>
                <span className="font-mono text-slate-400">{formatMoney(item.priceMinor)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-white/[0.08] space-y-2">
          <div className="text-xs font-semibold text-slate-300">Add Item:</div>
          <div className="grid grid-cols-2 gap-2">
            {CATALOG.slice(1).map(cat => (
              <button
                key={cat.id}
                onClick={() => cart.addItem(cat)}
                className="px-3 py-2 text-xs bg-[#151f33] hover:bg-[#1b2740] text-slate-200 border border-white/[0.08] rounded-xl transition-all text-left truncate active:scale-95"
              >
                + {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/[0.08] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Storage: {formatMoney(getStoredCart().reduce((s, i) => s + i.priceMinor, 0))}
          </span>
          <button
            onClick={cart.refreshTab}
            className="btn-primary-human flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-xl active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Refresh Tab
          </button>
        </div>
        <div className="text-[11px] text-slate-500 font-mono truncate">{cart.lastEvent}</div>
      </div>
    </div>
  );
}
