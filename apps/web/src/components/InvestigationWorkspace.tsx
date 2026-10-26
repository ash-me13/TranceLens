import React, { useState, useEffect, useRef } from 'react';
import type {
  InvestigationDetail,
  Analysis,
  Evidence,
  Ref,
  TimelineEvent,
  SetupDifference,
  Hypothesis,
  EvidenceKind
} from '@tracelens/shared';
import {
  ArrowLeft,
  Upload,
  Plus,
  Play,
  X,
  FileText,
  Image as ImageIcon,
  Network,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Download,
  Trash2,
  Eye,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react';
import { StateGraph } from './StateGraph';
import { EvidenceModal } from './EvidenceModal';
import { PasteEvidenceModal } from './PasteEvidenceModal';

interface InvestigationWorkspaceProps {
  investigationId: string;
  onBack: () => void;
}

export function InvestigationWorkspace({ investigationId, onBack }: InvestigationWorkspaceProps) {
  const [inv, setInv] = useState<InvestigationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRevision, setSelectedRevision] = useState<number>(1);
  const [activeJob, setActiveJob] = useState<{ id: string; status: string; stage: string; error?: string } | null>(null);

  // Modals & Active Selections
  const [inspectEvidence, setInspectEvidence] = useState<Evidence | null>(null);
  const [activeCitationRef, setActiveCitationRef] = useState<Ref | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Follow-up & Test Inputs
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [freeTextAnswer, setFreeTextAnswer] = useState<string>('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [recordingTestHId, setRecordingTestHId] = useState<string | null>(null);
  const [testResultText, setTestResultText] = useState<string>('');

  // Mobile Tab selector
  const [mobileTab, setMobileTab] = useState<'evidence' | 'analysis' | 'hypotheses'>('analysis');

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInvestigation = async () => {
    try {
      const res = await fetch(`/api/investigations/${investigationId}`);
      if (!res.ok) throw new Error('Investigation not found');
      const data: InvestigationDetail = await res.json();
      setInv(data);
      if (data.analyses.length > 0) {
        setSelectedRevision(data.analyses.at(-1)!.revision);
      }
    } catch (err: any) {
      alert(`Error loading investigation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestigation();
  }, [investigationId]);

  // Poll running job
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/investigations/${investigationId}/jobs/${activeJob.id}`);
        if (!res.ok) return;
        const job = await res.json();
        setActiveJob(job);
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(interval);
          await fetchInvestigation();
        }
      } catch {
        // ignore
      }
    }, 400);
    return () => clearInterval(interval);
  }, [activeJob, investigationId]);

  // Start analysis job
  const handleAnalyze = async () => {
    try {
      const res = await fetch(`/api/investigations/${investigationId}/analyze`, { method: 'POST' });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || 'Failed to start analysis');
      setActiveJob(job);
    } catch (err: any) {
      alert(`Analysis error: ${err.message}`);
    }
  };

  // Cancel running job
  const handleCancelJob = async () => {
    if (!activeJob) return;
    try {
      await fetch(`/api/investigations/${investigationId}/jobs/${activeJob.id}/cancel`, { method: 'POST' });
      setActiveJob(prev => prev ? { ...prev, status: 'cancelled', stage: 'Cancelled by user' } : null);
    } catch (err: any) {
      alert(`Cancellation error: ${err.message}`);
    }
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceLabel', 'Developer uploaded');

    try {
      const res = await fetch(`/api/investigations/${investigationId}/evidence`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await fetchInvestigation();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Text evidence paste handler
  const handleSaveTextEvidence = async (payload: { displayName: string; kind: EvidenceKind; sourceLabel: string; content: string; userTimestamp?: string }) => {
    const res = await fetch(`/api/investigations/${investigationId}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add text evidence');
    await fetchInvestigation();
  };

  // Delete evidence
  const handleDeleteEvidence = async (eid: string) => {
    if (!confirm('Delete this evidence item? Associated analyses will reset.')) return;
    try {
      await fetch(`/api/investigations/${investigationId}/evidence/${eid}`, { method: 'DELETE' });
      await fetchInvestigation();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Observation updates (from modal)
  const handleUpdateObservations = async (eid: string, observations: Array<{ id: string; statement: string; verification: 'confirmed' | 'corrected' }>) => {
    const res = await fetch(`/api/investigations/${investigationId}/evidence/${eid}/observations`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observations })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update observations');
    }
    await fetchInvestigation();
  };

  // Submit follow-up answer
  const handleSubmitAnswer = async () => {
    const answerText = freeTextAnswer.trim() || selectedAnswer;
    if (!answerText) return;
    const currentAnalysis = inv?.analyses.find(a => a.revision === selectedRevision) || inv?.analyses.at(-1);
    if (!currentAnalysis) return;

    setSubmittingAnswer(true);
    try {
      const res = await fetch(`/api/investigations/${investigationId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentAnalysis.nextQuestion.id,
          text: answerText
        })
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || 'Failed to record answer');
      setActiveJob(job);
      setSelectedAnswer('');
      setFreeTextAnswer('');
    } catch (err: any) {
      alert(`Answer error: ${err.message}`);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // Record test result
  const handleRecordTestResult = async (hId: string) => {
    if (!testResultText.trim()) return;
    try {
      const res = await fetch(`/api/investigations/${investigationId}/test-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hypothesisId: hId,
          text: testResultText.trim()
        })
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || 'Failed to record test result');
      setActiveJob(job);
      setRecordingTestHId(null);
      setTestResultText('');
    } catch (err: any) {
      alert(`Test record error: ${err.message}`);
    }
  };

  // Click citation helper: opens file and scrolls to line or HAR entry
  const handleCitationClick = (ref: Ref) => {
    const item = inv?.evidence.find(e => e.id === ref.evidenceId);
    if (item) {
      setActiveCitationRef(ref);
      setInspectEvidence(item);
    }
  };

  if (loading || !inv) {
    return (
      <div className="flex items-center justify-center p-20 text-slate-400 text-sm">
        <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-3"></span>
        <span>Loading investigation workspace...</span>
      </div>
    );
  }

  const currentAnalysis: Analysis | undefined = inv.analyses.find(a => a.revision === selectedRevision) || inv.analyses.at(-1);

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded ${
                inv.mode === 'state' ? 'bg-teal-950 text-teal-300 border border-teal-800' :
                inv.mode === 'request' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                'bg-blue-950 text-blue-300 border border-blue-800'
              }`}>
                {inv.mode}
              </span>
              <h1 className="text-lg font-bold text-white tracking-tight">{inv.title}</h1>
              {inv.sample && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Sample investigation — recorded example
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Created {new Date(inv.createdAt).toLocaleString()} · {inv.evidence.length} evidence items · {inv.analyses.length} revisions
            </div>
          </div>
        </div>

        {/* Workspace Toolbar */}
        <div className="flex items-center gap-2">
          {inv.analyses.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px]">Revision:</span>
              <select
                value={selectedRevision}
                onChange={e => setSelectedRevision(Number(e.target.value))}
                className="bg-transparent text-white font-bold focus:outline-none"
              >
                {inv.analyses.map(a => (
                  <option key={a.revision} value={a.revision}>Rev {a.revision}</option>
                ))}
              </select>
            </div>
          )}

          <a
            href={`/api/investigations/${inv.id}/export?format=markdown`}
            download={`tracelens-${inv.id}.md`}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
            title="Download investigation Markdown report"
          >
            <Download className="w-3.5 h-3.5" /> Export MD
          </a>

          <a
            href={`/api/investigations/${inv.id}/export`}
            download={`tracelens-${inv.id}.json`}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
            title="Download structured JSON"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </a>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setMobileTab('evidence')}
          className={`flex-1 py-1.5 rounded-md ${mobileTab === 'evidence' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
        >
          Evidence ({inv.evidence.length})
        </button>
        <button
          onClick={() => setMobileTab('analysis')}
          className={`flex-1 py-1.5 rounded-md ${mobileTab === 'analysis' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
        >
          Investigation
        </button>
        <button
          onClick={() => setMobileTab('hypotheses')}
          className={`flex-1 py-1.5 rounded-md ${mobileTab === 'hypotheses' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
        >
          Hypotheses
        </button>
      </div>

      {/* 3-Column Desktop Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* ======================================================== */}
        {/* COLUMN 1: EVIDENCE LIBRARY (3 COLS)                     */}
        {/* ======================================================== */}
        <div className={`md:col-span-3 space-y-4 ${mobileTab !== 'evidence' ? 'hidden md:block' : ''}`}>
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-teal-400" />
                <span>Evidence Library</span>
              </h2>
              <span className="text-[11px] text-slate-500">{inv.evidence.length} / 12 items</span>
            </div>

            {/* Upload & Paste Buttons */}
            {!inv.sample && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-teal-400" /> Upload File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.webp,.har,.json,.log,.txt,.md,.tsx,.jsx,.ts,.js,.env"
                />

                <button
                  onClick={() => setShowPasteModal(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-400" /> Paste Code/Log
                </button>
              </div>
            )}

            {/* Secret Redaction Notice */}
            <div className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
              <span>Authorization headers, cookies, API keys, and environment values are redacted automatically.</span>
            </div>

            {/* Ingestion Report Accordion */}
            {inv.evidence.length > 0 && (
              <div className="border border-slate-800 rounded-lg overflow-hidden text-xs">
                <button
                  onClick={() => setShowReport(!showReport)}
                  className="w-full p-2.5 bg-slate-950/60 hover:bg-slate-950 flex items-center justify-between text-slate-300 font-medium"
                >
                  <span>Ingestion Report</span>
                  {showReport ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {showReport && (
                  <div className="p-3 bg-slate-950 space-y-1.5 text-[11px] text-slate-400 border-t border-slate-800">
                    <div>Accepted files: {inv.evidence.length}</div>
                    <div>Parsed observations: {inv.evidence.reduce((s, e) => s + e.observations.length, 0)}</div>
                    <div>HAR network events: {inv.evidence.reduce((s, e) => s + e.entries.length, 0)}</div>
                    <div className="text-teal-400">Common secrets excluded from LLM context</div>
                  </div>
                )}
              </div>
            )}

            {/* Evidence List */}
            <div className="space-y-2">
              {inv.evidence.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                  No evidence uploaded yet. Add a screenshot, code, or logs.
                </div>
              ) : (
                inv.evidence.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveCitationRef(null);
                      setInspectEvidence(item);
                    }}
                    className="p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg cursor-pointer transition space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        {item.kind === 'image' && <ImageIcon className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />}
                        {item.kind === 'har' && <Network className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                        {item.kind === 'log' && <Terminal className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                        {item.kind === 'source' && <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                        <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-teal-300">
                          {item.displayName}
                        </span>
                      </div>
                      {!inv.sample && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvidence(item.id);
                          }}
                          className="text-slate-600 hover:text-rose-400 p-1 rounded"
                          title="Delete evidence"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {item.sourceLabel}
                      </span>
                      <span>{item.bytes} B</span>
                    </div>

                    {item.observations.length > 0 && (
                      <div className="text-[10px] text-teal-400/90 font-mono">
                        {item.observations.length} observations ({item.observations.filter(o => o.verification === 'confirmed').length} verified)
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: INVESTIGATION ENGINE (6 COLS)                  */}
        {/* ======================================================== */}
        <div className={`md:col-span-6 space-y-4 ${mobileTab !== 'analysis' ? 'hidden md:block' : ''}`}>
          {/* Analysis Runner Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAnalyze}
                  disabled={!!activeJob && activeJob.status === 'running'}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg transition shadow-md shadow-teal-500/20 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{currentAnalysis ? 'Re-Analyze with Gemma 4' : 'Analyze with Local Gemma 4'}</span>
                </button>

                {activeJob && activeJob.status === 'running' && (
                  <button
                    onClick={handleCancelJob}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-bold rounded-lg border border-rose-800 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel Analysis
                  </button>
                )}
              </div>

              {currentAnalysis?.modelMetadata && (
                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                  <span className="text-teal-400 font-semibold">{currentAnalysis.modelMetadata.model}</span>
                  <span>· {currentAnalysis.modelMetadata.durationMs} ms</span>
                  {currentAnalysis.modelMetadata.completionTokens && (
                    <span>· {currentAnalysis.modelMetadata.completionTokens} tokens</span>
                  )}
                </div>
              )}
            </div>

            {/* Active Job Progress Stages */}
            {activeJob && (
              <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                activeJob.status === 'running' ? 'bg-teal-950/40 border-teal-500/40 text-teal-200' :
                activeJob.status === 'failed' ? 'bg-rose-950/40 border-rose-500/40 text-rose-200' :
                activeJob.status === 'cancelled' ? 'bg-slate-800 border-slate-700 text-slate-400' :
                'bg-slate-900 border-slate-800 text-slate-300'
              }`}>
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-2">
                    {activeJob.status === 'running' && (
                      <span className="w-2.5 h-2.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></span>
                    )}
                    <span>Stage: {activeJob.stage}</span>
                  </span>
                  <span className="uppercase text-[10px] tracking-wider">{activeJob.status}</span>
                </div>
                {activeJob.error && (
                  <div className="text-rose-300 text-[11px] font-mono">{activeJob.error}</div>
                )}
              </div>
            )}
          </div>

          {/* MODE-SPECIFIC CENTER VIEW */}
          {inv.mode === 'state' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-teal-400" />
                  <span>State Conflict Graph & Layer Mapping</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Traces the gap between what the interface shows and what the app remembers.
                  Every node and edge is labeled as <strong>observed</strong> or <strong>inferred</strong>.
                </p>
              </div>

              {/* StateGraph Component */}
              <StateGraph
                nodes={currentAnalysis?.stateGraph?.nodes || []}
                edges={currentAnalysis?.stateGraph?.edges || []}
                onSelectRef={handleCitationClick}
              />

              {/* Plain-Language Contradiction Summary */}
              {currentAnalysis?.summary && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                    Evidence-Grounded Contradiction Summary
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {currentAnalysis.summary}
                  </p>

                  {/* Summary Observation Citations */}
                  {currentAnalysis.summaryObservationIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {currentAnalysis.summaryObservationIds.map(oid => {
                        const obs = currentAnalysis.observations.find(o => o.id === oid);
                        return obs?.evidenceRefs.map((ref, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleCitationClick(ref)}
                            className="text-[10px] font-mono text-teal-400 bg-teal-950 px-2 py-0.5 rounded border border-teal-800 hover:bg-teal-900 transition"
                          >
                            Cite: {ref.locator}
                          </button>
                        ));
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {inv.mode === 'request' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-400" />
                  <span>Interactive Request Journey Timeline</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Correlates user click action, HTTP dispatch, server logs, and frontend spinner cleanup.
                  Preserves original timestamps; cross-machine clock ordering is shown with uncertainty.
                </p>
              </div>

              {/* Timeline Events List */}
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                {(currentAnalysis?.modeSpecificResults?.timeline || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    No timeline events yet. Upload a HAR file or server log and run analysis.
                  </div>
                ) : (
                  currentAnalysis?.modeSpecificResults?.timeline.map((evt, i) => (
                    <div key={evt.id || i} className="relative flex items-start gap-3 pl-8">
                      <span className="absolute left-2.5 top-1.5 w-2.5 h-2.5 rounded-full bg-teal-400 ring-4 ring-slate-900"></span>
                      <div className="flex-1 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{evt.label}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            evt.association === 'explicit ID'
                              ? 'bg-teal-950 text-teal-300 border border-teal-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {evt.association}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-mono leading-relaxed">{evt.detail}</div>
                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                          <span>{evt.timestamp ? `Time: ${evt.timestamp}` : 'Event time unrecorded'}</span>
                          {evt.evidenceRefs.map((ref, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleCitationClick(ref)}
                              className="text-teal-400 hover:underline font-mono"
                            >
                              Cite: {ref.locator}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {inv.mode === 'setup' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-teal-400" />
                  <span>Deterministic Environment Differences</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Side-by-side checks for Node engines semver compatibility, package manager versions, manifest/lockfile consistency, and required environment variables.
                </p>
              </div>

              {/* Differences Table */}
              <div className="space-y-3">
                {(currentAnalysis?.modeSpecificResults?.setupDifferences || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    No environment differences computed yet. Upload manifests and run analysis.
                  </div>
                ) : (
                  currentAnalysis?.modeSpecificResults?.setupDifferences.map((diff, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border text-xs space-y-2 ${
                        diff.severity === 'error' ? 'bg-rose-950/30 border-rose-500/40' :
                        diff.severity === 'warning' ? 'bg-amber-950/30 border-amber-500/40' :
                        'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{diff.check}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          diff.severity === 'error' ? 'bg-rose-500/20 text-rose-300' :
                          diff.severity === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-teal-500/20 text-teal-300'
                        }`}>
                          {diff.severity}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase">Working Environment</div>
                          <div className="text-slate-200 mt-1 font-mono text-[11px]">{diff.working}</div>
                        </div>
                        <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase">Broken Environment</div>
                          <div className="text-rose-300 mt-1 font-mono text-[11px]">{diff.broken}</div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        {diff.evidenceRefs.map((ref, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleCitationClick(ref)}
                            className="text-[11px] text-teal-400 hover:underline font-mono"
                          >
                            Cite: {ref.locator}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: HYPOTHESES & FOLLOW-UP (3 COLS)                */}
        {/* ======================================================== */}
        <div className={`md:col-span-3 space-y-4 ${mobileTab !== 'hypotheses' ? 'hidden md:block' : ''}`}>
          {/* Missing Evidence Alert */}
          {currentAnalysis?.missingEvidence && currentAnalysis.missingEvidence.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 text-xs space-y-1.5 shadow-lg">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Missing Information
              </div>
              <ul className="list-disc list-inside text-amber-200/90 text-[11px] space-y-1">
                {currentAnalysis.missingEvidence.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Ranked Plausible Explanations */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>Competing Hypotheses</span>
              </h2>
              <span className="text-[11px] text-slate-500">
                {currentAnalysis?.hypotheses.length || 0} active
              </span>
            </div>

            {(!currentAnalysis?.hypotheses || currentAnalysis.hypotheses.length === 0) ? (
              <p className="text-xs text-slate-500 italic p-4 text-center">
                Run an initial analysis to generate competing hypotheses.
              </p>
            ) : (
              <div className="space-y-3">
                {currentAnalysis.hypotheses.map(h => (
                  <div
                    key={h.id}
                    className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs shadow"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{h.title}</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          h.status === 'supported' ? 'bg-teal-500/20 text-teal-300' :
                          h.status === 'weakened' ? 'bg-amber-500/20 text-amber-300' :
                          h.status === 'contradicted' ? 'bg-rose-500/20 text-rose-300' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {h.status}
                        </span>
                        <span className="text-[10px] px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                          {h.evidenceStrength}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed font-sans">{h.explanation}</p>

                    {/* Supporting and Contradicting Citations */}
                    <div className="space-y-1 text-[11px] pt-1 border-t border-slate-800/80">
                      <div className="text-slate-400">
                        <span className="text-teal-400 font-semibold">Supporting:</span>{' '}
                        {h.supportingObservationIds.length ? h.supportingObservationIds.join(', ') : 'None supplied'}
                      </div>
                      {h.contradictingObservationIds.length > 0 && (
                        <div className="text-rose-400">
                          <span className="font-semibold">Counterevidence:</span>{' '}
                          {h.contradictingObservationIds.join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Distinguishing Test Card */}
                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
                      <div className="font-bold text-teal-300">Distinguishing Test:</div>
                      <div className="text-slate-300">{h.distinguishingTest.action}</div>

                      {h.distinguishingTest.safetyNote && (
                        <div className="text-amber-400 text-[10px]">Note: {h.distinguishingTest.safetyNote}</div>
                      )}

                      <div className="pt-1">
                        {recordingTestHId === h.id ? (
                          <div className="space-y-2 pt-1 border-t border-slate-800">
                            <input
                              type="text"
                              value={testResultText}
                              onChange={e => setTestResultText(e.target.value)}
                              placeholder="Record what happened after test..."
                              className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setRecordingTestHId(null)}
                                className="px-2 py-0.5 text-[10px] text-slate-400"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleRecordTestResult(h.id)}
                                className="px-2 py-0.5 bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold rounded"
                              >
                                Save Result
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setRecordingTestHId(h.id);
                              setTestResultText(h.distinguishingTest.expectedOutcomes[0] || '');
                            }}
                            className="text-teal-400 hover:underline font-semibold text-[10px]"
                          >
                            + Record Test Result
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up Question Card */}
          {currentAnalysis?.nextQuestion && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" /> One Follow-Up Question
              </div>

              <div className="text-xs font-semibold text-white leading-snug">
                {currentAnalysis.nextQuestion.question}
              </div>

              <div className="text-[11px] text-slate-400 italic">
                Why useful: {currentAnalysis.nextQuestion.whyUseful}
              </div>

              {/* Selectable Options */}
              <div className="space-y-1.5 pt-1">
                {currentAnalysis.nextQuestion.answerOptions.map((opt, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                      selectedAnswer === opt
                        ? 'bg-slate-800 border-teal-500 text-white ring-1 ring-teal-500/40'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="followup"
                      checked={selectedAnswer === opt}
                      onChange={() => {
                        setSelectedAnswer(opt);
                        setFreeTextAnswer('');
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>

              {currentAnalysis.nextQuestion.allowFreeText && (
                <input
                  type="text"
                  value={freeTextAnswer}
                  onChange={e => {
                    setFreeTextAnswer(e.target.value);
                    setSelectedAnswer('');
                  }}
                  placeholder="Or enter custom answer..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              )}

              <button
                onClick={handleSubmitAnswer}
                disabled={submittingAnswer || (!selectedAnswer && !freeTextAnswer.trim())}
                className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 shadow"
              >
                {submittingAnswer ? 'Updating Investigation...' : 'Submit Answer & Update'}
              </button>
            </div>
          )}

          {/* Revision Changelog */}
          {currentAnalysis?.changes && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs space-y-1">
              <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">
                What Changed in Revision {currentAnalysis.revision}
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {currentAnalysis.changes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Inspect Evidence Modal */}
      {inspectEvidence && (
        <EvidenceModal
          evidence={inspectEvidence}
          activeRef={activeCitationRef}
          onClose={() => {
            setInspectEvidence(null);
            setActiveCitationRef(null);
          }}
          onUpdateObservations={handleUpdateObservations}
        />
      )}

      {/* Paste Evidence Modal */}
      {showPasteModal && (
        <PasteEvidenceModal
          onClose={() => setShowPasteModal(false)}
          onSave={handleSaveTextEvidence}
        />
      )}
    </div>
  );
}
