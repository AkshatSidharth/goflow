import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

const ProcessNode = memo(({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);
  const inputRef = useRef(null);

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

  return (
    <div
      className={`
        flowmind-node
        relative flex items-center justify-center
        min-w-[120px] max-w-[180px] min-h-[40px] px-3 py-2
        rounded-xl
        bg-slate-800/90 backdrop-blur-sm
        border border-slate-600/60
        shadow-lg shadow-slate-900/60
        ${ringClass}
        select-none transition-all duration-200
        hover:border-slate-500 hover:shadow-slate-800/40
      `}
      style={{ cursor: isEditing ? 'text' : 'default' }}
      onDoubleClick={handleDoubleClick}
    >
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
