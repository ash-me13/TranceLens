import React, { useState } from 'react';
import type { Mode } from '@stateghost/shared';
import { X, ArrowRightLeft, Layers, Laptop, Sparkles } from 'lucide-react';

interface NewInvestigationModalProps {
  initialMode?: Mode;
  onClose: () => void;
  onCreate: (title: string, mode: Mode) => Promise<void>;
}

export function NewInvestigationModal({ initialMode = 'state', onClose, onCreate }: NewInvestigationModalProps) {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Investigation title is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onCreate(title.trim(), mode);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create investigation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400" />
            <span>New Investigation</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Investigation Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Cart total differs across two tabs"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Investigation Mode
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <label
                onClick={() => setMode('state')}
                className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition ${
                  mode === 'state'
                    ? 'bg-slate-800 border-teal-500 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input type="radio" name="mode" checked={mode === 'state'} onChange={() => setMode('state')} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white">State Conflicts</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    "Why does my app contradict itself?" Trace gaps between interface and memory.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setMode('request')}
                className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition ${
                  mode === 'request'
                    ? 'bg-slate-800 border-teal-500 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input type="radio" name="mode" checked={mode === 'request'} onChange={() => setMode('request')} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white">Request Detective</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    "Where did my button click go?" Trace one user action through HAR and logs.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setMode('setup')}
                className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition ${
                  mode === 'setup'
                    ? 'bg-slate-800 border-teal-500 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input type="radio" name="mode" checked={mode === 'setup'} onChange={() => setMode('setup')} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white">Setup Forensics</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    "It works on their laptop. Why not mine?" Compare environments deterministically.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Investigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
