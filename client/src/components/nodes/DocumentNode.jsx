import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

/** Document shape — rectangle with a wavy/curled bottom edge */
const DocumentNode = memo(({ id, data, selected }) => {
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

  const ringClass = selected ? 'ring-2 ring-teal-400 ring-offset-1 ring-offset-gray-900' : '';
  const W = 180, H = 72;
  // Wave path: flat sides + top, wavy bottom
  const wavePath = `M 1,1 H ${W - 1} V ${H - 14} Q ${W * 0.875},${H + 2} ${W * 0.75},${H - 14} Q ${W * 0.625},${H - 28} ${W * 0.5},${H - 14} Q ${W * 0.375},${H} ${W * 0.25},${H - 14} Q ${W * 0.125},${H - 28} 1,${H - 14} Z`;

  return (
    <div
      className={`flowmind-node relative select-none ${ringClass}`}
      style={{ width: W, height: H, cursor: isEditing ? 'text' : 'default' }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Document SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} overflow="visible">
        <path
          d={wavePath}
          fill="rgba(13,148,136,0.25)"
          stroke="rgba(20,184,166,0.7)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Handles */}
      <Handle type="target" position={Position.Top}
        style={{ background: '#2dd4bf', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Left}
        style={{ background: '#2dd4bf', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '40%', transform: 'translateY(-50%)' }} />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center px-4" style={{ paddingBottom: 10 }}>
        {isEditing ? (
          <input
            ref={inputRef}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="bg-teal-900/80 text-teal-100 text-xs font-semibold text-center rounded px-2 py-0.5 outline-none border border-teal-400 nodrag w-full"
            style={{ maxWidth: 140 }}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-teal-400 text-xs flex-shrink-0">📄</span>
            <span className="text-teal-100 font-medium text-xs leading-snug text-center break-words hyphens-auto">
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
        style={{ background: '#2dd4bf', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Right}
        style={{ background: '#2dd4bf', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '40%', transform: 'translateY(-50%)' }} />
    </div>
  );
});

DocumentNode.displayName = 'DocumentNode';
export default DocumentNode;
