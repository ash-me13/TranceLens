import React, { useState, useEffect } from 'react';
import type { Investigation, Mode, ModelStatus } from '@stateghost/shared';
import {
  ArrowRightLeft,
  Layers,
  Laptop,
  Plus,
  PlayCircle,
  Clock,
  Trash2,
  Cpu,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Eye,
  Sparkles,
  ExternalLink,
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
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Local Gemma 4 Evidence-Grounded Debugger</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Find where your app's story breaks.
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            StateGhost investigates confusing software behavior using real screenshots, source code, network HAR files, logs, and environment manifests.
            Every claim is grounded in evidence—separating observed facts from model hypotheses.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setModalMode('state')}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-bold rounded-xl transition shadow-lg shadow-teal-500/20"
            >
              <Plus className="w-4 h-4" /> New Investigation
            </button>

            <button
              onClick={handleLoadSample}
              disabled={sampleLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 transition"
              title="Loads recorded sample with visible label"
            >
              <PlayCircle className="w-4 h-4 text-teal-400" />
              <span>{sampleLoading ? 'Loading Sample...' : 'Load Sample Investigation'}</span>
            </button>

            <button
              onClick={onOpenDemoLab}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl border border-slate-700 transition"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Open Demo Lab</span>
            </button>
          </div>
        </div>

        {/* Local Model Status Pill in Hero Corner */}
        <div className="absolute top-6 right-6 hidden md:block">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 rounded-lg text-xs transition"
          >
            <span className={`w-2 h-2 rounded-full ${modelStatus?.available ? 'bg-teal-400 animate-pulse' : 'bg-rose-400'}`}></span>
            <span className="text-slate-300 font-mono text-[11px]">{modelStatus?.selectedModel || 'gemma4:e4b'}</span>
            <span className="text-slate-500 text-[10px]">({modelStatus?.available ? 'Ready' : 'Offline'})</span>
          </button>
        </div>
      </div>

      {/* The 5-Layer Rigor Distinction Strip */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
        <div className="p-2.5 rounded-lg bg-teal-950/40 border border-teal-500/30">
          <div className="font-bold text-teal-300 flex items-center justify-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Observed Facts
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Verified via code, logs & screenshots</div>
        </div>
        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30">
          <div className="font-bold text-amber-300 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Interpretations
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Model inferences, never raw truth</div>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
          <div className="font-bold text-slate-200 flex items-center justify-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" /> Hypotheses
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Ranked competing explanations</div>
        </div>
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30">
          <div className="font-bold text-rose-300 flex items-center justify-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Missing Info
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Explicit gaps & blindspots requested</div>
        </div>
        <div className="p-2.5 rounded-lg bg-teal-950/40 border border-teal-500/30 col-span-2 sm:col-span-1">
          <div className="font-bold text-teal-300 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Test Outcomes
          </div>
          <div className="text-[10px] text-slate-400 mt-1">User-reported test results update causes</div>
        </div>
      </div>

      {/* 3 Investigation Mode Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Select Investigation Mode
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Mode 1: State Conflicts */}
          <div
            onClick={() => setModalMode('state')}
            className="group cursor-pointer bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-6 transition-all shadow-lg hover:shadow-teal-500/10 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                  State Conflicts
                </h3>
                <p className="text-xs font-semibold text-teal-400/90 mt-0.5">
                  "Why does my app contradict itself?"
                </p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Map conflicting state across UI, React memory, browser storage, and server API. Uses interactive React Flow graph to diagnose stale caches and split stores.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-teal-400">
              <span>Start Investigation</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Mode 2: Request Detective */}
          <div
            onClick={() => setModalMode('request')}
            className="group cursor-pointer bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-6 transition-all shadow-lg hover:shadow-teal-500/10 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                  Request Detective
                </h3>
                <p className="text-xs font-semibold text-teal-400/90 mt-0.5">
                  "Where did my button click go?"
                </p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Follow one user action from click handler through network dispatch, HAR entries, backend log correlation, and frontend spinner cleanup.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-teal-400">
              <span>Start Investigation</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Mode 3: Setup Forensics */}
          <div
            onClick={() => setModalMode('setup')}
            className="group cursor-pointer bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-6 transition-all shadow-lg hover:shadow-teal-500/10 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                  Setup Forensics
                </h3>
                <p className="text-xs font-semibold text-teal-400/90 mt-0.5">
                  "Why does it work on their laptop?"
                </p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Side-by-side deterministic environment checks: Node engines semver compatibility, lockfile mismatches, missing required env variables, and port collisions.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-teal-400">
              <span>Start Investigation</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Investigations List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Recent Investigations</span>
          </h2>
          <span className="text-xs text-slate-500">{investigations.length} stored locally</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading investigations...</div>
        ) : investigations.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-3">
            <p className="text-sm text-slate-400">No investigations yet.</p>
            <p className="text-xs text-slate-500">
              Start a new investigation or click "Load Sample Investigation" above to explore a recorded example.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl divide-y divide-slate-800">
            {investigations.map(inv => (
              <div
                key={inv.id}
                onClick={() => onOpenInvestigation(inv.id)}
                className="p-4 hover:bg-slate-850 flex items-center justify-between cursor-pointer transition group"
              >
                <div className="flex items-center gap-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-md capitalize ${
                    inv.mode === 'state' ? 'bg-teal-950 text-teal-300 border border-teal-800' :
                    inv.mode === 'request' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                    'bg-blue-950 text-blue-300 border border-blue-800'
                  }`}>
                    {inv.mode}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors flex items-center gap-2">
                      <span>{inv.title}</span>
                      {inv.sample && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-normal">
                          Recorded Sample
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Last updated {new Date(inv.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleDelete(e, inv.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    title="Delete investigation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="text-slate-500 group-hover:text-teal-400 group-hover:translate-x-1 transition-transform">
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
