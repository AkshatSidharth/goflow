import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

/**
 * StartEndNode - Renders an oval (pill) shaped node for start/end states.
 * - Start nodes: blue/indigo gradient with top connection only
 * - End nodes: emerald/green gradient with bottom connection only
 */
const StartEndNode = memo(({ data, selected }) => {
  const isStart = data.nodeType === 'start';

  const gradientClass = isStart
    ? 'from-indigo-600 to-blue-600'
    : 'from-emerald-600 to-teal-600';

  const borderClass = isStart
    ? 'border-indigo-400'
    : 'border-emerald-400';

  const shadowClass = isStart
    ? 'shadow-indigo-900/50'
    : 'shadow-emerald-900/50';

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
        cursor-default
        select-none
        transition-all duration-200
      `}
    >
      {/* Top handle (target) — End nodes can receive connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: isStart ? '#818cf8' : '#34d399',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          top: -4,
        }}
      />

      {/* Node icon */}
      <span className="mr-1.5 text-sm" aria-hidden="true">
        {isStart ? '▶' : '■'}
      </span>

      {/* Node label */}
      <span className="text-white font-semibold text-sm leading-tight truncate">
        {data.label}
      </span>

      {/* Bottom handle (source) — Start nodes can emit connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: isStart ? '#818cf8' : '#34d399',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          bottom: -4,
        }}
      />
    </div>
  );
});

StartEndNode.displayName = 'StartEndNode';

export default StartEndNode;
