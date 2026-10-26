import React, { useState, useEffect } from 'react';
import type { Investigation, Mode, ModelStatus } from '@tracelens/shared';
import {
  ArrowRightLeft,
  Layers,
  Laptop,
  Plus,
  PlayCircle,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Eye,
  Sparkles,
  Flame
} from 'lucide-react';
import { NewInvestigationModal } from './NewInvestigationModal';

interface DashboardProps {
  onOpenInvestigation: (id: string) => void;
  onOpenDemoLab: () => void;
  onOpenSettings: () => void;
}

export function Dashboard({ onOpenInvestigation, onOpenDemoLab, onOpenSettings }: DashboardProps) {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<Mode | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  const fetchInvestigations = async () => {
    try {
      const res = await fetch('/api/investigations');
      const data = await res.json();
      setInvestigations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchModelStatus = async () => {
    try {
      const res = await fetch('/api/model/status');
      const data = await res.json();
      setModelStatus(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchInvestigations();
    fetchModelStatus();
  }, []);

  const handleCreateInvestigation = async (title: string, mode: Mode) => {
    const res = await fetch('/api/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, mode })
    });
    const inv = await res.json();
    onOpenInvestigation(inv.id);
  };

  const handleLoadSample = async () => {
    setSampleLoading(true);
    try {
      const res = await fetch('/api/samples', { method: 'POST' });
      const sample = await res.json();
      onOpenInvestigation(sample.id);
    } catch (err: any) {
      alert(`Failed to load sample: ${err.message}`);
    } finally {
      setSampleLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this investigation?')) return;
    await fetch(`/api/investigations/${id}`, { method: 'DELETE' });
    setInvestigations(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Hero Banner with Warm Ambient Glow */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0e1626]/95 via-[#0e1626]/85 to-teal-950/25 border border-white/[0.09] rounded-3xl p-8 sm:p-10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_20px_45px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {/* Soft background ambient gradient accent */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/30 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Local Gemma 4 Evidence-Grounded Debugger</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Find where your app's story breaks.
          </h1>

          <p className="text-slate-300/90 text-sm sm:text-base leading-relaxed">
            TraceLens investigates confusing software behavior using real screenshots, source code, network HAR files, logs, and environment manifests.
            Every claim is grounded in evidence—separating observed facts from model hypotheses.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setModalMode('state')}
              className="btn-primary-human flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl active:scale-95"
            >
              <Plus className="w-4 h-4" /> New Investigation
            </button>

            <button
              onClick={handleLoadSample}
              disabled={sampleLoading}
              className="btn-secondary-human flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl active:scale-95"
              title="Loads recorded sample with visible label"
            >
              <PlayCircle className="w-4 h-4 text-teal-400" />
              <span>{sampleLoading ? 'Loading Sample...' : 'Load Sample Investigation'}</span>
            </button>

            <button
              onClick={onOpenDemoLab}
              className="btn-secondary-human flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-amber-300 hover:text-amber-200 hover:border-amber-500/30 active:scale-95"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Open Demo Lab</span>
            </button>
          </div>
        </div>

        {/* Local Model Status Pill in Hero Corner */}
        <div className="absolute top-6 right-6 hidden md:block z-10">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#090d16]/80 hover:bg-[#151f33] border border-white/[0.08] hover:border-white/[0.15] rounded-xl text-xs backdrop-blur-md transition-all shadow-sm"
          >
            <span className={`w-2 h-2 rounded-full ${modelStatus?.available ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)] animate-pulse' : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`}></span>
            <span className="text-slate-200 font-mono text-[11px]">{modelStatus?.selectedModel || 'gemma4:e4b'}</span>
            <span className="text-slate-400 text-[10px]">({modelStatus?.available ? 'Ready' : 'Offline'})</span>
          </button>
        </div>
      </div>

      {/* The 5-Layer Rigor Distinction Strip */}
      <div className="bg-[#0e1626]/60 border border-white/[0.07] rounded-2xl p-3.5 sm:p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs backdrop-blur-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
        <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-500/25 hover:border-teal-500/40 transition-colors">
          <div className="font-bold text-teal-300 flex items-center justify-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-teal-400" /> Observed Facts
          </div>
          <div className="text-[11px] text-slate-400 mt-1 leading-snug">Verified via code, logs & screenshots</div>
        </div>
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/25 hover:border-amber-500/40 transition-colors">
          <div className="font-bold text-amber-300 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Interpretations
          </div>
          <div className="text-[11px] text-slate-400 mt-1 leading-snug">Model inferences, never raw truth</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-800/40 border border-white/[0.08] hover:border-white/[0.15] transition-colors">
          <div className="font-bold text-slate-200 flex items-center justify-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Hypotheses
          </div>
          <div className="text-[11px] text-slate-400 mt-1 leading-snug">Ranked competing explanations</div>
        </div>
        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/25 hover:border-rose-500/40 transition-colors">
          <div className="font-bold text-rose-300 flex items-center justify-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Missing Info
          </div>
          <div className="text-[11px] text-slate-400 mt-1 leading-snug">Explicit gaps & blindspots requested</div>
        </div>
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/25 hover:border-emerald-500/40 transition-colors col-span-2 sm:col-span-1">
          <div className="font-bold text-emerald-300 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Test Outcomes
          </div>
          <div className="text-[11px] text-slate-400 mt-1 leading-snug">User-reported test results update causes</div>
        </div>
      </div>

      {/* 3 Investigation Mode Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1">
          Select Investigation Mode
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Mode 1: State Conflicts */}
          <div
            onClick={() => setModalMode('state')}
            className="group cursor-pointer bg-[#0e1626]/75 hover:bg-[#121c30]/90 border border-white/[0.08] hover:border-teal-500/40 rounded-2xl p-6 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_25px_-5px_rgba(0,0,0,0.35)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_16px_36px_-8px_rgba(20,184,166,0.15)] hover:-translate-y-0.5 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center group-hover:scale-105 group-hover:bg-teal-500/15 group-hover:shadow-[0_0_15px_-3px_rgba(20,184,166,0.3)] transition-all">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                  State Conflicts
                </h3>
                <p className="text-xs font-semibold text-teal-300/90 mt-0.5">
                  "Why does my app contradict itself?"
                </p>
              </div>
              <p className="text-xs text-slate-300/80 leading-relaxed">
                Map conflicting state across UI, React memory, browser storage, and server API. Uses interactive React Flow graph to diagnose stale caches and split stores.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-teal-400">
              <span>Start Investigation</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Mode 2: Request Detective */}
          <div
            onClick={() => setModalMode('request')}
            className="group cursor-pointer bg-[#0e1626]/75 hover:bg-[#121c30]/90 border border-white/[0.08] hover:border-amber-500/40 rounded-2xl p-6 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_25px_-5px_rgba(0,0,0,0.35)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_16px_36px_-8px_rgba(245,158,11,0.15)] hover:-translate-y-0.5 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-105 group-hover:bg-amber-500/15 group-hover:shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)] transition-all">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Request Detective
                </h3>
                <p className="text-xs font-semibold text-amber-300/90 mt-0.5">
                  "Where did my button click go?"
                </p>
              </div>
              <p className="text-xs text-slate-300/80 leading-relaxed">
                Follow one user action from click handler through network dispatch, HAR entries, backend log correlation, and frontend spinner cleanup.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-amber-400">
              <span>Start Investigation</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Mode 3: Setup Forensics */}
          <div
            onClick={() => setModalMode('setup')}
            className="group cursor-pointer bg-[#0e1626]/75 hover:bg-[#121c30]/90 border border-white/[0.08] hover:border-indigo-500/40 rounded-2xl p-6 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_25px_-5px_rgba(0,0,0,0.35)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_16px_36px_-8px_rgba(99,102,241,0.15)] hover:-translate-y-0.5 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 group-hover:bg-indigo-500/15 group-hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-all">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Setup Forensics
                </h3>
                <p className="text-xs font-semibold text-indigo-300/90 mt-0.5">
                  "Why does it work on their laptop?"
                </p>
              </div>
              <p className="text-xs text-slate-300/80 leading-relaxed">
                Side-by-side deterministic environment checks: Node engines semver compatibility, lockfile mismatches, missing required env variables, and port collisions.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-indigo-400">
              <span>Start Investigation</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Investigations List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pl-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Recent Investigations</span>
          </h2>
          <span className="text-xs text-slate-400">{investigations.length} stored locally</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading investigations...</div>
        ) : investigations.length === 0 ? (
          <div className="p-12 text-center bg-[#0e1626]/50 border border-white/[0.07] rounded-2xl space-y-3 backdrop-blur-md">
            <p className="text-sm font-semibold text-slate-300">No investigations yet.</p>
            <p className="text-xs text-slate-400">
              Start a new investigation or click "Load Sample Investigation" above to explore a recorded example.
            </p>
          </div>
        ) : (
          <div className="bg-[#0e1626]/75 border border-white/[0.08] rounded-2xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_25px_-5px_rgba(0,0,0,0.35)] divide-y divide-white/[0.06] backdrop-blur-lg">
            {investigations.map(inv => (
              <div
                key={inv.id}
                onClick={() => onOpenInvestigation(inv.id)}
                className="p-4 sm:p-4.5 hover:bg-white/[0.03] flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-md capitalize ${
                    inv.mode === 'state' ? 'bg-teal-950/70 text-teal-300 border border-teal-500/30' :
                    inv.mode === 'request' ? 'bg-amber-950/70 text-amber-300 border border-amber-500/30' :
                    'bg-indigo-950/70 text-indigo-300 border border-indigo-500/30'
                  }`}>
                    {inv.mode}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors flex items-center gap-2">
                      <span>{inv.title}</span>
                      {inv.sample && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                          Recorded Sample
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Last updated {new Date(inv.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleDelete(e, inv.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Delete investigation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="text-slate-400 group-hover:text-teal-400 group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalMode && (
        <NewInvestigationModal
          initialMode={modalMode}
          onClose={() => setModalMode(null)}
          onCreate={handleCreateInvestigation}
        />
      )}
    </div>
  );
}
