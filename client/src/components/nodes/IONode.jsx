import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

/** Parallelogram shape — represents Input/Output data operations */
const IONode = memo(({ id, data, selected }) => {
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

  const ringClass = selected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-gray-900' : '';

  return (
    <div
      className={`flowmind-node relative select-none ${ringClass}`}
      style={{ width: 180, height: 52, cursor: isEditing ? 'text' : 'default' }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Parallelogram via SVG background */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 180 52"
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <polygon
          points="18,2 178,2 162,50 2,50"
          fill="rgba(8,145,178,0.25)"
          stroke="rgba(6,182,212,0.7)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Handles */}
      <Handle type="target" position={Position.Top}
        style={{ background: '#22d3ee', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Left}
        style={{ background: '#22d3ee', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '50%', transform: 'translateY(-50%)' }} />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="bg-cyan-900/80 text-cyan-100 text-xs font-semibold text-center rounded px-2 py-1 outline-none border border-cyan-400 nodrag w-full"
            style={{ maxWidth: 130 }}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 text-xs flex-shrink-0">⇌</span>
            <span className="text-cyan-100 font-medium text-xs leading-snug text-center break-words hyphens-auto">
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
        style={{ background: '#22d3ee', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Right}
        style={{ background: '#22d3ee', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '50%', transform: 'translateY(-50%)' }} />
    </div>
  );
});

IONode.displayName = 'IONode';
export default IONode;
