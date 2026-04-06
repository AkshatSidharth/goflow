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
  getBezierPath,
  getStraightPath,
  addEdge,
  ConnectionMode,
  Handle,
  Position,
} from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import { toPng, toJpeg, toSvg } from 'html-to-image';
import StartEndNode from './nodes/StartEndNode.jsx';
import ProcessNode from './nodes/ProcessNode.jsx';
import DecisionNode from './nodes/DecisionNode.jsx';
import IONode from './nodes/IONode.jsx';
import DatabaseNode from './nodes/DatabaseNode.jsx';
import DocumentNode from './nodes/DocumentNode.jsx';
import HexagonNode from './nodes/HexagonNode.jsx';

// ─── Helper: line-segment intersection for jump lines ────────────────────────
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const dxAB = bx - ax, dyAB = by - ay;
  const dxCD = dx - cx, dyCD = dy - cy;
  const denom = dxAB * dyCD - dyAB * dxCD;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((cx - ax) * dyCD - (cy - ay) * dxCD) / denom;
  const u = ((cx - ax) * dyAB - (cy - ay) * dxAB) / denom;
  if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
    return { x: ax + t * dxAB, y: ay + t * dyAB };
  }
  return null;
}

// ─── Custom deletable + reconnectable edge ────────────────────────────────────

