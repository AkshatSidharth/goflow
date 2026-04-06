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

/** Cylinder shape — represents a database or storage step */
const DatabaseNode = memo(({ id, data, selected, style: rfStyle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);
  const inputRef = useRef(null);

  const rotation = data.rotation || 0;

  useEffect(() => {
    if (isEditing) { inputRef.current?.focus(); inputRef.current?.select(); }
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
    if (trimmed && trimmed !== data.label) data.onLabelChange?.(id, trimmed);
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

  const ringClass = selected ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-gray-900' : '';
  const nodeW = rfStyle?.width  ?? 110;
  const nodeH = rfStyle?.height ?? 62;
  const rx = (nodeW / 2) - 1;
  const ry = Math.max(6, nodeH * 0.16);

  return (
    <div
      className={`flowmind-node relative select-none ${ringClass}`}
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

      {/* Cylinder SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${nodeW} ${nodeH}`} overflow="visible">
        {/* Body */}
        <rect
          x="1" y={ry} width={nodeW - 2} height={nodeH - ry * 2}
          fill="rgba(109,40,217,0.25)"
          stroke="rgba(139,92,246,0.7)"
          strokeWidth="1.5"
        />
        {/* Bottom ellipse */}
        <ellipse
          cx={nodeW / 2} cy={nodeH - ry}
          rx={rx} ry={ry - 1}
          fill="rgba(109,40,217,0.35)"
          stroke="rgba(139,92,246,0.7)"
          strokeWidth="1.5"
        />
        {/* Top ellipse */}
        <ellipse
          cx={nodeW / 2} cy={ry}
          rx={rx} ry={ry - 1}
          fill="rgba(109,40,217,0.5)"
          stroke="rgba(139,92,246,0.7)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Bidirectional handles at all 4 positions */}
      <Handle type="target" position={Position.Top}    id="top-t"    style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Top}    id="top-s"    style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Left}   id="left-t"   style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="source" position={Position.Left}   id="left-s"   style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '50%', transform: 'translateY(-50%)' }} />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center px-3" style={{ paddingTop: ry }}>
        {isEditing ? (
          <input
            ref={inputRef}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="bg-violet-900/80 text-violet-100 text-xs font-semibold text-center rounded px-2 py-0.5 outline-none border border-violet-400 nodrag w-full"
            style={{ maxWidth: 110 }}
          />
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-violet-400 text-xs flex-shrink-0">⬡</span>
            <span className="text-violet-100 font-medium text-xs leading-snug text-center break-words hyphens-auto">
              {data.label}
            </span>
          </div>
        )}
      </div>

      {/* Delete button */}
      {selected && !isEditing && (
        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 border border-red-400/60 flex items-center justify-center text-white font-bold transition-colors z-10 shadow-sm nodrag"
          title="Delete node"
          style={{ fontSize: '13px', lineHeight: 1 }}
        >×</button>
      )}

      <Handle type="target" position={Position.Bottom} id="bottom-t" style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Right}  id="right-t"  style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="source" position={Position.Right}  id="right-s"  style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '50%', transform: 'translateY(-50%)' }} />
    </div>
  );
});

DatabaseNode.displayName = 'DatabaseNode';
export default DatabaseNode;
