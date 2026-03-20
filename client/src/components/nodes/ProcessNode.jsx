import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

/**
 * ProcessNode - Renders a rounded rectangle for process/action steps.
 * Slate-blue color scheme to indicate an active action.
 */
const ProcessNode = memo(({ data, selected }) => {
  const ringClass = selected
    ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900'
    : '';

  return (
    <div
      className={`
        flowmind-node
        relative flex items-center justify-center
        min-w-[160px] max-w-[220px] min-h-[52px] px-4 py-3
        rounded-lg
        bg-slate-700
        border border-slate-500
        shadow-lg shadow-slate-900/50
        ${ringClass}
        cursor-default
        select-none
        transition-all duration-200
        hover:bg-slate-600 hover:border-slate-400
      `}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#94a3b8',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          top: -4,
        }}
      />

      {/* Left handle for horizontal layouts */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        style={{
          background: '#94a3b8',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          left: -4,
          opacity: 0,
        }}
      />

      {/* Node label */}
      <div className="flex items-start gap-2">
        <span className="text-slate-400 text-xs mt-0.5 flex-shrink-0" aria-hidden="true">
          ⬡
        </span>
        <span className="text-slate-100 font-medium text-sm leading-snug text-center break-words hyphens-auto">
          {data.label}
        </span>
      </div>

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#94a3b8',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          bottom: -4,
        }}
      />

      {/* Right handle for horizontal layouts */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        style={{
          background: '#94a3b8',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          right: -4,
          opacity: 0,
        }}
      />
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';

export default ProcessNode;
