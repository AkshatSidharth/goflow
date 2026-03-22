import React, { useCallback, useRef, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';
import { toPng } from 'html-to-image';
import StartEndNode from './nodes/StartEndNode.jsx';
import ProcessNode from './nodes/ProcessNode.jsx';
import DecisionNode from './nodes/DecisionNode.jsx';

const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
};

function getMiniMapNodeColor(node) {
  const type = node.data?.nodeType || node.type;
  switch (type) {
    case 'start':    return '#6366f1';
    case 'end':      return '#10b981';
    case 'decision': return '#f59e0b';
    default:         return '#475569';
  }
}

/** Add Node panel — shown when user clicks "+ Add Node" */
function AddNodePanel({ onAdd, onClose }) {
  const [nodeType, setNodeType] = useState('process');
  const [label, setLabel] = useState('');
  const inputRef = useRef(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(nodeType, trimmed);
    onClose();
  };

  const NODE_TYPES = [
    { value: 'process',  label: 'Process',  color: 'text-slate-300',  bg: 'bg-slate-700', border: 'border-slate-500' },
    { value: 'decision', label: 'Decision', color: 'text-amber-300',  bg: 'bg-amber-900/60', border: 'border-amber-600' },
    { value: 'start',    label: 'Start',    color: 'text-indigo-300', bg: 'bg-indigo-900/60', border: 'border-indigo-500' },
    { value: 'end',      label: 'End',      color: 'text-emerald-300', bg: 'bg-emerald-900/60', border: 'border-emerald-500' },
  ];

  return (
    <div className="absolute top-14 right-3 z-30 w-60 bg-gray-900/95 backdrop-blur-md border border-gray-700/80 rounded-2xl shadow-2xl shadow-black/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-200 font-semibold text-sm">Add Node</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Node type selector */}
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Type</p>
          <div className="grid grid-cols-2 gap-1.5">
            {NODE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setNodeType(t.value)}
                className={`
                  px-2 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150
                  ${nodeType === t.value
                    ? `${t.bg} ${t.border} ${t.color} shadow-sm`
                    : 'bg-gray-800/60 border-gray-700/60 text-gray-500 hover:border-gray-600 hover:text-gray-400'}
                `}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Label input */}
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Label</p>
          <input
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Node label…"
            className="w-full bg-gray-800/80 border border-gray-700/60 rounded-lg px-3 py-2 text-gray-200 text-sm outline-none focus:border-indigo-500/70 transition-colors placeholder-gray-600"
          />
        </div>

        <button
          type="submit"
          disabled={!label.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2 transition-colors shadow-sm"
        >
          Add to Canvas
        </button>
      </form>
    </div>
  );
}

