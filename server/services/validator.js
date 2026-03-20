import { z } from 'zod';

// Zod schema for individual node
const NodeSchema = z.object({
  id: z.string().min(1, 'Node ID cannot be empty'),
  type: z.enum(['start', 'process', 'decision', 'end'], {
    errorMap: () => ({ message: 'Node type must be one of: start, process, decision, end' }),
  }),
  text: z.string().min(1, 'Node text cannot be empty'),
});

// Zod schema for individual edge
const EdgeSchema = z.object({
  from: z.string().min(1, 'Edge "from" cannot be empty'),
  to: z.string().min(1, 'Edge "to" cannot be empty'),
  label: z.string().default(''),
});

// Base flowchart schema
const FlowchartBaseSchema = z.object({
  nodes: z.array(NodeSchema).min(2, 'Flowchart must have at least 2 nodes'),
  edges: z.array(EdgeSchema).min(1, 'Flowchart must have at least 1 edge'),
});

/**
 * Validates a flowchart JSON object with comprehensive business rules.
 * @param {Object} data - The flowchart data to validate
 * @returns {{ valid: boolean, data?: Object, errors?: string[] }}
 */
export function validateFlowchart(data) {
  const errors = [];

  // Step 1: Base schema validation
  const baseResult = FlowchartBaseSchema.safeParse(data);
  if (!baseResult.success) {
    return {
      valid: false,
      errors: baseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }

  const { nodes, edges } = baseResult.data;
  const nodeIds = new Set();
  const nodeMap = new Map();

  // Step 2: Unique node IDs
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: "${node.id}"`);
    }
    nodeIds.add(node.id);
    nodeMap.set(node.id, node);
  }

  // Step 3: Exactly one start node
  const startNodes = nodes.filter((n) => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Flowchart must have exactly one "start" node');
  } else if (startNodes.length > 1) {
    errors.push(`Flowchart has ${startNodes.length} "start" nodes — only one is allowed`);
  }

  // Step 4: At least one end node
  const endNodes = nodes.filter((n) => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('Flowchart must have at least one "end" node');
  }

  // Step 5: All edge references must point to existing nodes
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references non-existent source node: "${edge.from}"`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references non-existent target node: "${edge.to}"`);
    }
  }

  // Step 6: Decision nodes must have ≥2 labeled outgoing edges
  const outgoingEdges = new Map();
  for (const edge of edges) {
    if (!outgoingEdges.has(edge.from)) {
      outgoingEdges.set(edge.from, []);
    }
    outgoingEdges.get(edge.from).push(edge);
  }

  for (const node of nodes) {
    if (node.type === 'decision') {
      const outgoing = outgoingEdges.get(node.id) || [];
      if (outgoing.length < 2) {
        errors.push(
          `Decision node "${node.id}" (${node.text}) must have at least 2 outgoing edges, found ${outgoing.length}`
        );
      }
      const unlabeled = outgoing.filter((e) => !e.label || e.label.trim() === '');
      if (unlabeled.length > 0) {
        errors.push(
          `Decision node "${node.id}" has ${unlabeled.length} unlabeled outgoing edge(s) — all must be labeled`
        );
      }
    }
  }

  // Step 7: Check all nodes are connected (reachable from start or reaching end)
  if (startNodes.length === 1 && errors.length === 0) {
    const startId = startNodes[0].id;
    const reachable = new Set();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (reachable.has(current)) continue;
      reachable.add(current);
      const children = (outgoingEdges.get(current) || []).map((e) => e.to);
      queue.push(...children);
    }

    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        errors.push(
          `Node "${node.id}" (${node.text}) is disconnected — not reachable from start node`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: baseResult.data };
}

/**
 * Sanitizes flowchart data by fixing minor issues where possible.
 * @param {Object} data - Raw flowchart data
 * @returns {Object} - Sanitized data
 */
export function sanitizeFlowchart(data) {
  if (!data || typeof data !== 'object') return data;

  const sanitized = {
    nodes: Array.isArray(data.nodes)
      ? data.nodes.map((node) => ({
          id: String(node.id || ''),
          type: node.type || 'process',
          text: String(node.text || node.label || ''),
        }))
      : [],
    edges: Array.isArray(data.edges)
      ? data.edges.map((edge) => ({
          from: String(edge.from || edge.source || ''),
          to: String(edge.to || edge.target || ''),
          label: String(edge.label || ''),
        }))
      : [],
  };

  return sanitized;
}
