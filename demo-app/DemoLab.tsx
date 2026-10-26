import React, { useState, useEffect } from 'react';
import {
  Layers,
  ArrowRightLeft,
  UserCheck,
  ShoppingCart,
  Send,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sparkles,
  Info
} from 'lucide-react';
import { CATALOG, formatMoney, DemoCartItem } from './types';
import {
  useDemoCart,
  getStoredCart,
  saveStoredCart,
  CART_STORAGE_KEY,
  CHECKOUT_STALE_KEY,
  PROFILE_STORAGE_KEY
} from './cart-store';
import { getTabStateEvidence, getRequestDetectiveEvidence } from './evidence';

interface DemoLabProps {
  onOpenInvestigation?: (id: string) => void;
}

export function DemoLab({ onOpenInvestigation }: DemoLabProps) {
  const [activeScenario, setActiveScenario] = useState<'cart-sync' | 'profile-save' | 'cart-checkout' | 'order-request'>('cart-sync');

  // Scenario A: Cross-tab sync
  const [isBugAFixed, setIsBugAFixed] = useState(false);
  const tabA = useDemoCart('Tab A', isBugAFixed);
  const tabB = useDemoCart('Tab B', isBugAFixed);
  const [popupBlocked, setPopupBlocked] = useState(false);

  // Scenario B: Optimistic Profile Save
  const [isBugBFixed, setIsBugBFixed] = useState(false);
  const [profileName, setProfileName] = useState(() => localStorage.getItem(PROFILE_STORAGE_KEY) || 'Alex Rivers');
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [profileError, setProfileError] = useState('');

  // Scenario C: Separate State Sources (Cart vs Checkout)
  const [isBugCFixed, setIsBugCFixed] = useState(false);
  const [cartPageItems, setCartPageItems] = useState<DemoCartItem[]>([CATALOG[0]]);
  const [checkoutItems, setCheckoutItems] = useState<DemoCartItem[]>(() => {
    // In buggy mode, checkout reads from stale key or empty initial state
    return [];
  });

  // Scenario: Request Detective Order Failure
  const [isRequestFixed, setIsRequestFixed] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<{ status?: number; error?: string; requestId?: string } | null>(null);

  // Evidence creation status
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Synchronize storage on mount
  useEffect(() => {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      saveStoredCart([CATALOG[0]]);
    }
  }, []);

  // Bug A: Open Tab A & Tab B in real browser windows
  const openExternalTab = (tab: 'a' | 'b') => {
    const url = `${window.location.origin}/#demo-tab-${tab}`;
    const w = window.open(url, `_blank`, 'width=520,height=640');
    if (!w || w.closed || typeof w.closed === 'undefined') {
      setPopupBlocked(true);
    } else {
      setPopupBlocked(false);
    }
  };

  // Bug B: Save profile handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBugBFixed) {
      // BUGGY: Optimistically marks "Saved" without waiting or error handling
      setProfileStatus('saved');
      setProfileError('');
      try {
        // Simulated endpoint failure
        await fetch('/api/demo/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: profileName })
        });
      } catch {
        // Ignored; UI falsely shows "Saved", but refresh restores old state
      }
    } else {
      // FIXED: Shows saving, handles error properly, preserves state honesty
      setProfileStatus('saving');
      setProfileError('');
      try {
        const res = await fetch('/api/demo/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: profileName })
        });
        if (!res.ok) {
          throw new Error('Server returned HTTP 500: Database lock timeout');
        }
        localStorage.setItem(PROFILE_STORAGE_KEY, profileName);
        setProfileStatus('saved');
      } catch (err: any) {
        setProfileStatus('error');
        setProfileError(err.message || 'Failed to save profile. Persistence failed.');
      }
    }
  };

  // Bug C: Add item to cart page
  const handleAddCartItemC = (item: DemoCartItem) => {
    const next = [...cartPageItems, item];
    setCartPageItems(next);
    if (isBugCFixed) {
      // Authoritative unified source
      setCheckoutItems(next);
      localStorage.setItem('tracelens_demo_c_shared', JSON.stringify(next));
    } else {
      // Buggy: Checkout uses isolated stale storage
      localStorage.setItem('tracelens_demo_c_cart_only', JSON.stringify(next));
    }
  };

  // Request Detective: Place Order
  const handlePlaceOrder = async () => {
    setOrderLoading(true);
    setOrderResult(null);
    const requestId = `req-order-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch('/api/demo/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!isBugFixed) {
          // BUGGY: Loader never cleared! isLoading remains true indefinitely!
          setOrderResult({ status: res.status, error: 'Request returned 500 but frontend missed catch/finally!', requestId });
          return;
        } else {
          // FIXED: Loading cleaned up, error displayed
          setOrderLoading(false);
          setOrderResult({ status: res.status, error: data.error || 'Demo inventory service unavailable', requestId });
        }
      } else {
        setOrderLoading(false);
        setOrderResult({ status: 200, requestId });
      }
    } catch (err: any) {
      if (!isBugFixed) {
        // Loader never cleared
        setOrderResult({ error: 'Network error; spinner stuck', requestId });
      } else {
        setOrderLoading(false);
        setOrderResult({ error: err.message, requestId });
      }
    }
  };

  const isBugFixed = isRequestFixed;

  // Global demo reset
  const handleResetDemo = async () => {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(CHECKOUT_STALE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem('tracelens_demo_c_shared');
    localStorage.removeItem('tracelens_demo_c_cart_only');
    tabA.resetCart();
    tabB.resetCart();
    setCartPageItems([CATALOG[0]]);
    setCheckoutItems([]);
    setProfileName('Alex Rivers');
    setProfileStatus('idle');
    setProfileError('');
    setOrderLoading(false);
    setOrderResult(null);
    await fetch('/api/demo/reset', { method: 'POST' }).catch(() => {});
    setExportSuccess('Demo state reset to clean baseline.');
    setTimeout(() => setExportSuccess(null), 3500);
  };

  // Pipe demo evidence directly into TraceLens
  const handleExportToInvestigation = async () => {
    setExporting(true);
    try {
      if (activeScenario === 'cart-sync') {
        const evidence = getTabStateEvidence(tabA.items, tabB.items, isBugAFixed);
        const res = await fetch('/api/investigations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Cart contradiction: Tab A (${formatMoney(evidence.tabATotal)}) vs Tab B (${formatMoney(evidence.tabBTotal)})`,
            mode: 'state'
          })
        });
        const inv = await res.json();

        // Upload log
        await fetch(`/api/investigations/${inv.id}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: 'browser-tabs.log',
            kind: 'log',
            sourceLabel: 'Demo browser state',
            content: evidence.logContent
          })
        });

        // Upload source code
        await fetch(`/api/investigations/${inv.id}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: 'CartContext.tsx',
            kind: 'source',
            sourceLabel: 'Cart state component',
            content: evidence.sourceCode
          })
        });

        setExportSuccess(`Created investigation: "${inv.title}". Opening...`);
        if (onOpenInvestigation) {
          setTimeout(() => onOpenInvestigation(inv.id), 1200);
        }
      } else if (activeScenario === 'order-request') {
        const reqId = orderResult?.requestId || 'req-order-98234';
        const evidence = getRequestDetectiveEvidence(reqId, 500, isRequestFixed);

        const res = await fetch('/api/investigations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Button click order failure: HTTP 500 with ${isRequestFixed ? 'proper error display' : 'stuck loading spinner'}`,
            mode: 'request'
          })
        });
        const inv = await res.json();

        await fetch(`/api/investigations/${inv.id}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: 'network-order.har',
            kind: 'har',
            sourceLabel: 'Browser network export',
            content: evidence.harContent
          })
        });

        await fetch(`/api/investigations/${inv.id}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: 'frontend-order.log',
            kind: 'log',
            sourceLabel: 'Frontend logger',
            content: evidence.frontendLog
          })
        });

        setExportSuccess(`Created investigation: "${inv.title}". Opening...`);
        if (onOpenInvestigation) {
          setTimeout(() => onOpenInvestigation(inv.id), 1200);
        }
      } else {
        setExportSuccess('Demo evidence collected. Create an investigation to analyze.');
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-full">
                Interactive Playground
              </span>
              <h2 className="text-xl font-bold text-white">TraceLens Demo Lab</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Reproduce real-world state synchronization bugs, lost requests, and environment mismatches.
              Toggle between <span className="text-rose-400 font-medium">Buggy Mode</span> and{' '}
              <span className="text-teal-400 font-medium">Fixed Mode</span> to observe the divergence in state and behavior.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetDemo}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
              title="Reset all demo storage keys and states"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" /> Reset Demo State
            </button>
            <button
              onClick={handleExportToInvestigation}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {exporting ? 'Sending...' : 'Send Evidence to TraceLens'}
            </button>
          </div>
        </div>

        {exportSuccess && (
          <div className="mt-4 p-3 bg-teal-950/60 border border-teal-500/40 rounded-lg flex items-center gap-2 text-teal-300 text-sm">
            <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>{exportSuccess}</span>
          </div>
        )}
      </div>

      {/* Scenario Selector Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveScenario('cart-sync')}
          className={`p-4 rounded-xl text-left border transition-all ${
            activeScenario === 'cart-sync'
              ? 'bg-slate-800/90 border-teal-500/50 shadow-md ring-1 ring-teal-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <ArrowRightLeft className={`w-5 h-5 ${activeScenario === 'cart-sync' ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Bug A
            </span>
          </div>
          <div className="text-sm font-semibold text-white">Cross-Tab Cart Sync</div>
          <div className="text-xs text-slate-400 mt-1 line-clamp-2">Two tabs contradict each other when storage changes</div>
        </button>

        <button
          onClick={() => setActiveScenario('profile-save')}
          className={`p-4 rounded-xl text-left border transition-all ${
            activeScenario === 'profile-save'
              ? 'bg-slate-800/90 border-teal-500/50 shadow-md ring-1 ring-teal-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <UserCheck className={`w-5 h-5 ${activeScenario === 'profile-save' ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Bug B
            </span>
          </div>
          <div className="text-sm font-semibold text-white">Optimistic Profile Save</div>
          <div className="text-xs text-slate-400 mt-1 line-clamp-2">UI falsely says "Saved" despite API persistence failure</div>
        </button>

        <button
          onClick={() => setActiveScenario('cart-checkout')}
          className={`p-4 rounded-xl text-left border transition-all ${
            activeScenario === 'cart-checkout'
              ? 'bg-slate-800/90 border-teal-500/50 shadow-md ring-1 ring-teal-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className={`w-5 h-5 ${activeScenario === 'cart-checkout' ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Bug C
            </span>
          </div>
          <div className="text-sm font-semibold text-white">Two Separate Cart Sources</div>
          <div className="text-xs text-slate-400 mt-1 line-clamp-2">Cart page has items, but Checkout reports empty</div>
        </button>

        <button
          onClick={() => setActiveScenario('order-request')}
          className={`p-4 rounded-xl text-left border transition-all ${
            activeScenario === 'order-request'
              ? 'bg-slate-800/90 border-teal-500/50 shadow-md ring-1 ring-teal-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Layers className={`w-5 h-5 ${activeScenario === 'order-request' ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Request Mode
            </span>
          </div>
          <div className="text-sm font-semibold text-white">Order Failure & Stuck Spinner</div>
          <div className="text-xs text-slate-400 mt-1 line-clamp-2">HTTP 500 error leaves frontend spinner stuck forever</div>
        </button>
      </div>

      {/* Scenario Details Container */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        {/* SCENARIO A: CROSS-TAB CART SYNC */}
        {activeScenario === 'cart-sync' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Cross-Tab Cart Synchronization</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    isBugAFixed ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {isBugAFixed ? 'Fixed Mode (Listener Active)' : 'Buggy Mode (Stale Memory)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  In Buggy mode, Tab A updates localStorage, but Tab B retains stale in-memory state until manually refreshed.
                  Notice that the native window <code className="text-teal-300">storage</code> event does not fire in the tab making the change!
                </p>
              </div>

              {/* Buggy / Fixed Mode Toggle */}
              <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 flex-shrink-0">
                <button
                  onClick={() => setIsBugAFixed(false)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    !isBugAFixed ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buggy Mode
                </button>
                <button
                  onClick={() => setIsBugAFixed(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    isBugAFixed ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fixed Mode
                </button>
              </div>
            </div>

            {/* Real Tab Popups Controls */}
            <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Info className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Test in two real browser windows or side-by-side tabs below:</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openExternalTab('a')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-md transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Tab A in New Window
                </button>
                <button
                  onClick={() => openExternalTab('b')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-md transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Tab B in New Window
                </button>
              </div>
            </div>

            {popupBlocked && (
              <div className="p-3 bg-amber-950/60 border border-amber-500/50 rounded-lg text-amber-300 text-xs flex items-center justify-between">
                <span>Browser popup blocked. You can directly open these links in new tabs:</span>
                <div className="flex gap-2">
                  <a href="/#demo-tab-a" target="_blank" rel="noreferrer" className="underline hover:text-white">Tab A Link</a>
                  <a href="/#demo-tab-b" target="_blank" rel="noreferrer" className="underline hover:text-white">Tab B Link</a>
                </div>
              </div>
            )}

            {/* Side-by-side Interactive Simulation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TAB A */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
                    <span className="font-bold text-white text-sm">Browser Tab A (Active Modifier)</span>
                  </div>
                  <span className="text-base font-extrabold text-teal-400 font-mono">
                    {formatMoney(tabA.totalMinor)}
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  Current items in Tab A memory ({tabA.items.length}):
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {tabA.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800 text-xs">
                      <span className="text-slate-200">{item.name}</span>
                      <span className="text-slate-400 font-mono">{formatMoney(item.priceMinor)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Add Item in Tab A:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {CATALOG.slice(1).map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => tabA.addItem(cat)}
                        className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition text-left truncate"
                      >
                        + {cat.name} ({formatMoney(cat.priceMinor)})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono truncate">
                  Log: {tabA.lastEvent}
                </div>
              </div>

              {/* TAB B */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      tabA.totalMinor !== tabB.totalMinor ? 'bg-rose-400' : 'bg-teal-400'
                    }`}></span>
                    <span className="font-bold text-white text-sm">Browser Tab B (Observer)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-extrabold font-mono ${
                      tabA.totalMinor !== tabB.totalMinor ? 'text-rose-400' : 'text-teal-400'
                    }`}>
                      {formatMoney(tabB.totalMinor)}
                    </span>
                    {tabA.totalMinor !== tabB.totalMinor && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40">
                        DESYNC
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  Current items in Tab B memory ({tabB.items.length}):
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {tabB.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800 text-xs">
                      <span className="text-slate-200">{item.name}</span>
                      <span className="text-slate-400 font-mono">{formatMoney(item.priceMinor)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Storage state: {formatMoney(getStoredCart().reduce((s, i) => s + i.priceMinor, 0))}
                  </span>
                  <button
                    onClick={tabB.refreshTab}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-md transition shadow"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Refresh Tab B
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-mono truncate">
                  Log: {tabB.lastEvent}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO B: OPTIMISTIC PROFILE SAVE */}
        {activeScenario === 'profile-save' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Optimistic Profile Save Without Persistence</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    isBugBFixed ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {isBugBFixed ? 'Fixed Mode (Accurate Status)' : 'Buggy Mode (Silent Failure)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  In Buggy mode, editing profile immediately displays "Saved" in the UI even though the API call fails.
                  Refreshing the page reverts to the original persisted name!
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 flex-shrink-0">
                <button
                  onClick={() => setIsBugBFixed(false)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    !isBugBFixed ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buggy Mode
                </button>
                <button
                  onClick={() => setIsBugBFixed(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    isBugBFixed ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fixed Mode
                </button>
              </div>
            </div>

            <div className="max-w-md bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Developer Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={profileStatus === 'saving'}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                  >
                    {profileStatus === 'saving' ? 'Saving to Database...' : 'Save Profile'}
                  </button>

                  {profileStatus === 'saved' && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 bg-teal-950/80 border border-teal-500/40 px-2.5 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}

                  {profileStatus === 'error' && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-950/80 border border-rose-500/40 px-2.5 py-1 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5" /> {profileError}
                    </span>
                  )}
                </div>
              </form>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Persisted in DB: <strong>Alex Rivers</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    const saved = localStorage.getItem(PROFILE_STORAGE_KEY) || 'Alex Rivers';
                    setProfileName(saved);
                    setProfileStatus('idle');
                  }}
                  className="text-teal-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Simulate Page Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO C: TWO INCONSISTENT CART SOURCES */}
        {activeScenario === 'cart-checkout' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Two Inconsistent Cart State Sources</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    isBugCFixed ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {isBugCFixed ? 'Fixed Mode (Unified Flow)' : 'Buggy Mode (Split Sources)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  In Buggy mode, the Cart view and Checkout view read from two separate uncoordinated state sources.
                  Items added in Cart appear locally, while Checkout reports "Your cart is empty"!
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 flex-shrink-0">
                <button
                  onClick={() => setIsBugCFixed(false)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    !isBugCFixed ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buggy Mode
                </button>
                <button
                  onClick={() => setIsBugCFixed(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    isBugCFixed ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fixed Mode
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cart View */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white text-sm">Cart Page View</span>
                  <span className="text-sm font-mono text-teal-400 font-bold">
                    {formatMoney(cartPageItems.reduce((s, i) => s + i.priceMinor, 0))}
                  </span>
                </div>
                <div className="space-y-1">
                  {cartPageItems.map((item, i) => (
                    <div key={i} className="text-xs text-slate-300 flex justify-between bg-slate-900 p-2 rounded">
                      <span>{item.name}</span>
                      <span>{formatMoney(item.priceMinor)}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleAddCartItemC(CATALOG[1])}
                  className="w-full py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition"
                >
                  + Add Precision Wireless Mouse ($79.00)
                </button>
              </div>

              {/* Checkout View */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white text-sm">Checkout Page View</span>
                  <span className={`text-sm font-mono font-bold ${
                    checkoutItems.length ? 'text-teal-400' : 'text-rose-400'
                  }`}>
                    {formatMoney(checkoutItems.reduce((s, i) => s + i.priceMinor, 0))}
                  </span>
                </div>
                {checkoutItems.length === 0 ? (
                  <div className="p-4 bg-slate-900/60 rounded border border-rose-500/30 text-rose-300 text-xs text-center">
                    Your checkout cart is empty! (Source contradiction)
                  </div>
                ) : (
                  <div className="space-y-1">
                    {checkoutItems.map((item, i) => (
                      <div key={i} className="text-xs text-slate-300 flex justify-between bg-slate-900 p-2 rounded">
                        <span>{item.name}</span>
                        <span>{formatMoney(item.priceMinor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO: REQUEST DETECTIVE ORDER FAILURE */}
        {activeScenario === 'order-request' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Request Detective: Order Failure & Loading State</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    isRequestFixed ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {isRequestFixed ? 'Fixed Mode (Spinner Cleared + Error)' : 'Buggy Mode (Permanent Spinner)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Clicking "Place Order" calls <code className="text-teal-300">/api/demo/order</code>, which returns HTTP 500.
                  In Buggy mode, the frontend misses cleanup, leaving the loading spinner active forever.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 flex-shrink-0">
                <button
                  onClick={() => { setIsRequestFixed(false); setOrderLoading(false); setOrderResult(null); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    !isRequestFixed ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buggy Mode
                </button>
                <button
                  onClick={() => { setIsRequestFixed(true); setOrderLoading(false); setOrderResult(null); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    isRequestFixed ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fixed Mode
                </button>
              </div>
            </div>

            <div className="max-w-md bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-800 pb-2">
                <span>Order Total: <strong>$149.00</strong></span>
                <span className="font-mono text-slate-500">POST /api/demo/order</span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={orderLoading && !isRequestFixed}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg transition disabled:bg-slate-800 disabled:text-slate-500"
              >
                {orderLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <span>Place Order Now</span>
                )}
              </button>

              {orderResult && (
                <div className={`p-3 rounded-lg border text-xs space-y-1 ${
                  orderResult.status === 200
                    ? 'bg-teal-950/60 border-teal-500/40 text-teal-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {orderResult.status === 200 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>Status: HTTP {orderResult.status || 500}</span>
                  </div>
                  {orderResult.error && <div>{orderResult.error}</div>}
                  {orderResult.requestId && <div className="font-mono text-[11px] text-slate-400">Request ID: {orderResult.requestId}</div>}
                </div>
              )}

              {orderLoading && !isRequestFixed && (
                <div className="p-3 bg-amber-950/50 border border-amber-500/40 rounded-lg text-amber-300 text-xs">
                  <strong>Observed Bug:</strong> The server returned HTTP 500, but the frontend never cleared the spinner.
                  Button remains disabled and user is stuck.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
