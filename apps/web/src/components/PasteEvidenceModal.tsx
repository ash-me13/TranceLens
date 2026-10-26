import React, { useState } from 'react';
import type { EvidenceKind } from '@stateghost/shared';
import { X, Code, Terminal, Network, FileText, CheckCircle2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Code className="w-5 h-5 text-teal-400" />
            <span>Paste Evidence</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Filename / Label</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Cart.tsx or browser.log"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Evidence Kind</label>
              <select
                value={kind}
                onChange={e => setKind(e.target.value as EvidenceKind)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="source">Source Code</option>
                <option value="log">Log Output</option>
                <option value="har">HAR Network Export</option>
                <option value="manifest">package.json Manifest</option>
                <option value="lockfile">Lockfile</option>
                <option value="runtime">Runtime / Node Versions</option>
                <option value="env">Environment Variables (.env)</option>
                <option value="instructions">Setup Instructions</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Source Label</label>
              <input
                type="text"
                value={sourceLabel}
                onChange={e => setSourceLabel(e.target.value)}
                placeholder="e.g. Tab A, Working machine, Frontend"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Optional Event Timestamp</label>
              <input
                type="text"
                value={userTimestamp}
                onChange={e => setUserTimestamp(e.target.value)}
                placeholder="e.g. 2026-10-26T10:00:15Z"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">Content</label>
              <span className="text-[11px] text-slate-400">Common secrets automatically redacted locally</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              placeholder="Paste code snippet, log events, or HAR json here..."
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg font-mono text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
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
              {loading ? 'Adding...' : 'Add Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
