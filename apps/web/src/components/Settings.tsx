import React, { useState, useEffect } from 'react';
import type { ModelStatus } from '@tracelens/shared';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Terminal,
  Zap
} from 'lucide-react';

export function Settings() {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testInference, setTestInference] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemma4:e4b');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/model/status');
      const data: ModelStatus = await res.json();
      setStatus(data);
      if (data.selectedModel) {
        setSelectedModel(data.selectedModel);
      }
    } catch (err: any) {
      setStatus({
        connected: false,
        available: false,
        selectedModel,
        models: [],
        imageInput: false,
        message: `Failed to query Ollama API: ${err.message}`,
        capabilities: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResultMsg(null);
    try {
      const res = await fetch('/api/model/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, inference: testInference })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Connection test failed');
      }
      setTestResultMsg(data.message || 'Connection verified successfully.');
      await fetchStatus();
    } catch (err: any) {
      setTestResultMsg(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-teal-400" />
            <span>Local Gemma 4 Inference Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            TraceLens runs inference entirely through your local Ollama instance on loopback (127.0.0.1:11434).
            No telemetry, no external API keys, zero cloud egress.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="btn-secondary-human flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Connection Status Card */}
      <div className="bg-[#0e1626]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_25px_-5px_rgba(0,0,0,0.4)] space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            {status?.connected ? (
              <span className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            ) : (
              <span className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <XCircle className="w-5 h-5" />
              </span>
            )}
            <div>
              <div className="text-sm font-bold text-white">
                {status?.connected ? 'Local Ollama Connected' : 'Cannot Connect to Local Ollama'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Target: <code className="text-teal-300">http://127.0.0.1:11434</code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
              status?.available
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}>
              {status?.available ? 'Model Ready' : 'Model Unavailable'}
            </span>
          </div>
        </div>

        {/* Message */}
        {status?.message && (
          <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
            status.available
              ? 'bg-teal-950/30 border-teal-500/30 text-teal-200'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
          }`}>
            {status.message}
          </div>
        )}

        {/* Model Selection and Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Selected Gemma 4 Model
            </label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#090d16] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer"
            >
              {status?.models && status.models.length > 0 ? (
                status.models.map(m => (
                  <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
                ))
              ) : (
                <option value="gemma4:e4b" className="bg-slate-900 text-white">gemma4:e4b (Not installed)</option>
              )}
            </select>
            <p className="text-[11px] text-slate-400">
              TraceLens discovers installed models and capabilities dynamically via <code className="text-teal-300">/api/tags</code> and <code className="text-teal-300">/api/show</code>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Discovered Model Capabilities
            </label>
            <div className="flex flex-wrap gap-2">
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full border flex items-center gap-1.5 ${
                status?.imageInput
                  ? 'bg-teal-950/70 text-teal-300 border-teal-500/50'
                  : 'bg-white/[0.04] text-slate-400 border-white/[0.08]'
              }`}>
                <Eye className="w-3.5 h-3.5" />
                <span>Image Input (Vision)</span>
                {status?.imageInput && <span className="text-[10px] bg-teal-800/80 px-1.5 py-0.2 rounded-full text-white">Active</span>}
              </span>

              {status?.capabilities?.map((cap, i) => (
                <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/[0.04] text-slate-300 border border-white/[0.08] capitalize">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={testInference}
              onChange={e => setTestInference(e.target.checked)}
              className="rounded bg-[#090d16] border-white/[0.2] text-teal-500 focus:ring-0"
            />
            <span>Run full JSON test inference during check (measures local latency)</span>
          </label>

          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="btn-primary-human flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold rounded-xl active:scale-95 disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing...' : 'Test Connection'}</span>
          </button>
        </div>

        {testResultMsg && (
          <div className="p-3.5 bg-[#090d16] rounded-xl border border-teal-500/40 text-xs font-mono text-teal-300 shadow-sm">
            {testResultMsg}
          </div>
        )}
      </div>

      {/* Setup Instructions Card */}
      <div className="bg-[#0e1626]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_25px_-5px_rgba(0,0,0,0.4)] space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-teal-400" />
          <span>Local Gemma 4 Setup Instructions</span>
        </h3>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>If the model status indicates unavailable, follow these local steps in your terminal:</p>

          <div className="bg-[#090d16] p-4 rounded-xl border border-white/[0.07] font-mono space-y-2 text-teal-300">
            <div># 1. Start Ollama locally on default port 11434</div>
            <div className="text-slate-100">ollama serve</div>
            <div className="pt-1"># 2. Download the Gemma 4 multimodal model</div>
            <div className="text-slate-100">ollama pull gemma4:e4b</div>
            <div className="pt-1"># 3. Verify installed models</div>
            <div className="text-slate-100">ollama list</div>
          </div>

          <p className="text-slate-400 text-[11px]">
            * Note: Model download size (approx. 6.6 GB) is disk storage. TraceLens uses strict JSON schemas, low temperature (0.1), and streaming: false for guaranteed parseable output.
          </p>
        </div>
      </div>
    </div>
  );
}
