import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  addEdge,
  ConnectionMode,
} from 'reactflow';
import { toPng, toJpeg, toSvg } from 'html-to-image';
import StartEndNode from './nodes/StartEndNode.jsx';
import ProcessNode from './nodes/ProcessNode.jsx';
import DecisionNode from './nodes/DecisionNode.jsx';
import IONode from './nodes/IONode.jsx';
import DatabaseNode from './nodes/DatabaseNode.jsx';
import DocumentNode from './nodes/DocumentNode.jsx';
import HexagonNode from './nodes/HexagonNode.jsx';

// ─── Custom deletable + reconnectable edge ────────────────────────────────────

function DeletableEdge({
  id, source, target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd, label, data,
}) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    data?.onDelete?.(id, source, target);
  }, [id, source, target, data]);

  return (
    <>
      {/* Wide transparent hit area for hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

      {/* Visible grab handles at source + target — appear on hover so user knows where to drag */}
      {hovered && (
        <>
          <circle cx={sourceX} cy={sourceY} r={6} fill="#6366f1" stroke="#0f172a" strokeWidth={2} style={{ pointerEvents: 'none' }} />
          <circle cx={targetX} cy={targetY} r={6} fill="#6366f1" stroke="#0f172a" strokeWidth={2} style={{ pointerEvents: 'none' }} />
        </>
      )}

      <EdgeLabelRenderer>
        {/* Edge label */}
        {label && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="bg-slate-800/80 text-gray-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-600/60"
          >
            {label}
          </div>
        )}

        {/* Delete button — shown on hover */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (label ? 16 : 0)}px)`,
            pointerEvents: 'all',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 150ms',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="nodrag nopan"
        >
          <button
            onClick={handleDelete}
            title="Remove connection"
            className="w-5 h-5 rounded-full bg-red-600/90 hover:bg-red-500 border border-red-400/60 flex items-center justify-center shadow-md transition-colors"
          >
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
  io: IONode,
  database: DatabaseNode,
  document: DocumentNode,
  hexagon: HexagonNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

function getMiniMapNodeColor(node) {
  const type = node.data?.nodeType || node.type;
  switch (type) {
    case 'start':    return '#6366f1';
    case 'end':      return '#10b981';
    case 'decision': return '#f59e0b';
    case 'io':       return '#06b6d4';
    case 'database': return '#8b5cf6';
    case 'document': return '#14b8a6';
    case 'hexagon':  return '#f97316';
    default:         return '#475569';
  }
}

// ─── Add Node panel ───────────────────────────────────────────────────────────

const NODE_TYPE_CONFIG = [
  { value: 'process',  label: 'Process',   icon: '▭', color: 'text-slate-300',   bg: 'bg-slate-700',       border: 'border-slate-500',   desc: 'Action / step' },
  { value: 'decision', label: 'Decision',  icon: '◇', color: 'text-amber-300',   bg: 'bg-amber-900/60',    border: 'border-amber-600',   desc: 'Branch / condition' },
  { value: 'start',    label: 'Start',     icon: '▶', color: 'text-indigo-300',  bg: 'bg-indigo-900/60',   border: 'border-indigo-500',  desc: 'Entry point' },
  { value: 'end',      label: 'End',       icon: '■', color: 'text-emerald-300', bg: 'bg-emerald-900/60',  border: 'border-emerald-500', desc: 'Terminator' },
  { value: 'io',       label: 'I/O',       icon: '⇌', color: 'text-cyan-300',    bg: 'bg-cyan-900/60',     border: 'border-cyan-500',    desc: 'Input / Output' },
  { value: 'database', label: 'Database',  icon: '⬡', color: 'text-violet-300',  bg: 'bg-violet-900/60',   border: 'border-violet-500',  desc: 'Storage' },
  { value: 'document', label: 'Document',  icon: '📄', color: 'text-teal-300',    bg: 'bg-teal-900/60',     border: 'border-teal-500',    desc: 'Report / file' },
  { value: 'hexagon',  label: 'Prep',      icon: '⬡', color: 'text-orange-300',  bg: 'bg-orange-900/60',   border: 'border-orange-500',  desc: 'Preparation' },
];

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

  return (
    <div className="absolute top-14 right-3 z-30 w-64 bg-gray-900/95 backdrop-blur-md border border-gray-700/80 rounded-2xl shadow-2xl shadow-black/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-200 font-semibold text-sm">Add Shape</h3>
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
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Shape</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
            {NODE_TYPE_CONFIG.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setNodeType(t.value)}
                title={t.desc}
                className={`
                  flex flex-col items-start px-2.5 py-2 rounded-lg text-left border transition-all duration-150
                  ${nodeType === t.value
                    ? `${t.bg} ${t.border} ${t.color} shadow-sm`
                    : 'bg-gray-800/60 border-gray-700/60 text-gray-500 hover:border-gray-600 hover:text-gray-400'}
                `}
              >
                <span className="text-sm mb-0.5">{t.icon}</span>
                <span className="text-xs font-medium leading-none">{t.label}</span>
                <span className="text-[9px] opacity-60 leading-none mt-0.5">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

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

// ─── Connection popup (draw.io–style shape picker on empty-canvas drop) ──────

function ConnectionPopup({ popup, onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Flip popup direction based on screen position so it stays in view
  const left = popup.screenX > window.innerWidth  * 0.6 ? popup.screenX - 216 : popup.screenX + 12;
  const top  = popup.screenY > window.innerHeight * 0.6 ? popup.screenY - 250 : popup.screenY - 12;

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 1000 }}
      className="w-52 bg-gray-900/98 backdrop-blur-md border border-indigo-500/40 rounded-2xl shadow-2xl shadow-black/70 p-3"
    >
      {/* Arrow pointer toward cursor */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <p className="text-gray-200 text-xs font-semibold">Connect to…</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {NODE_TYPE_CONFIG.map((t) => (
          <button
            key={t.value}
            onClick={() => { onSelect(t.value, t.label); onClose(); }}
            title={t.desc}
            className={`
              flex flex-col items-start px-2 py-1.5 rounded-lg border transition-all duration-100
              ${t.bg} ${t.border} ${t.color}
              hover:brightness-125 hover:shadow-sm active:scale-95
            `}
          >
            <span className="text-base mb-0.5">{t.icon}</span>
            <span className="text-[10px] font-semibold leading-none">{t.label}</span>
            <span className="text-[9px] opacity-55 leading-none mt-0.5">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Export dropdown ──────────────────────────────────────────────────────────

const EXPORT_FORMATS = [
  { id: 'png', label: 'PNG', ext: 'png' },
  { id: 'jpg', label: 'JPG', ext: 'jpg' },
  { id: 'svg', label: 'SVG', ext: 'svg' },
  { id: 'pdf', label: 'PDF', ext: 'pdf' },
];

function ExportDropdown({ onExport, isExporting, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
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
            Export
            <svg className="w-2.5 h-2.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-28 bg-gray-900/95 backdrop-blur-md border border-gray-700/80 rounded-xl shadow-2xl overflow-hidden z-50">
          {EXPORT_FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => { setOpen(false); onExport(fmt.id); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-indigo-600/30 hover:text-white transition-colors flex items-center gap-2"
            >
              <span className="text-[10px] font-bold text-indigo-400 w-7">{fmt.label}</span>
              <span className="text-gray-500">.{fmt.ext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Canvas toolbar ───────────────────────────────────────────────────────────

function CanvasToolbar({ nodeCount, edgeCount, onExport, isExporting, detectedLanguage, onAddNodeClick, showAddPanel, onUndo, onRedo, canUndo, canRedo }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
      {/* Left: Stats + Undo/Redo */}
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

        {/* Undo / Redo */}
        <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700/80 rounded-xl flex items-center shadow-lg overflow-hidden divide-x divide-gray-700/80">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="px-2.5 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="px-2.5 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 pointer-events-auto">
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
          Add Shape
        </button>

        <ExportDropdown
          onExport={onExport}
          isExporting={isExporting}
          disabled={isExporting || nodeCount === 0}
        />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

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
            { icon: '▭', label: 'Process steps',      color: 'text-slate-300' },
            { icon: '⇌', label: 'I/O parallelogram',  color: 'text-cyan-400' },
            { icon: '⬡', label: 'Database cylinder',  color: 'text-violet-400' },
            { icon: '📄', label: 'Document shape',     color: 'text-teal-400' },
            { icon: '⬡', label: 'Prep hexagon',       color: 'text-orange-400' },
            { icon: '↩', label: 'Drag to reconnect',  color: 'text-sky-400' },
          ].map(({ icon, label, color }) => (
            <div key={label} className="flex items-center gap-2 bg-gray-800/40 border border-gray-700/40 rounded-xl px-3 py-2">
              <span className={`${color} font-bold text-base`}>{icon}</span>
              <span className="text-gray-400 text-xs">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-gray-600 text-xs">
          Tip: drag node handle to connect · hover edge to delete · drag edge end to reconnect
        </p>
      </div>
    </div>
  );
}

// ─── Main canvas component ────────────────────────────────────────────────────

export default function FlowchartCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  detectedLanguage,
  onNodeLabelChange,
  onNodeDelete,
  onAddNode,
  onConnect,
  onEdgeDelete,
  onReconnect,
  onAddConnectedNode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  const reactFlowWrapper = useRef(null);
  const { fitView, project } = useReactFlow();
  const [isExporting, setIsExporting] = React.useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [connectionPopup, setConnectionPopup] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Track when an edge reconnect is in progress to prevent accidental deletes
  const edgeReconnectSuccessful = useRef(true);

  // Track connection drag state for the empty-canvas popup
  const connectingRef = useRef(null);
  const connectSuccessRef = useRef(false);

  const hasContent = nodes && nodes.length > 0;

  const nodeCount = nodes.length;

  // Only re-fit when nodes are added/removed — NOT on drag (position change)
  React.useEffect(() => {
    if (nodeCount === 0) return;
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 400, maxZoom: 1 });
    }, 100);
    return () => clearTimeout(timer);
  }, [nodeCount, fitView]);

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

  // Inject delete callback + make edges reconnectable
  const enrichedEdges = useMemo(() =>
    edges.map((e) => ({
      ...e,
      type: 'deletable',

      data: { ...e.data, onDelete: onEdgeDelete },
    })),
    [edges, onEdgeDelete]
  );

  // ─── Connection-to-new-node popup handlers ──────────────────────────────────

  const handleConnectStart = useCallback((_event, { nodeId }) => {
    connectingRef.current = { nodeId };
    connectSuccessRef.current = false;
  }, []);

  // Intercept successful connects to mark them as such
  const handleConnect = useCallback((params) => {
    connectSuccessRef.current = true;
    onConnect?.(params);
  }, [onConnect]);

  const handleConnectEnd = useCallback((event) => {
    // Only show popup if drag ended WITHOUT connecting to an existing node
    if (connectSuccessRef.current || !connectingRef.current) return;

    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;

    const flowPos = project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    setConnectionPopup({
      screenX: event.clientX,
      screenY: event.clientY,
      flowX: flowPos.x,
      flowY: flowPos.y,
      sourceNodeId: connectingRef.current.nodeId,
    });

    connectingRef.current = null;
  }, [project]);

  // ─── Drag-from-palette-onto-canvas handlers ──────────────────────────────────

  const handleDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes('application/flowmind-node-type')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Only clear if the pointer truly left the wrapper element
    if (!reactFlowWrapper.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const nodeType = e.dataTransfer.getData('application/flowmind-node-type');
    const defaultLabel = e.dataTransfer.getData('application/flowmind-node-label');
    if (!nodeType) return;

    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;

    const flowPos = project({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    });

    onAddNode?.(nodeType, defaultLabel, flowPos.x, flowPos.y);
  }, [project, onAddNode]);

  // ─── Edge reconnect handlers ────────────────────────────────────────────────

  const handleEdgeUpdateStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const handleEdgeUpdate = useCallback((oldEdge, newConnection) => {
    edgeReconnectSuccessful.current = true;
    onReconnect?.(oldEdge, newConnection);
  }, [onReconnect]);

  const handleEdgeUpdateEnd = useCallback((_, edge) => {
    // If drag ended without connecting to a node, remove the dangling edge
    if (!edgeReconnectSuccessful.current) {
      onEdgeDelete?.(edge.id, edge.source, edge.target);
    }
    edgeReconnectSuccessful.current = true;
  }, [onEdgeDelete]);

  // ─── Export ────────────────────────────────────────────────────────────────

  const getExportTarget = () => {
    const rfViewport = reactFlowWrapper.current?.querySelector('.react-flow__renderer');
    return rfViewport || reactFlowWrapper.current;
  };

  const exportFilter = (node) => {
    if (node.classList) {
      return (
        !node.classList.contains('react-flow__controls') &&
        !node.classList.contains('react-flow__minimap') &&
        !node.classList.contains('canvas-toolbar')
      );
    }
    return true;
  };

  const downloadDataUrl = (dataUrl, filename) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const handleExport = useCallback(async (format) => {
    if (!reactFlowWrapper.current || isExporting) return;
    setIsExporting(true);
    const ts = Date.now();

    try {
      const targetEl = getExportTarget();
      const commonOpts = {
        backgroundColor: '#0f172a',
        pixelRatio: 2,
        filter: exportFilter,
      };

      if (format === 'png') {
        const url = await toPng(targetEl, commonOpts);
        downloadDataUrl(url, `flowmind-${ts}.png`);
      } else if (format === 'jpg') {
        const url = await toJpeg(targetEl, { ...commonOpts, quality: 0.95 });
        downloadDataUrl(url, `flowmind-${ts}.jpg`);
      } else if (format === 'svg') {
        const url = await toSvg(targetEl, commonOpts);
        downloadDataUrl(url, `flowmind-${ts}.svg`);
      } else if (format === 'pdf') {
        const pngUrl = await toPng(targetEl, commonOpts);
        const img = new Image();
        img.src = pngUrl;
        await new Promise((res) => { img.onload = res; });
        const w = img.naturalWidth / 2;
        const h = img.naturalHeight / 2;
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({
          orientation: w >= h ? 'landscape' : 'portrait',
          unit: 'px',
          format: [w, h],
          hotfixes: ['px_scaling'],
        });
        pdf.addImage(pngUrl, 'PNG', 0, 0, w, h);
        pdf.save(`flowmind-${ts}.pdf`);
      }
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
    type: 'deletable',
    reconnectable: true,
    style: { stroke: '#64748b', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#64748b' },
  }), []);

  return (
    <div
      ref={reactFlowWrapper}
      className="relative w-full h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone highlight */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 pointer-events-none ring-2 ring-inset ring-indigo-500/60 rounded-none">
          <div className="absolute inset-0 bg-indigo-500/5" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gray-900/90 border border-indigo-500/60 rounded-2xl px-6 py-3 shadow-2xl flex items-center gap-2.5">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-indigo-200 font-medium text-sm">Drop to place shape</span>
            </div>
          </div>
        </div>
      )}
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
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      )}

      {/* Add Shape panel */}
      {showAddPanel && (
        <AddNodePanel
          onAdd={handleAddNode}
          onClose={() => setShowAddPanel(false)}
        />
      )}

      <ReactFlow
        nodes={enrichedNodes}
        edges={enrichedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onEdgeUpdate={handleEdgeUpdate}
        onEdgeUpdateStart={handleEdgeUpdateStart}
        onEdgeUpdateEnd={handleEdgeUpdateEnd}
        edgeUpdaterRadius={20}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={2.5}
        deleteKeyCode={null}
        className="bg-slate-950"
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
        connectionLineType="smoothstep"
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
          position="bottom-right"
          nodeColor={getMiniMapNodeColor}
          maskColor="rgba(15, 23, 42, 0.75)"
          style={{
            backgroundColor: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 12,
            marginBottom: 48,
          }}
        />
      </ReactFlow>

      {!hasContent && <EmptyState />}

      {/* Draw.io–style shape picker popup when drag-to-connect lands on empty canvas */}
      {connectionPopup && (
        <ConnectionPopup
          popup={connectionPopup}
          onSelect={(nodeType, defaultLabel) => {
            onAddConnectedNode?.(
              connectionPopup.sourceNodeId,
              nodeType,
              defaultLabel,
              connectionPopup.flowX,
              connectionPopup.flowY,
            );
          }}
          onClose={() => setConnectionPopup(null)}
        />
      )}
    </div>
  );
}
