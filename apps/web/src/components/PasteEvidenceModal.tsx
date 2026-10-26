import React, { useState } from 'react';
import type { EvidenceKind } from '@tracelens/shared';
import { X, Code } from 'lucide-react';

interface PasteEvidenceModalProps {
  onClose: () => void;
  onSave: (payload: { displayName: string; kind: EvidenceKind; sourceLabel: string; content: string; userTimestamp?: string }) => Promise<void>;
}

export function PasteEvidenceModal({ onClose, onSave }: PasteEvidenceModalProps) {
  const [displayName, setDisplayName] = useState('snippet.tsx');
  const [kind, setKind] = useState<EvidenceKind>('source');
  const [sourceLabel, setSourceLabel] = useState('Tab A code');
  const [userTimestamp, setUserTimestamp] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !content.trim()) {
      setError('Display name and content are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSave({
        displayName: displayName.trim(),
        kind,
        sourceLabel: sourceLabel.trim() || 'Developer supplied',
        userTimestamp: userTimestamp.trim() || undefined,
        content
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add evidence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0e1626] border border-white/[0.1] rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_25px_50px_-12px_rgba(0,0,0,0.7)] max-w-2xl w-full overflow-hidden">
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Code className="w-5 h-5 text-teal-400" />
            <span>Paste Evidence</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Filename / Label</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Cart.tsx or browser.log"
                className="w-full px-3.5 py-2.5 bg-[#090d16] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/80 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Evidence Kind</label>
              <select
                value={kind}
                onChange={e => setKind(e.target.value as EvidenceKind)}
                className="w-full px-3.5 py-2.5 bg-[#090d16] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/80 transition-all cursor-pointer"
              >
                <option value="source" className="bg-slate-900 text-white">Source Code</option>
                <option value="log" className="bg-slate-900 text-white">Log Output</option>
                <option value="har" className="bg-slate-900 text-white">HAR Network Export</option>
                <option value="manifest" className="bg-slate-900 text-white">package.json Manifest</option>
                <option value="lockfile" className="bg-slate-900 text-white">Lockfile</option>
                <option value="runtime" className="bg-slate-900 text-white">Runtime / Node Versions</option>
                <option value="env" className="bg-slate-900 text-white">Environment Variables (.env)</option>
                <option value="instructions" className="bg-slate-900 text-white">Setup Instructions</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Source Label</label>
              <input
                type="text"
                value={sourceLabel}
                onChange={e => setSourceLabel(e.target.value)}
                placeholder="e.g. Tab A, Working machine, Frontend"
                className="w-full px-3.5 py-2.5 bg-[#090d16] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/80 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Optional Event Timestamp</label>
              <input
                type="text"
                value={userTimestamp}
                onChange={e => setUserTimestamp(e.target.value)}
                placeholder="e.g. 2026-10-26T10:00:15Z"
                className="w-full px-3.5 py-2.5 bg-[#090d16] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/80 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">Content</label>
              <span className="text-[11px] text-slate-400">Common secrets automatically redacted locally</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              placeholder="Paste code snippet, log events, or HAR json here..."
              className="w-full p-3.5 bg-[#090d16] border border-white/[0.1] rounded-xl font-mono text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/80 transition-all"
            />
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary-human px-4 py-2 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-human px-5 py-2 text-xs font-bold rounded-xl disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
