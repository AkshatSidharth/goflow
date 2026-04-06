import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';

function RotationHandle({ id, data }) {
  const handleMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const nodeEl = e.currentTarget.closest('.react-flow__node');
    if (!nodeEl) return;
    const rect = nodeEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const onMove = (me) => {
      const angle = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI) + 90;
      data.onRotate?.(id, Math.round(angle));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="nodrag absolute"
      style={{
        top: -28, left: '50%', transform: 'translateX(-50%)',
        width: 16, height: 16, borderRadius: '50%',
        background: '#0f172a', border: '2px solid #6366f1',
        cursor: 'crosshair', zIndex: 10, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      title="Rotate"
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
        <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

const ProcessNode = memo(({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);
  const inputRef = useRef(null);

  const rotation = data.rotation || 0;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // Keep local label in sync if data.label changes externally
  useEffect(() => {
    if (!isEditing) setEditLabel(data.label);
  }, [data.label, isEditing]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    setEditLabel(data.label);
    setIsEditing(true);
  }, [data.label]);

  const handleSave = useCallback(() => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== data.label) {
      data.onLabelChange?.(id, trimmed);
    }
    setIsEditing(false);
  }, [editLabel, data, id]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setIsEditing(false); setEditLabel(data.label); }
  }, [handleSave, data.label]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    data.onDelete?.(id);
  }, [data, id]);

  const ringClass = selected
    ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900'
    : '';

  const nodeW = useStore(s => s.nodeInternals.get(id)?.width  ?? 160);
  const nodeH = useStore(s => s.nodeInternals.get(id)?.height ?? 48);

  return (
    <div
      className={`flowmind-node relative flex items-center justify-center px-3 py-2 rounded-xl bg-slate-800/90 backdrop-blur-sm border border-slate-600/60 shadow-lg shadow-slate-900/60 ${ringClass} select-none transition-all duration-200 hover:border-slate-500 hover:shadow-slate-800/40`}
      style={{ width: nodeW, height: nodeH, cursor: isEditing ? 'text' : 'default', transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={30}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: '#0f172a', border: '2px solid #6366f1' }}
        lineStyle={{ border: '1.5px dashed rgba(99,102,241,0.6)' }}
      />

      {selected && !isEditing && (
        <RotationHandle id={id} data={data} />
      )}

      {/* Bidirectional handles — each position has both source + target stacked */}
      <Handle type="target" position={Position.Top}    id="top-t"    style={{ background: '#94a3b8', width: 8, height: 8, border: '2px solid #0f172a', top: -4 }} />
      <Handle type="source" position={Position.Top}    id="top-s"    style={{ background: '#94a3b8', width: 8, height: 8, border: '2px solid #0f172a', top: -4 }} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" style={{ background: '#94a3b8', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4 }} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" style={{ background: '#94a3b8', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4 }} />
      <Handle type="target" position={Position.Left}   id="left-t"   style={{ background: '#94a3b8', width: 8, height: 8, border: '2px solid #0f172a', left: -4 }} />
      <Handle type="source" position={Position.Left}   id="left-s"   style={{ background: '#94a3b8', width: 8, height: 8, border: '2px solid #0f172a', left: -4 }} />
      <Handle type="target" position={Position.Right}  id="right-t"  style={{ background: '#94a3b8', width: 8, height: 8, border: '2px solid #0f172a', right: -4 }} />
      <Handle type="source" position={Position.Right}  id="right-s"  style={{ background: '#94a3b8', width: 8, height: 8, border: '2px solid #0f172a', right: -4 }} />

      {isEditing ? (
        <input
          ref={inputRef}
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-700 text-slate-100 text-sm font-medium text-center rounded-lg px-2 py-1 outline-none border border-indigo-500 w-full nodrag"
          style={{ minWidth: '80px', maxWidth: '180px' }}
        />
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs flex-shrink-0" aria-hidden="true">⬡</span>
          <span className="text-slate-100 font-medium text-sm leading-snug text-center break-words hyphens-auto">
            {data.label}
          </span>
        </div>
      )}

      {/* Delete button — shown when selected */}
      {selected && !isEditing && (
        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 border border-red-400/60 flex items-center justify-center text-white font-bold transition-colors z-10 shadow-sm nodrag"
          title="Delete node"
          style={{ fontSize: '13px', lineHeight: 1 }}
        >
          ×
        </button>
      )}

      {/* Edit hint on hover */}
      {!isEditing && !selected && (
        <div className="absolute inset-x-0 -bottom-5 flex justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-[9px] text-gray-500">double-click to edit</span>
        </div>
      )}

    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';
export default ProcessNode;
