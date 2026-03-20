import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

/**
 * DecisionNode - Renders a diamond shape for conditional branches.
 * Uses a rotated square technique for the diamond shape.
 * Amber/orange color scheme to visually distinguish from process nodes.
 */
const DecisionNode = memo(({ data, selected }) => {
  const ringClass = selected
    ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-gray-900'
    : '';

  // The outer container is sized to fit the rotated diamond
  // Diamond visual width: sqrt(2) * inner_size ≈ 160px => inner ≈ 113px
  const containerSize = 160;
  const innerSize = 110;

  return (
    <div
      className={`flowmind-node relative cursor-default select-none ${ringClass}`}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Diamond shape: rotated square */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: 'rotate(45deg)',
          transformOrigin: 'center',
        }}
      >
        <div
          className="bg-amber-800 border-2 border-amber-500 shadow-lg shadow-amber-900/50 transition-all duration-200 hover:bg-amber-700 hover:border-amber-400"
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: 6,
          }}
        />
      </div>

      {/* Text label (not rotated, centered over diamond) */}
      <div
        className="absolute inset-0 flex items-center justify-center px-3"
        style={{ pointerEvents: 'none' }}
      >
        <span className="text-amber-100 font-semibold text-xs leading-snug text-center break-words hyphens-auto max-w-[120px]">
          {data.label}
        </span>
      </div>

      {/* ── Handles on 4 cardinal points ── */}

      {/* Top — usually incoming from above */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#fbbf24',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          top: -4,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      {/* Bottom — "Yes" or primary branch */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{
          background: '#fbbf24',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          bottom: -4,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      {/* Right — "No" or secondary branch */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: '#fbbf24',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          right: -4,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />

      {/* Left — tertiary branch or loop-back target */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{
          background: '#fbbf24',
          width: 8,
          height: 8,
          border: '2px solid #1e293b',
          left: -4,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';

export default DecisionNode;
