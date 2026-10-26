import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  MarkerType,
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { GraphNode, GraphEdge, Ref } from '@tracelens/shared';
import { Eye, HelpCircle, Sparkles } from 'lucide-react';

interface StateGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectRef?: (ref: Ref) => void;
}

// Custom Node Component
function CustomStateNode({ data }: { data: any }) {
  const { label, kind, evidenceRefs, onSelectRef } = data;

  const badgeColor =
    kind === 'observed'
      ? 'bg-teal-950/70 text-teal-300 border-teal-500/40'
      : kind === 'inferred'
      ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
      : 'bg-white/[0.05] text-slate-400 border-white/[0.1]';

  const borderColor =
    kind === 'observed'
      ? 'border-teal-500/80 shadow-[0_0_15px_-3px_rgba(20,184,166,0.25)]'
      : kind === 'inferred'
      ? 'border-amber-500/80 border-dashed shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]'
      : 'border-slate-700 border-dotted';

  return (
    <div className={`px-4 py-3.5 bg-[#0e1626]/95 rounded-2xl border-2 ${borderColor} shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_10px_25px_-5px_rgba(0,0,0,0.5)] min-w-[180px] text-xs font-sans backdrop-blur-xl transition-transform hover:scale-[1.02]`}>
      <Handle type="target" position={Position.Top} className="!bg-teal-500/80 !w-2.5 !h-2.5 !border-none" />
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${badgeColor}`}>
          {kind === 'observed' && <Eye className="w-2.5 h-2.5" />}
          {kind === 'inferred' && <Sparkles className="w-2.5 h-2.5" />}
          {kind === 'unknown' && <HelpCircle className="w-2.5 h-2.5" />}
          {kind}
        </span>
      </div>
      <div className="font-bold text-white text-sm leading-snug">{label}</div>

      {evidenceRefs && evidenceRefs.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex flex-wrap gap-1">
          {evidenceRefs.map((ref: Ref, idx: number) => (
            <button
              key={idx}
              onClick={() => onSelectRef?.(ref)}
              className="text-[10px] text-teal-300 bg-teal-950/70 hover:bg-teal-900 px-2 py-0.5 rounded-full border border-teal-500/30 transition-colors truncate max-w-[150px]"
            >
              Cite: {ref.locator}
            </button>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500/80 !w-2.5 !h-2.5 !border-none" />
    </div>
  );
}

const nodeTypes = {
  customState: CustomStateNode,
};

export function StateGraph({ nodes: rawNodes, edges: rawEdges, onSelectRef }: StateGraphProps) {
  // If model returned no nodes, construct default layers
  const fallbackNodes: GraphNode[] = [
    { id: 'ui-layer', label: 'UI Display State', kind: 'observed', evidenceRefs: [] },
    { id: 'react-layer', label: 'React In-Memory State', kind: 'inferred', evidenceRefs: [] },
    { id: 'storage-layer', label: 'Browser Storage State', kind: 'inferred', evidenceRefs: [] },
    { id: 'api-layer', label: 'Server / API State', kind: 'unknown', evidenceRefs: [] },
  ];

  const fallbackEdges: GraphEdge[] = [
    { id: 'e1', source: 'ui-layer', target: 'react-layer', label: 'renders from', kind: 'observed', evidenceRefs: [] },
    { id: 'e2', source: 'react-layer', target: 'storage-layer', label: 'sync gap', kind: 'inferred', evidenceRefs: [] },
    { id: 'e3', source: 'storage-layer', target: 'api-layer', label: 'not persisted', kind: 'unknown', evidenceRefs: [] },
  ];

  const displayNodes = rawNodes.length ? rawNodes : fallbackNodes;
  const displayEdges = rawEdges.length ? rawEdges : fallbackEdges;

  // Layout nodes vertically
  const flowNodes: Node[] = useMemo(() => {
    return displayNodes.map((n, i) => ({
      id: n.id,
      type: 'customState',
      position: { x: 180 + (i % 2) * 40, y: i * 110 + 20 },
      data: {
        label: n.label,
        kind: n.kind,
        evidenceRefs: n.evidenceRefs,
        onSelectRef
      }
    }));
  }, [displayNodes, onSelectRef]);

  const flowEdges: Edge[] = useMemo(() => {
    return displayEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.kind === 'inferred',
      style: {
        stroke: e.kind === 'observed' ? '#14B8A6' : e.kind === 'inferred' ? '#F59E0B' : '#64748B',
        strokeWidth: 2,
        strokeDasharray: e.kind === 'inferred' ? '5,5' : undefined
      },
      labelStyle: { fill: '#E2E8F0', fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: '#0E1626', fillOpacity: 0.95 },
      labelBgPadding: [8, 5] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.kind === 'observed' ? '#14B8A6' : e.kind === 'inferred' ? '#F59E0B' : '#64748B'
      }
    }));
  }, [displayEdges]);

  return (
    <div className="w-full h-[380px] bg-[#090d16]/90 rounded-2xl border border-white/[0.08] relative overflow-hidden shadow-inner">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3 text-[11px] bg-[#0e1626]/90 px-3.5 py-1.5 rounded-full border border-white/[0.08] text-slate-300 backdrop-blur-md shadow-sm">
        <span className="font-semibold text-slate-400">Legend:</span>
        <span className="flex items-center gap-1.5 text-teal-400">
          <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]"></span> Observed
        </span>
        <span className="flex items-center gap-1.5 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]"></span> Inferred
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-slate-500"></span> Unknown
        </span>
      </div>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1E293B" gap={18} size={1} />
        <Controls className="!bg-[#0e1626] !border-white/[0.08] !text-slate-300 !rounded-xl !overflow-hidden" />
      </ReactFlow>
    </div>
  );
}