function DeletableEdge({
  id, source, target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd, label, data, selected,
}) {
  const [hovered, setHovered] = useState(false);
  const { project, setEdges } = useReactFlow();

  const connectorType = data?.connectorType || 'smoothstep';
  const waypoints     = data?.waypoints     || [];
  const jumpLines     = data?.jumpLines     ?? false;
  const allEdgePaths  = data?.allEdgePaths  || [];

  // ── Compute path through optional waypoints ──
  const [edgePath, labelX, labelY] = useMemo(() => {
    const base = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
    if (waypoints.length === 0) {
      if (connectorType === 'straight') return getStraightPath(base);
      if (connectorType === 'bezier')   return getBezierPath(base);
      if (connectorType === 'step')     return getSmoothStepPath({ ...base, borderRadius: 0 });
      return getSmoothStepPath(base);
    }
    // Build polyline through waypoints
    const pts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
    let d = `M ${pts[0].x},${pts[0].y}`;
    if (connectorType === 'bezier') {
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i];
        d += ` Q ${(p.x + q.x) / 2},${p.y} ${q.x},${q.y}`;
      }
    } else {
      for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x},${pts[i].y}`;
    }
    const mid = pts[Math.floor(pts.length / 2)];
    return [d, mid.x, mid.y];
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, connectorType, waypoints]);

  // ── Jump line arcs (straight segments only) ──
  const jumpArcs = useMemo(() => {
    if (!jumpLines || connectorType !== 'straight' || waypoints.length > 0) return [];
    const crossings = [];
    for (const other of allEdgePaths) {
      if (other.id === id) continue;
      const pt = segmentsIntersect(sourceX, sourceY, targetX, targetY,
        other.sx, other.sy, other.tx, other.ty);
      if (pt) crossings.push(pt);
    }
    return crossings;
  }, [jumpLines, connectorType, waypoints, allEdgePaths, id, sourceX, sourceY, targetX, targetY]);

  // Build final path with jump arcs
  const finalPath = useMemo(() => {
    if (jumpArcs.length === 0) return edgePath;
    const R = 8;
    const dir = { x: targetX - sourceX, y: targetY - sourceY };
    const len = Math.sqrt(dir.x ** 2 + dir.y ** 2) || 1;
    const ux = dir.x / len, uy = dir.y / len;
    // Sort crossings by distance from source
    const sorted = [...jumpArcs].sort((a, b) => {
      const da = (a.x - sourceX) ** 2 + (a.y - sourceY) ** 2;
      const db = (b.x - sourceX) ** 2 + (b.y - sourceY) ** 2;
      return da - db;
    });
    let d = `M ${sourceX},${sourceY}`;
    let prev = { x: sourceX, y: sourceY };
    for (const c of sorted) {
      const e1 = { x: c.x - ux * R, y: c.y - uy * R };
      const e2 = { x: c.x + ux * R, y: c.y + uy * R };
      d += ` L ${e1.x},${e1.y}`;
      d += ` A ${R} ${R} 0 0 1 ${e2.x},${e2.y}`;
      prev = e2;
    }
    d += ` L ${targetX},${targetY}`;
    return d;
  }, [edgePath, jumpArcs, sourceX, sourceY, targetX, targetY]);

  // ── Delete handler ──
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    data?.onDelete?.(id, source, target);
  }, [id, source, target, data]);

  // ── Add waypoint on double-click ──
  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    const bounds = e.currentTarget.closest('.react-flow__pane')?.getBoundingClientRect()
      || { left: 0, top: 0 };
    const flowPt = project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    setEdges(prev => prev.map(edge =>
      edge.id === id
        ? { ...edge, data: { ...edge.data, waypoints: [...(edge.data?.waypoints || []), flowPt] } }
        : edge
    ));
  }, [id, project, setEdges]);

  // ── Drag waypoint ──
  const startDragWaypoint = useCallback((e, wpIdx) => {
    e.stopPropagation();
    e.preventDefault();
    const onMove = (me) => {
      const paneEl = document.querySelector('.react-flow__pane');
      const bounds = paneEl?.getBoundingClientRect() || { left: 0, top: 0 };
      const fp = project({ x: me.clientX - bounds.left, y: me.clientY - bounds.top });
      setEdges(prev => prev.map(edge => {
        if (edge.id !== id) return edge;
        const wps = [...(edge.data?.waypoints || [])];
        wps[wpIdx] = fp;
        return { ...edge, data: { ...edge.data, waypoints: wps } };
      }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [id, project, setEdges]);

  // ── Remove waypoint on right-click ──
  const removeWaypoint = useCallback((e, wpIdx) => {
    e.preventDefault();
    e.stopPropagation();
    setEdges(prev => prev.map(edge =>
      edge.id === id
        ? { ...edge, data: { ...edge.data, waypoints: (edge.data?.waypoints || []).filter((_, i) => i !== wpIdx) } }
        : edge
    ));
  }, [id, setEdges]);

  return (
    <>
      {/* Wide transparent hit area */}
      <path
        d={finalPath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge path={finalPath} markerEnd={markerEnd} style={style} />

      {/* Endpoint grab handles */}
      {hovered && (
        <>
          <circle cx={sourceX} cy={sourceY} r={6} fill="#6366f1" stroke="#0f172a" strokeWidth={2} style={{ pointerEvents: 'none' }} />
          <circle cx={targetX} cy={targetY} r={6} fill="#6366f1" stroke="#0f172a" strokeWidth={2} style={{ pointerEvents: 'none' }} />
        </>
      )}

      {/* Waypoint handles */}
      {(hovered || selected) && waypoints.map((wp, i) => (
        <circle
          key={i}
          cx={wp.x} cy={wp.y} r={5}
          fill="#f59e0b" stroke="#0f172a" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onMouseDown={(e) => startDragWaypoint(e, i)}
          onContextMenu={(e) => removeWaypoint(e, i)}
        />
      ))}

      <EdgeLabelRenderer>
        {label && (
          <div
            style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'none' }}
            className="bg-slate-800/80 text-gray-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-600/60"
          >
            {label}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY + (label ? 16 : 0)}px)`,
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

// ─── Group / Container node ───────────────────────────────────────────────────

function GroupNode({ id, data, selected }) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState(data.label || 'Group');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingLabel) inputRef.current?.focus();
  }, [editingLabel]);

  const save = () => {
    const v = labelVal.trim();
    if (v && v !== data.label) data.onLabelChange?.(id, v);
    setEditingLabel(false);
  };

  return (
    <div
      className={`relative w-full h-full rounded-xl select-none ${selected ? 'ring-2 ring-indigo-400/60' : ''}`}
      style={{ background: 'rgba(99,102,241,0.04)', border: '2px dashed rgba(99,102,241,0.35)', minWidth: 200, minHeight: 120 }}
      onDoubleClick={(e) => { e.stopPropagation(); setEditingLabel(true); }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: '#0f172a', border: '2px solid #6366f1' }}
        lineStyle={{ border: '1.5px dashed rgba(99,102,241,0.5)' }}
      />

      {/* Label */}
      <div className="absolute top-2 left-3">
        {editingLabel ? (
          <input
            ref={inputRef}
            value={labelVal}
            onChange={(e) => setLabelVal(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditingLabel(false); }}
            className="bg-transparent text-indigo-300 text-xs font-semibold outline-none border-b border-indigo-500 nodrag"
          />
        ) : (
          <span className="text-indigo-400/70 text-xs font-semibold">{data.label || 'Group'}</span>
        )}
      </div>

      {/* Delete button */}
      {selected && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 border border-red-400/60 flex items-center justify-center text-white font-bold transition-colors nodrag shadow-sm"
          style={{ fontSize: 13, lineHeight: 1, zIndex: 10 }}
        >×</button>
      )}

      {/* Bidirectional handles */}
      {[Position.Top, Position.Bottom, Position.Left, Position.Right].map((pos) => (
        <React.Fragment key={pos}>
          <Handle type="source" position={pos} id={`${pos}-s`} style={{ background: '#6366f1', width: 8, height: 8, border: '2px solid #0f172a' }} />
          <Handle type="target" position={pos} id={`${pos}-t`} style={{ background: '#6366f1', width: 8, height: 8, border: '2px solid #0f172a' }} />
        </React.Fragment>
      ))}
    </div>
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
  group: GroupNode,
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

