import React, { useState, useEffect } from 'react';
import type { Evidence, Ref } from '@tracelens/shared';
import { X, Check, Edit2, ShieldAlert, FileText, Image as ImageIcon, Network, Terminal } from 'lucide-react';

interface EvidenceModalProps {
  evidence: Evidence;
  activeRef?: Ref | null;
  onClose: () => void;
  onUpdateObservations?: (eid: string, observations: Array<{ id: string; statement: string; verification: 'confirmed' | 'corrected' }>) => Promise<void>;
}

export function EvidenceModal({ evidence, activeRef, onClose, onUpdateObservations }: EvidenceModalProps) {
  const [editedStatements, setEditedStatements] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    evidence.observations.forEach(o => {
      initial[o.id] = o.statement;
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const handleConfirmObservation = async (obsId: string, isCorrected: boolean) => {
    if (!onUpdateObservations) return;
    setSaving(true);
    try {
      const payload = evidence.observations.map(o => {
        if (o.id === obsId) {
          return {
            id: o.id,
            statement: editedStatements[o.id] || o.statement,
            verification: (isCorrected ? 'corrected' : 'confirmed') as 'confirmed' | 'corrected'
          };
        }
        return {
          id: o.id,
          statement: o.statement,
          verification: (o.verification === 'unverified' ? 'confirmed' : o.verification) as 'confirmed' | 'corrected'
        };
      });
      await onUpdateObservations(evidence.id, payload);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const lines = evidence.content.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0e1626] border border-white/[0.1] rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_25px_50px_-12px_rgba(0,0,0,0.7)] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            {evidence.kind === 'image' && <ImageIcon className="w-5 h-5 text-teal-400" />}
            {evidence.kind === 'har' && <Network className="w-5 h-5 text-amber-400" />}
            {evidence.kind === 'log' && <Terminal className="w-5 h-5 text-emerald-400" />}
            {evidence.kind === 'source' && <FileText className="w-5 h-5 text-blue-400" />}
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{evidence.displayName}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.05] text-slate-300 border border-white/[0.08]">
                  {evidence.sourceLabel}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Uploaded: {new Date(evidence.uploadedAt).toLocaleString()} · {evidence.bytes} bytes · {evidence.kind}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warnings Banner */}
        {evidence.warnings.length > 0 && (
          <div className="bg-amber-950/30 border-b border-amber-500/30 px-5 py-2.5 text-xs text-amber-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>{evidence.warnings.join(' · ')}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* IMAGE EVIDENCE */}
          {evidence.kind === 'image' ? (
            <div className="space-y-4">
              <div className="flex justify-center bg-[#090d16] p-4 rounded-xl border border-white/[0.08]">
                <img
                  src={`/api/investigations/${evidence.investigationId}/evidence/${evidence.id}/file`}
                  alt={evidence.displayName}
                  className="max-h-[360px] object-contain rounded-lg"
                />
              </div>

              {/* Vision observations extraction preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400">
                    Model-Extracted Observations (Confirm or Correct)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Extracted text remains unverified until user confirmation
                  </span>
                </div>

                {evidence.observations.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No vision observations extracted yet. Run Gemma analysis.</p>
                ) : (
                  <div className="space-y-2.5">
                    {evidence.observations.map(obs => (
                      <div
                        key={obs.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                          obs.verification === 'confirmed'
                            ? 'bg-teal-950/25 border-teal-500/30'
                            : obs.verification === 'corrected'
                            ? 'bg-amber-950/25 border-amber-500/30'
                            : 'bg-[#090d16]/80 border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">Region: {obs.evidenceRefs[0]?.region || 'Full UI'}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            obs.verification === 'confirmed'
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : obs.verification === 'corrected'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-white/[0.05] text-slate-400'
                          }`}>
                            {obs.verification}
                          </span>
                        </div>

                        <textarea
                          value={editedStatements[obs.id] ?? obs.statement}
                          onChange={e => setEditedStatements({ ...editedStatements, [obs.id]: e.target.value })}
                          rows={2}
                          className="w-full bg-[#090d16] border border-white/[0.1] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleConfirmObservation(obs.id, false)}
                            disabled={saving}
                            className="btn-primary-human flex items-center gap-1 px-3 py-1 text-[11px] rounded-lg active:scale-95"
                          >
                            <Check className="w-3 h-3" /> Confirm As Observed
                          </button>
                          <button
                            onClick={() => handleConfirmObservation(obs.id, true)}
                            disabled={saving}
                            className="btn-secondary-human flex items-center gap-1 px-3 py-1 text-[11px] text-amber-300 border-amber-500/30 rounded-lg active:scale-95"
                          >
                            <Edit2 className="w-3 h-3" /> Save Correction
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : evidence.kind === 'har' ? (
            /* HAR ENTRIES VIEWER */
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                HAR Network Entries ({evidence.entries.length})
              </h4>
              <div className="space-y-2">
                {evidence.entries.map(entry => (
                  <div
                    key={entry.index}
                    className={`p-3.5 rounded-xl border text-xs bg-[#090d16] font-mono space-y-1.5 ${
                      activeRef?.entry === entry.index ? 'border-teal-500 ring-1 ring-teal-500 shadow-sm' : 'border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-teal-400">{entry.method}</span>
                        <span className="text-slate-100 truncate max-w-lg">{entry.url}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.status >= 500 ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40' :
                        entry.status >= 400 ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40' : 'bg-teal-950/80 text-teal-300 border border-teal-500/40'
                      }`}>
                        HTTP {entry.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span>Duration: {entry.duration} ms</span>
                      {entry.requestId && <span className="text-teal-300">Request ID: {entry.requestId}</span>}
                      {entry.startedDateTime && <span>Started: {entry.startedDateTime}</span>}
                    </div>
                    {entry.responseDetails && (
                      <div className="p-2.5 bg-[#151f33] rounded-lg text-slate-300 text-[11px] overflow-x-auto max-h-28 border border-white/[0.06]">
                        {entry.responseDetails}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* SOURCE / LOG VIEWER WITH LINE NUMBERS */
            <div className="space-y-3">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Displaying content with real line numbers</span>
                {activeRef?.line && (
                  <span className="text-teal-400 font-semibold">Active citation on line {activeRef.line}</span>
                )}
              </div>
              <div className="bg-[#090d16] rounded-xl border border-white/[0.08] p-3 font-mono text-xs overflow-x-auto max-h-[500px]">
                {lines.map((line, idx) => {
                  const lineNum = idx + 1;
                  const isHighlighted = activeRef?.line === lineNum;
                  return (
                    <div
                      key={idx}
                      className={`flex leading-relaxed ${
                        isHighlighted ? 'bg-teal-950/60 text-teal-200 border-l-2 border-teal-400 pl-1' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="w-12 text-slate-500 select-none text-right pr-3 flex-shrink-0">
                        {lineNum}
                      </span>
                      <pre className="text-slate-300 whitespace-pre font-mono flex-1">{line || ' '}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
