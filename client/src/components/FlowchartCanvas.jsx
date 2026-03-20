import React, { useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';
import { toPng } from 'html-to-image';
import StartEndNode from './nodes/StartEndNode.jsx';
import ProcessNode from './nodes/ProcessNode.jsx';
import DecisionNode from './nodes/DecisionNode.jsx';

// Register custom node types — defined outside component to prevent re-renders
const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
};

/**
 * Mini-map node color helper
 */
function getMiniMapNodeColor(node) {
  const type = node.data?.nodeType || node.type;
  switch (type) {
    case 'start': return '#6366f1';
    case 'end':   return '#10b981';
    case 'decision': return '#f59e0b';
    default:     return '#475569'; // process
  }
}

/**
 * Toolbar displayed above the React Flow canvas.
 */
function CanvasToolbar({ nodeCount, edgeCount, onExport, isExporting, detectedLanguage }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
      {/* Left: Stats */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs">
          <span className="text-gray-400">
            <span className="text-white font-medium">{nodeCount}</span> nodes
          </span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">
            <span className="text-white font-medium">{edgeCount}</span> edges
          </span>
          {detectedLanguage && detectedLanguage !== 'EN' && (
            <>
              <span className="text-gray-600">•</span>
              <span className="bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded text-xs font-medium border border-indigo-700/50">
                {detectedLanguage}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Export button */}
      <div className="pointer-events-auto">
        <button
          onClick={onExport}
          disabled={isExporting || nodeCount === 0}
          data-tooltip="Export as PNG"
          className="
            flex items-center gap-2 px-3 py-1.5
            bg-indigo-600 hover:bg-indigo-500
            disabled:opacity-40 disabled:cursor-not-allowed
            text-white text-xs font-medium
            rounded-lg border border-indigo-500
            shadow-lg shadow-indigo-900/40
            transition-all duration-150
          "
        >
          {isExporting ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PNG
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Empty state shown when no flowchart has been generated yet.
 */
function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <div className="text-center space-y-4 max-w-sm px-6">
        {/* Animated icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-indigo-900/30 border border-indigo-700/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-400 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-gray-300 font-semibold text-base mb-1">
            Your flowchart will appear here
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Describe a process or workflow in the chat panel. Supports English, Hindi, Japanese, and Chinese.
          </p>
        </div>

        {/* Feature hints */}
        <div className="grid grid-cols-2 gap-2 text-left">
          {[
            { icon: '◇', label: 'Decision nodes', color: 'text-amber-400' },
            { icon: '○', label: 'Start / End ovals', color: 'text-indigo-400' },
            { icon: '□', label: 'Process steps', color: 'text-slate-300' },
            { icon: '↺', label: 'Loop detection', color: 'text-orange-400' },
          ].map(({ icon, label, color }) => (
            <div key={label} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
              <span className={`${color} font-bold text-base`}>{icon}</span>
              <span className="text-gray-400 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Main canvas component wrapping React Flow.
 */
export default function FlowchartCanvas({ nodes, edges, onNodesChange, onEdgesChange, detectedLanguage }) {
  const reactFlowWrapper = useRef(null);
  const { fitView } = useReactFlow();
  const [isExporting, setIsExporting] = React.useState(false);

  const hasContent = nodes && nodes.length > 0;

  // Fit view whenever nodes change
  React.useEffect(() => {
    if (hasContent) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.15, duration: 400 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, fitView, hasContent]);

  /**
   * Export the flowchart canvas as a PNG image.
   */
  const handleExport = useCallback(async () => {
    if (!reactFlowWrapper.current || isExporting) return;

    setIsExporting(true);
    try {
      // Find the React Flow viewport element
      const rfViewport = reactFlowWrapper.current.querySelector('.react-flow__renderer');
      const targetEl = rfViewport || reactFlowWrapper.current;

      const dataUrl = await toPng(targetEl, {
        backgroundColor: '#0f172a',
        pixelRatio: 2,
        filter: (node) => {
          // Exclude controls and minimap from export
          if (node.classList) {
            return (
              !node.classList.contains('react-flow__controls') &&
              !node.classList.contains('react-flow__minimap') &&
              !node.classList.contains('canvas-toolbar')
            );
          }
          return true;
        },
      });

      const link = document.createElement('a');
      link.download = `flowmind-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[Export] Failed to export PNG:', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    style: { stroke: '#64748b', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#64748b' },
  }), []);

  return (
    <div ref={reactFlowWrapper} className="relative w-full h-full">
      {/* Toolbar overlay */}
      {hasContent && (
        <div className="canvas-toolbar">
          <CanvasToolbar
            nodeCount={nodes.length}
            edgeCount={edges.length}
            onExport={handleExport}
            isExporting={isExporting}
            detectedLanguage={detectedLanguage}
          />
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2.5}
        deleteKeyCode={null} // Prevent accidental deletion
        className="bg-slate-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1e293b"
        />

        <Controls
          position="bottom-right"
          showInteractive={false}
          className="border border-slate-700"
        />

        <MiniMap
          position="bottom-left"
          nodeColor={getMiniMapNodeColor}
          maskColor="rgba(15, 23, 42, 0.75)"
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
          }}
        />
      </ReactFlow>

      {/* Empty state */}
      {!hasContent && <EmptyState />}
    </div>
  );
}
