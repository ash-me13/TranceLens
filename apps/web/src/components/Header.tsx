import React, { useState, useEffect } from 'react';
import { Zap, LayoutGrid, Plus, Settings as SettingsIcon, Flame, Eye } from 'lucide-react';
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
    <header className="fixed top-0 left-0 right-0 bg-[#090d16]/85 backdrop-blur-xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] z-40 border-b border-white/[0.07]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
        {/* Brand */}
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/10 border border-teal-500/30 flex items-center justify-center group-hover:scale-105 group-hover:shadow-[0_0_15px_-3px_rgba(20,184,166,0.35)] transition-all">
            <Zap className="w-5 h-5 text-teal-400 group-hover:text-teal-300 transition-colors" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-white tracking-tight">TraceLens</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-950/60 text-teal-300 border border-teal-500/30">
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
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              currentView === 'dashboard'
                ? 'bg-slate-850 text-teal-300 border border-teal-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <button
            onClick={onNewInvestigation}
            className="btn-primary-human flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation</span>
          </button>

          <button
            onClick={() => onNavigate('demo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              currentView === 'demo'
                ? 'bg-slate-850 text-amber-300 border border-amber-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Demo Lab</span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              currentView === 'settings'
                ? 'bg-slate-850 text-white border border-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Model Status Pill */}
          <button
            onClick={() => onNavigate('settings')}
            className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-xs font-mono transition-all"
            title="Inspect local Gemma 4 connection"
          >
            <span className={`w-2 h-2 rounded-full ${modelStatus?.available ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)] animate-pulse' : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`}></span>
            <span className="text-slate-300 text-[11px]">{modelStatus?.selectedModel || 'gemma4:e4b'}</span>
            {modelStatus?.imageInput && (
              <span className="text-[10px] text-teal-300 bg-teal-950/70 px-1.5 py-0.5 rounded-full border border-teal-500/30 flex items-center gap-0.5">
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