function CanvasToolbar({ nodeCount, edgeCount, onExport, isExporting, detectedLanguage, onAddNodeClick, showAddPanel }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
      {/* Left: Stats */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700/80 rounded-xl px-3 py-1.5 flex items-center gap-3 text-xs shadow-lg">
          <span className="text-gray-400">
            <span className="text-white font-semibold">{nodeCount}</span> nodes
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-gray-400">
            <span className="text-white font-semibold">{edgeCount}</span> edges
          </span>
          {detectedLanguage && detectedLanguage !== 'EN' && (
            <>
              <span className="text-gray-700">·</span>
              <span className="bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-lg text-xs font-medium border border-indigo-700/50">
                {detectedLanguage}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Add Node button */}
        <button
          onClick={onAddNodeClick}
          className={`
            flex items-center gap-1.5 px-3 py-1.5
            text-xs font-medium rounded-xl border shadow-lg
            transition-all duration-150
            ${showAddPanel
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-gray-900/90 backdrop-blur-md border-gray-700/80 text-gray-300 hover:border-indigo-500/60 hover:text-white hover:bg-gray-800/90'}
          `}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Node
        </button>

        {/* Export button */}
        <button
          onClick={onExport}
          disabled={isExporting || nodeCount === 0}
          data-tooltip="Export as PNG"
          className="
            flex items-center gap-1.5 px-3 py-1.5
            bg-indigo-600 hover:bg-indigo-500
            disabled:opacity-40 disabled:cursor-not-allowed
            text-white text-xs font-medium
            rounded-xl border border-indigo-500/60
            shadow-lg shadow-indigo-900/30
            transition-all duration-150
          "
        >
          {isExporting ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PNG
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <div className="text-center space-y-5 max-w-sm px-6">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-900/20 border border-indigo-700/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-gray-300 font-semibold text-base mb-1.5">
            Your flowchart will appear here
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Describe any process in the chat panel and FlowMind will generate an interactive diagram.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-left">
          {[
            { icon: '◇', label: 'Decision branches', color: 'text-amber-400' },
            { icon: '○', label: 'Start / End ovals',  color: 'text-indigo-400' },
            { icon: '□', label: 'Process steps',      color: 'text-slate-300' },
            { icon: '↺', label: 'Loop detection',     color: 'text-orange-400' },
          ].map(({ icon, label, color }) => (
            <div key={label} className="flex items-center gap-2 bg-gray-800/40 border border-gray-700/40 rounded-xl px-3 py-2">
              <span className={`${color} font-bold text-base`}>{icon}</span>
              <span className="text-gray-400 text-xs">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-gray-600 text-xs">
          Tip: double-click any node to rename it · select a node to delete it
        </p>
      </div>
    </div>
  );
}

export default function FlowchartCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  detectedLanguage,
  onNodeLabelChange,
  onNodeDelete,
  onAddNode,
}) {
  const reactFlowWrapper = useRef(null);
  const { fitView } = useReactFlow();
  const [isExporting, setIsExporting] = React.useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const hasContent = nodes && nodes.length > 0;

  React.useEffect(() => {
    if (hasContent) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.15, duration: 400 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, fitView, hasContent]);

  // Inject editing callbacks into each node's data
  const enrichedNodes = useMemo(() =>
    nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onLabelChange: onNodeLabelChange,
        onDelete: onNodeDelete,
      },
    })),
    [nodes, onNodeLabelChange, onNodeDelete]
  );

  const handleExport = useCallback(async () => {
    if (!reactFlowWrapper.current || isExporting) return;
    setIsExporting(true);
    try {
      const rfViewport = reactFlowWrapper.current.querySelector('.react-flow__renderer');
      const targetEl = rfViewport || reactFlowWrapper.current;
      const dataUrl = await toPng(targetEl, {
        backgroundColor: '#0f172a',
        pixelRatio: 2,
        filter: (node) => {
          if (node.classList) {
            return (
              !node.classList.contains('react-flow__controls') &&
              !node.classList.contains('react-flow__minimap') &&
              !node.classList.contains('canvas-toolbar')
            );
          }
          return true;
        },
      });
      const link = document.createElement('a');
      link.download = `flowmind-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[Export] Failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  const handleAddNode = useCallback((nodeType, label) => {
    onAddNode?.(nodeType, label);
  }, [onAddNode]);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    style: { stroke: '#64748b', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#64748b' },
  }), []);

  return (
    <div ref={reactFlowWrapper} className="relative w-full h-full">
      {/* Toolbar */}
      {hasContent && (
        <div className="canvas-toolbar">
          <CanvasToolbar
            nodeCount={nodes.length}
            edgeCount={edges.length}
            onExport={handleExport}
            isExporting={isExporting}
            detectedLanguage={detectedLanguage}
            onAddNodeClick={() => setShowAddPanel((v) => !v)}
            showAddPanel={showAddPanel}
          />
        </div>
      )}

      {/* Add Node panel */}
      {showAddPanel && (
        <AddNodePanel
          onAdd={handleAddNode}
          onClose={() => setShowAddPanel(false)}
        />
      )}

      <ReactFlow
        nodes={enrichedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2.5}
        deleteKeyCode={null}
        className="bg-slate-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1e293b"
        />
        <Controls
          position="bottom-right"
          showInteractive={false}
          className="border border-slate-700/80"
        />
        <MiniMap
          position="bottom-left"
          nodeColor={getMiniMapNodeColor}
          maskColor="rgba(15, 23, 42, 0.75)"
          style={{
            backgroundColor: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 12,
          }}
        />
      </ReactFlow>

      {!hasContent && <EmptyState />}
    </div>
  );
}
