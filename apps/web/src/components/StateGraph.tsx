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
      ? 'bg-teal-950 text-teal-300 border-teal-500/50'
      : kind === 'inferred'
      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
      : 'bg-slate-900 text-slate-400 border-slate-700';

  const borderColor =
    kind === 'observed'
      ? 'border-teal-500'
      : kind === 'inferred'
      ? 'border-amber-500 border-dashed'
      : 'border-slate-700 border-dotted';

  return (
    <div className={`px-4 py-3 bg-slate-900/95 rounded-xl border-2 ${borderColor} shadow-xl min-w-[170px] text-xs font-sans backdrop-blur-md`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 ${badgeColor}`}>
          {kind === 'observed' && <Eye className="w-2.5 h-2.5" />}
          {kind === 'inferred' && <Sparkles className="w-2.5 h-2.5" />}
          {kind === 'unknown' && <HelpCircle className="w-2.5 h-2.5" />}
          {kind}
        </span>
      </div>
      <div className="font-semibold text-slate-100 text-sm leading-snug">{label}</div>

      {evidenceRefs && evidenceRefs.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap gap-1">
          {evidenceRefs.map((ref: Ref, idx: number) => (
            <button
              key={idx}
              onClick={() => onSelectRef?.(ref)}
              className="text-[10px] text-teal-400 bg-teal-950/60 hover:bg-teal-900/80 px-1.5 py-0.5 rounded border border-teal-800 transition truncate max-w-[140px]"
            >
              Cite: {ref.locator}
            </button>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
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
      labelStyle: { fill: '#CBD5E1', fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: '#0F172A', fillOpacity: 0.9 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.kind === 'observed' ? '#14B8A6' : e.kind === 'inferred' ? '#F59E0B' : '#64748B'
      }
    }));
  }, [displayEdges]);

  return (
    <div className="w-full h-[380px] bg-slate-950/80 rounded-xl border border-slate-800 relative overflow-hidden">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3 text-[11px] bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
        <span className="font-semibold text-slate-400">Legend:</span>
        <span className="flex items-center gap-1 text-teal-400">
          <span className="w-2 h-2 rounded-full bg-teal-400"></span> Observed
        </span>
        <span className="flex items-center gap-1 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span> Inferred
        </span>
        <span className="flex items-center gap-1 text-slate-400">
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
        <Background color="#1E293B" gap={16} size={1} />
        <Controls className="!bg-slate-900 !border-slate-800 !text-slate-300" />
      </ReactFlow>
    </div>
  );
}
