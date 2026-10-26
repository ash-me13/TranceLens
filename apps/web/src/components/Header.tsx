import React, { useState, useEffect } from 'react';
import { Zap, LayoutGrid, Plus, Settings as SettingsIcon, Flame, Cpu, Eye } from 'lucide-react';
import type { ModelStatus } from '@tracelens/shared';

interface HeaderProps {
  currentView: 'dashboard' | 'investigation' | 'settings' | 'demo';
  onNavigate: (view: 'dashboard' | 'investigation' | 'settings' | 'demo') => void;
  onNewInvestigation: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onNewInvestigation }) => {
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);

  useEffect(() => {
    fetch('/api/model/status')
      .then(res => res.json())
      .then(data => setModelStatus(data))
      .catch(() => {});
  }, [currentView]);

  return (
    <header className="fixed top-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md shadow-2xl z-40 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
        {/* Brand */}
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-white tracking-tight">TraceLens</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-teal-400 border border-teal-800/40">
                Gemma 4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">
              Find where your app's story breaks.
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              currentView === 'dashboard'
                ? 'bg-slate-800 text-teal-300 border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <button
            onClick={onNewInvestigation}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg transition shadow-sm shadow-teal-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation</span>
          </button>

          <button
            onClick={() => onNavigate('demo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              currentView === 'demo'
                ? 'bg-slate-800 text-amber-300 border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Demo Lab</span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              currentView === 'settings'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Model Status Pill */}
          <button
            onClick={() => onNavigate('settings')}
            className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs font-mono"
            title="Inspect local Gemma 4 connection"
          >
            <span className={`w-2 h-2 rounded-full ${modelStatus?.available ? 'bg-teal-400 animate-pulse' : 'bg-rose-400'}`}></span>
            <span className="text-slate-300 text-[11px]">{modelStatus?.selectedModel || 'gemma4:e4b'}</span>
            {modelStatus?.imageInput && (
              <span className="text-[10px] text-teal-400 bg-teal-950 px-1 py-0.5 rounded border border-teal-800 flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" /> Vision
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;