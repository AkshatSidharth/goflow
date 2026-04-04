import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

/** Cylinder shape — represents a database or storage step */
const DatabaseNode = memo(({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);
  const inputRef = useRef(null);

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
  const W = 140, H = 80, rx = 70, ry = 12;

  return (
    <div
      className={`flowmind-node relative select-none ${ringClass}`}
      style={{ width: W, height: H, cursor: isEditing ? 'text' : 'default' }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Cylinder SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} overflow="visible">
        {/* Body */}
        <rect
          x="1" y={ry} width={W - 2} height={H - ry * 2}
          fill="rgba(109,40,217,0.25)"
          stroke="rgba(139,92,246,0.7)"
          strokeWidth="1.5"
        />
        {/* Bottom ellipse */}
        <ellipse
          cx={W / 2} cy={H - ry}
          rx={rx - 1} ry={ry - 1}
          fill="rgba(109,40,217,0.35)"
          stroke="rgba(139,92,246,0.7)"
          strokeWidth="1.5"
        />
        {/* Top ellipse */}
        <ellipse
          cx={W / 2} cy={ry}
          rx={rx - 1} ry={ry - 1}
          fill="rgba(109,40,217,0.5)"
          stroke="rgba(139,92,246,0.7)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Handles */}
      <Handle type="target" position={Position.Top}
        style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Left}
        style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '50%', transform: 'translateY(-50%)' }} />

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

      <Handle type="source" position={Position.Bottom}
        style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Right}
        style={{ background: '#a78bfa', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '50%', transform: 'translateY(-50%)' }} />
    </div>
  );
});

DatabaseNode.displayName = 'DatabaseNode';
export default DatabaseNode;
