import dagre from 'dagre';

/**
 * Node dimensions by type.
 * These match the visual sizes of our custom nodes.
 */
const NODE_DIMENSIONS = {
  start:    { width: 160, height: 56 },
  end:      { width: 160, height: 56 },
  process:  { width: 200, height: 64 },
  decision: { width: 160, height: 80 },
  io:       { width: 180, height: 52 },
  database: { width: 140, height: 80 },
  document: { width: 180, height: 72 },
  hexagon:  { width: 160, height: 64 },
};

const DEFAULT_DIMENSIONS = { width: 200, height: 64 };

/**
 * Applies dagre auto-layout to React Flow nodes and edges.
 *
 * @param {Array} nodes - React Flow nodes (must have id, type)
 * @param {Array} edges - React Flow edges (must have source, target)
 * @param {'TB' | 'LR'} direction - Layout direction (top-bottom or left-right)
 * @returns {{ nodes: Array, edges: Array }} - Nodes with updated positions
 */
export function getLayoutedElements(nodes, edges, direction = 'TB') {
  if (!nodes || nodes.length === 0) return { nodes, edges };

  const dagreGraph = new dagre.graphlib.Graph({ multigraph: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,   // horizontal spacing between nodes
    ranksep: 100,  // vertical spacing between ranks
    marginx: 40,
    marginy: 40,
    acyclicer: 'greedy', // handles backward edges (loops) gracefully
    ranker: 'network-simplex',
  });

  // Add nodes to dagre
  nodes.forEach((node) => {
    const nodeType = node.data?.nodeType || node.type || 'process';
    const dims = NODE_DIMENSIONS[nodeType] || DEFAULT_DIMENSIONS;
    dagreGraph.setNode(node.id, { width: dims.width, height: dims.height });
  });

  // Add edges to dagre (use unique keys for multigraph)
  edges.forEach((edge, idx) => {
    dagreGraph.setEdge(edge.source, edge.target, {}, `e${idx}`);
  });

  dagre.layout(dagreGraph);

  // Map positions back to React Flow nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeType = node.data?.nodeType || node.type || 'process';
    const dims = NODE_DIMENSIONS[nodeType] || DEFAULT_DIMENSIONS;

    if (!nodeWithPosition) {
      console.warn(`[Layout] No position found for node ${node.id}`);
      return node;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - dims.width / 2,
        y: nodeWithPosition.y - dims.height / 2,
      },
      // Prevent React Flow from moving nodes after layout
      draggable: true,
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Detects backward (loop) edges by checking if target appears before source
 * in topological ordering from the start node.
 *
 * @param {Array} nodes - Raw nodes from API (id, type, text)
 * @param {Array} edges - Raw edges from API (from, to, label)
 * @returns {Set<string>} - Set of edge keys ("from->to") that are backward edges
 */
export function detectBackwardEdges(nodes, edges) {
  const backwardEdges = new Set();

  if (!nodes || !edges || nodes.length === 0) return backwardEdges;

  // Build adjacency list (forward only, skip if we already know)
  const nodeIndex = new Map();
  nodes.forEach((node, idx) => nodeIndex.set(node.id, idx));

  // Simple heuristic: if target index < source index in the nodes array,
  // it's likely a backward edge (loop)
  edges.forEach((edge) => {
    const srcIdx = nodeIndex.get(edge.from) ?? Infinity;
    const tgtIdx = nodeIndex.get(edge.to) ?? Infinity;
    if (tgtIdx < srcIdx) {
      backwardEdges.add(`${edge.from}->${edge.to}`);
    }
  });

  return backwardEdges;
}

/**
 * Converts API flowchart JSON to React Flow nodes and edges format,
 * then applies dagre layout.
 *
 * @param {{ nodes: Array, edges: Array }} flowchartData - API response data
 * @returns {{ nodes: Array, edges: Array }} - React Flow compatible data with layout
 */
export function convertAndLayout(flowchartData) {
  if (!flowchartData || !flowchartData.nodes || !flowchartData.edges) {
    return { nodes: [], edges: [] };
  }

  const { nodes: rawNodes, edges: rawEdges } = flowchartData;

  // Detect backward/loop edges before conversion
  const backwardEdgeKeys = detectBackwardEdges(rawNodes, rawEdges);

  // Convert nodes to React Flow format
  const rfNodes = rawNodes.map((node) => ({
    id: node.id,
    // Use our custom node types
    type: getReactFlowNodeType(node.type),
    data: {
      label: node.text,
      nodeType: node.type, // 'start' | 'process' | 'decision' | 'end'
    },
    position: { x: 0, y: 0 }, // Will be set by dagre
    draggable: true,
  }));

  // Convert edges to React Flow format
  const rfEdges = rawEdges.map((edge, idx) => {
    const isBackward = backwardEdgeKeys.has(`${edge.from}->${edge.to}`);
    const edgeKey = `e-${edge.from}-${edge.to}-${idx}`;

    return {
      id: edgeKey,
      source: edge.from,
      target: edge.to,
      label: edge.label || '',
      animated: isBackward,
      type: isBackward ? 'smoothstep' : 'smoothstep',
      style: {
        stroke: isBackward ? '#f59e0b' : '#64748b',
        strokeWidth: isBackward ? 2.5 : 2,
      },
      labelStyle: {
        fill: '#e2e8f0',
        fontWeight: 600,
        fontSize: 11,
      },
      labelBgStyle: {
        fill: '#1e293b',
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: 'arrowclosed',
        color: isBackward ? '#f59e0b' : '#64748b',
      },
    };
  });

  // Apply dagre layout
  return getLayoutedElements(rfNodes, rfEdges);
}

/**
 * Maps API node types to React Flow custom node type names.
 */
function getReactFlowNodeType(apiType) {
  const typeMap = {
    start:    'startEnd',
    end:      'startEnd',
    process:  'process',
    decision: 'decision',
    io:       'io',
    database: 'database',
    document: 'document',
    hexagon:  'hexagon',
  };
  return typeMap[apiType] || 'process';
}
