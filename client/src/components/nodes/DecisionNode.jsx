import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
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

const DecisionNode = memo(({ id, data, selected }) => {
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
    ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-gray-900'
    : '';

  const containerSize = 110;
  const innerSize = 76;

  return (
    <div
      className={`flowmind-node relative select-none ${ringClass}`}
      style={{ width: containerSize, height: containerSize, cursor: isEditing ? 'text' : 'default', transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
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

      {/* Diamond shape */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: 'rotate(45deg)', transformOrigin: 'center' }}
      >
        <div
          className="bg-amber-900/80 border-2 border-amber-600/70 shadow-lg shadow-amber-900/50 transition-all duration-200 hover:bg-amber-800/80 hover:border-amber-500/80 backdrop-blur-sm"
          style={{ width: innerSize, height: innerSize, borderRadius: 8 }}
        />
      </div>

      {/* Label / edit input */}
      <div
        className="absolute inset-0 flex items-center justify-center px-3"
        style={{ pointerEvents: isEditing ? 'auto' : 'none' }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="bg-amber-900/80 text-amber-100 text-xs font-semibold text-center rounded-lg px-2 py-1 outline-none border border-amber-400 nodrag"
            style={{ maxWidth: '120px', width: '100%', pointerEvents: 'auto' }}
          />
        ) : (
          <span className="text-amber-100 font-semibold text-xs leading-snug text-center break-words hyphens-auto max-w-[120px]">
            {data.label}
          </span>
        )}
      </div>

      {/* Delete button */}
      {selected && !isEditing && (
        <button
          onClick={handleDelete}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 border border-red-400/60 flex items-center justify-center text-white font-bold transition-colors z-10 shadow-sm nodrag"
          title="Delete node"
          style={{ fontSize: '13px', lineHeight: 1, pointerEvents: 'auto' }}
        >
          ×
        </button>
      )}

      {/* Bidirectional handles at all 4 positions */}
      <Handle type="target" position={Position.Top}    id="top-t"    style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Top}    id="top-s"    style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Right}  id="right-t"  style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="source" position={Position.Right}  id="right-s"  style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="target" position={Position.Left}   id="left-t"   style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="source" position={Position.Left}   id="left-s"   style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '50%', transform: 'translateY(-50%)' }} />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
export default DecisionNode;