function CanvasToolbar({ nodeCount, edgeCount, onExport, isExporting, detectedLanguage, onAddNodeClick, showAddPanel, onUndo, onRedo, canUndo, canRedo, onSettingsClick, showSettings }) {
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

        {/* Settings gear */}
        <button
          onClick={onSettingsClick}
          title="Canvas settings"
          className={`
            flex items-center justify-center w-8 h-8 rounded-xl border shadow-lg transition-all duration-150
            ${showSettings
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-gray-900/90 backdrop-blur-md border-gray-700/80 text-gray-400 hover:text-white hover:border-gray-600 hover:bg-gray-800/90'}
          `}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
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

// ─── Page background (A4 / Letter boundary) ──────────────────────────────────

const PAGE_SIZES = {
  a4:     { w: 827, h: 1169, label: 'A4' },
  letter: { w: 816, h: 1056, label: 'Letter' },
};

function PageBackground({ mode, viewport }) {
  if (mode === 'infinite') return null;
  const size = PAGE_SIZES[mode];
  const { x: vpX, y: vpY, zoom } = viewport;
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: vpX, top: vpY, width: size.w * zoom, height: size.h * zoom, zIndex: 1 }}
    >
      <div className="w-full h-full border-2 border-indigo-500/40"
        style={{ boxShadow: '0 0 0 9999px rgba(15,23,42,0.40)' }}
      />
      <span className="absolute -top-5 left-0 text-[10px] text-slate-500 font-mono select-none">
        {size.label}
      </span>
    </div>
  );
}

// ─── Smart guides overlay ─────────────────────────────────────────────────────

function SmartGuides({ guides, viewport, wrapperRef }) {
  if (!guides.h.length && !guides.v.length) return null;
  const { x: vpX, y: vpY, zoom } = viewport;
  const rect = wrapperRef.current?.getBoundingClientRect();
  const W = rect?.width  || window.innerWidth;
  const H = rect?.height || window.innerHeight;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {guides.v.map((fx, i) => {
          const sx = fx * zoom + vpX;
          return <line key={`v${i}`} x1={sx} y1={0} x2={sx} y2={H} stroke="#6366f1" strokeWidth={1} strokeDasharray="5 3" opacity={0.75} />;
        })}
        {guides.h.map((fy, i) => {
          const sy = fy * zoom + vpY;
          return <line key={`h${i}`} x1={0} y1={sy} x2={W} y2={sy} stroke="#6366f1" strokeWidth={1} strokeDasharray="5 3" opacity={0.75} />;
        })}
      </svg>
    </div>
  );
}

// ─── Canvas settings panel ────────────────────────────────────────────────────

function SettingsToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-gray-400 text-xs group-hover:text-gray-300 transition-colors">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors duration-200
          ${checked ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 mt-px
          ${checked ? 'translate-x-4' : 'translate-x-px'}`} />
      </button>
    </label>
  );
}

function CanvasSettingsPanel({ gridVisible, onGridToggle, gridStyle, onGridStyleChange, snapEnabled, onSnapToggle, snapSize, onSnapSizeChange, pageMode, onPageModeChange, connectorType, onConnectorTypeChange, jumpLines, onJumpLinesToggle, onClose }) {
  return (
    <div className="absolute top-14 right-3 z-40 w-60 bg-gray-900/98 backdrop-blur-md border border-gray-700/80 rounded-2xl shadow-2xl shadow-black/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-gray-200 font-semibold text-sm">Canvas Settings</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Grid */}
      <div className="space-y-2.5">
        <p className="text-gray-600 text-[10px] uppercase tracking-wider font-semibold">Grid</p>
        <SettingsToggle label="Show grid" checked={gridVisible} onChange={onGridToggle} />
        {gridVisible && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs">Grid style</span>
            <div className="flex gap-1">
              {[
                { id: 'lines', label: '≡' },
                { id: 'dots',  label: '⋯' },
                { id: 'cross', label: '✕' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onGridStyleChange(id)}
                  title={id}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors
                    ${gridStyle === id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <SettingsToggle label="Snap to grid" checked={snapEnabled} onChange={onSnapToggle} />
        {snapEnabled && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs">Grid size</span>
            <div className="flex gap-1">
              {[16, 20, 24, 32].map((s) => (
                <button
                  key={s}
                  onClick={() => onSnapSizeChange(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors
                    ${snapSize === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Connector type */}
      <div className="space-y-2">
        <p className="text-gray-600 text-[10px] uppercase tracking-wider font-semibold">Connectors</p>
        <div className="grid grid-cols-2 gap-1">
          {[
            { id: 'smoothstep', label: 'Smooth' },
            { id: 'step',       label: 'Orthogonal' },
            { id: 'bezier',     label: 'Curved' },
            { id: 'straight',   label: 'Straight' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onConnectorTypeChange(id)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-colors
                ${connectorType === id ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-200' : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:border-gray-600'}`}
            >{label}</button>
          ))}
        </div>
        <SettingsToggle label="Jump lines at crossings" checked={jumpLines} onChange={onJumpLinesToggle} />
      </div>

      {/* View mode */}
      <div className="space-y-2">
        <p className="text-gray-600 text-[10px] uppercase tracking-wider font-semibold">View Mode</p>
        {[
          { id: 'infinite', icon: '∞', label: 'Infinite canvas' },
          { id: 'a4',       icon: '📄', label: 'A4 page' },
          { id: 'letter',   icon: '📄', label: 'Letter page' },
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => onPageModeChange(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors text-left
              ${pageMode === id ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40' : 'text-gray-400 hover:bg-gray-800 border border-transparent'}`}
          >
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Page tabs ────────────────────────────────────────────────────────────────

function PageTabs({ pages, currentPageId, onAdd, onSwitch, onDelete, onRename }) {
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const renameRef = useRef(null);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  const commitRename = () => {
    if (renaming && renameVal.trim()) onRename(renaming, renameVal.trim());
    setRenaming(null);
  };

  return (
    <div className="flex-shrink-0 h-9 bg-gray-900/95 border-t border-gray-800/80 flex items-center px-2 gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {pages.map((page) => (
        <div key={page.id} className="flex-shrink-0">
          {renaming === page.id ? (
            <input
              ref={renameRef}
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
              className="h-6 px-2 bg-gray-800 border border-indigo-500/70 rounded text-xs text-gray-200 outline-none w-24"
            />
          ) : (
            <div className={`flex items-center gap-1 px-2.5 h-6 rounded-t text-xs font-medium cursor-pointer select-none transition-colors group
              ${page.id === currentPageId
                ? 'bg-gray-800 text-gray-200 border-t border-x border-gray-700/80'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'}`}
              onClick={() => onSwitch(page.id)}
              onDoubleClick={() => { setRenaming(page.id); setRenameVal(page.name); }}
            >
              <span className="max-w-[80px] truncate">{page.name}</span>
              {pages.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all ml-0.5 leading-none"
                  title="Delete page"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add page button */}
      <button
        onClick={onAdd}
        title="Add page"
        className="flex-shrink-0 flex items-center justify-center w-6 h-6 ml-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      </button>
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
  onNodeRotate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  // Multi-page props
  pages,
  currentPageId,
  onAddPage,
  onSwitchPage,
  onDeletePage,
  onRenamePage,
}) {
  const reactFlowWrapper = useRef(null);
  const { fitView, project } = useReactFlow();
  const [isExporting, setIsExporting] = React.useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [connectionPopup, setConnectionPopup] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ─── Canvas settings ──────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [gridStyle, setGridStyle] = useState('lines'); // 'lines' | 'dots' | 'cross'
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapSize, setSnapSize] = useState(20);
  const [pageMode, setPageMode] = useState('infinite');
  const [connectorType, setConnectorType] = useState('smoothstep'); // 'smoothstep'|'straight'|'bezier'|'step'
  const [jumpLines, setJumpLines] = useState(false);

  // ─── Viewport tracking (for page background + smart guides) ──────────────
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // ─── Smart guides ─────────────────────────────────────────────────────────
  const [guides, setGuides] = useState({ h: [], v: [] });

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
        onRotate: onNodeRotate,
      },
    })),
    [nodes, onNodeLabelChange, onNodeDelete, onNodeRotate]
  );

  // Precompute straight-edge endpoints for jump line intersection checks
  const straightEdgePaths = useMemo(() => {
    if (!jumpLines) return [];
    return edges.map((e) => ({
      id: e.id,
      sx: e.__rf?.sourceX ?? 0,
      sy: e.__rf?.sourceY ?? 0,
      tx: e.__rf?.targetX ?? 0,
      ty: e.__rf?.targetY ?? 0,
    }));
  }, [edges, jumpLines]);

  // Inject delete callback + connector type + jump lines + waypoint data
  const enrichedEdges = useMemo(() =>
    edges.map((e) => ({
      ...e,
      type: 'deletable',
      data: {
        ...e.data,
        onDelete: onEdgeDelete,
        connectorType: e.data?.connectorType ?? connectorType,
        jumpLines,
        allEdgePaths: straightEdgePaths,
      },
    })),
    [edges, onEdgeDelete, connectorType, jumpLines, straightEdgePaths]
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

  // ─── Smart guides ─────────────────────────────────────────────────────────────

  const handleNodeDrag = useCallback((_event, draggedNode) => {
    const SNAP = 8;
    const dW = draggedNode.width  || 160;
    const dH = draggedNode.height || 48;
    const dCX = draggedNode.position.x + dW / 2;
    const dCY = draggedNode.position.y + dH / 2;
    const dL  = draggedNode.position.x;
    const dR  = draggedNode.position.x + dW;
    const dT  = draggedNode.position.y;
    const dB  = draggedNode.position.y + dH;

    const h = new Set(), v = new Set();
    for (const node of nodes) {
      if (node.id === draggedNode.id) continue;
      const nW = node.width  || 160;
      const nH = node.height || 48;
      const nCX = node.position.x + nW / 2;
      const nCY = node.position.y + nH / 2;
      const nL  = node.position.x;
      const nR  = node.position.x + nW;
      const nT  = node.position.y;
      const nB  = node.position.y + nH;

      [[dCX, nCX], [dL, nL], [dR, nR], [dL, nR], [dR, nL]].forEach(([a, b]) => {
        if (Math.abs(a - b) <= SNAP) v.add(b);
      });
      [[dCY, nCY], [dT, nT], [dB, nB], [dT, nB], [dB, nT]].forEach(([a, b]) => {
        if (Math.abs(a - b) <= SNAP) h.add(b);
      });
    }
    setGuides({ h: [...h], v: [...v] });
  }, [nodes]);

  const handleNodeDragStop = useCallback(() => {
    setGuides({ h: [], v: [] });
  }, []);

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
      className="flex flex-col w-full h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
    {/* Canvas area (takes all space above page tabs) */}
    <div ref={reactFlowWrapper} className="relative flex-1 min-h-0">
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
      {/* Toolbar — always visible */}
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
          onSettingsClick={() => setShowSettings((v) => !v)}
          showSettings={showSettings}
        />
      </div>

      {/* Canvas settings panel */}
      {showSettings && (
        <CanvasSettingsPanel
          gridVisible={gridVisible}
          onGridToggle={setGridVisible}
          gridStyle={gridStyle}
          onGridStyleChange={setGridStyle}
          snapEnabled={snapEnabled}
          onSnapToggle={setSnapEnabled}
          snapSize={snapSize}
          onSnapSizeChange={setSnapSize}
          pageMode={pageMode}
          onPageModeChange={setPageMode}
          connectorType={connectorType}
          onConnectorTypeChange={setConnectorType}
          jumpLines={jumpLines}
          onJumpLinesToggle={setJumpLines}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Add Shape panel */}
      {showAddPanel && (
        <AddNodePanel
          onAdd={handleAddNode}
          onClose={() => setShowAddPanel(false)}
        />
      )}

      {/* Page background (A4 / Letter mode) */}
      <PageBackground mode={pageMode} viewport={viewport} />

      {/* Smart guides overlay */}
      <SmartGuides guides={guides} viewport={viewport} wrapperRef={reactFlowWrapper} />

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
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onMove={(_, vp) => setViewport(vp)}
        snapToGrid={snapEnabled}
        snapGrid={[snapSize, snapSize]}
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
        {gridVisible && (
          <Background
            variant={
              gridStyle === 'dots'  ? BackgroundVariant.Dots
              : gridStyle === 'cross' ? BackgroundVariant.Cross
              : BackgroundVariant.Lines
            }
            gap={snapEnabled ? snapSize : 20}
            size={gridStyle === 'dots' ? 2 : 1}
            color={gridStyle === 'lines' ? '#1e3a5f' : '#2d4a6b'}
          />
        )}
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
    </div>{/* end canvas area */}

    {/* Multi-page tabs */}
    {pages && (
      <PageTabs
        pages={pages}
        currentPageId={currentPageId}
        onAdd={onAddPage}
        onSwitch={onSwitchPage}
        onDelete={onDeletePage}
        onRename={onRenamePage}
      />
    )}
    </div>
  );
}
