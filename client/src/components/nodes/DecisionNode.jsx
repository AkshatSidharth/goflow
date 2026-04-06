import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

const DecisionNode = memo(({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);
  const inputRef = useRef(null);

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
      style={{ width: containerSize, height: containerSize, cursor: isEditing ? 'text' : 'default' }}
      onDoubleClick={handleDoubleClick}
    >
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

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', top: -4, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', bottom: -4, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', right: -4, top: '50%', transform: 'translateY(-50%)' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ background: '#fbbf24', width: 8, height: 8, border: '2px solid #0f172a', left: -4, top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
export default DecisionNode;
