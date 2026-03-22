import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

const StartEndNode = memo(({ id, data, selected }) => {
  const isStart = data.nodeType === 'start';
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

  const gradientClass = isStart ? 'from-indigo-600 to-blue-600' : 'from-emerald-600 to-teal-600';
  const borderClass = isStart ? 'border-indigo-400/60' : 'border-emerald-400/60';
  const shadowClass = isStart ? 'shadow-indigo-900/50' : 'shadow-emerald-900/50';
  const inputBorderClass = isStart ? 'border-indigo-400' : 'border-emerald-400';
  const handleColor = isStart ? '#818cf8' : '#34d399';

  const ringClass = selected
    ? isStart
      ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-gray-900'
      : 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-gray-900'
    : '';

  return (
    <div
      className={`
        flowmind-node
        relative flex items-center justify-center
        min-w-[120px] max-w-[180px] h-[44px] px-5
        rounded-full
        bg-gradient-to-r ${gradientClass}
        border ${borderClass}
        shadow-lg ${shadowClass}
        ${ringClass}
        select-none transition-all duration-200
      `}
      style={{ cursor: isEditing ? 'text' : 'default' }}
      onDoubleClick={handleDoubleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: handleColor, width: 8, height: 8, border: '2px solid #0f172a', top: -4 }}
      />

      {isEditing ? (
        <input
          ref={inputRef}
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={`bg-white/10 text-white text-sm font-semibold text-center rounded-full px-2 py-0.5 outline-none border ${inputBorderClass} nodrag`}
          style={{ minWidth: '60px', maxWidth: '150px', width: '100%' }}
        />
      ) : (
        <>
          <span className="mr-1.5 text-sm" aria-hidden="true">{isStart ? '▶' : '■'}</span>
          <span className="text-white font-semibold text-sm leading-tight truncate">{data.label}</span>
        </>
      )}

      {/* Delete button */}
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

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: handleColor, width: 8, height: 8, border: '2px solid #0f172a', bottom: -4 }}
      />
    </div>
  );
});

StartEndNode.displayName = 'StartEndNode';
export default StartEndNode;
