import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

/** Hexagon shape — represents a preparation or manual operation step */
const HexagonNode = memo(({ id, data, selected }) => {
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

  const ringClass = selected ? 'ring-2 ring-orange-400 ring-offset-1 ring-offset-gray-900' : '';
  const W = 160, H = 64;
  // Flat-top hexagon points
  const pts = [
    `${W * 0.22},2`,
    `${W * 0.78},2`,
    `${W - 2},${H / 2}`,
    `${W * 0.78},${H - 2}`,
    `${W * 0.22},${H - 2}`,
    `2,${H / 2}`,
  ].join(' ');

  return (
    <div
      className={`flowmind-node relative select-none ${ringClass}`}
      style={{ width: W, height: H, cursor: isEditing ? 'text' : 'default' }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Hexagon SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} overflow="visible">
        <polygon
          points={pts}
          fill="rgba(194,65,12,0.25)"
          stroke="rgba(249,115,22,0.7)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Handles */}
      <Handle type="target" position={Position.Top}
        style={{ background: '#fb923c', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Left}
        style={{ background: '#fb923c', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '50%', transform: 'translateY(-50%)' }} />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center px-8">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="bg-orange-900/80 text-orange-100 text-xs font-semibold text-center rounded px-2 py-0.5 outline-none border border-orange-400 nodrag w-full"
            style={{ maxWidth: 110 }}
          />
        ) : (
          <span className="text-orange-100 font-medium text-xs leading-snug text-center break-words hyphens-auto">
            {data.label}
          </span>
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
        style={{ background: '#fb923c', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Right}
        style={{ background: '#fb923c', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '50%', transform: 'translateY(-50%)' }} />
    </div>
  );
});

HexagonNode.displayName = 'HexagonNode';
export default HexagonNode;
