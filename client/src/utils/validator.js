/**
 * Client-side lightweight flowchart JSON validator.
 * The server does the heavy Zod validation; this is a quick sanity check
 * before making API calls.
 */

/**
 * Validates a flowchart JSON object on the client side.
 * @param {any} data - Data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFlowchart(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Flowchart data must be an object'] };
  }

  if (!Array.isArray(data.nodes)) {
    errors.push('Flowchart must have a "nodes" array');
  }

  if (!Array.isArray(data.edges)) {
    errors.push('Flowchart must have an "edges" array');
  }

  if (errors.length > 0) return { valid: false, errors };

  if (data.nodes.length < 2) {
    errors.push('Flowchart must have at least 2 nodes');
  }

  const nodeIds = new Set();
  data.nodes.forEach((node, idx) => {
    if (!node.id) errors.push(`Node at index ${idx} is missing "id"`);
    if (!node.type) errors.push(`Node at index ${idx} is missing "type"`);
    if (!node.text && !node.label) errors.push(`Node at index ${idx} is missing "text"`);

    if (node.id && nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: "${node.id}"`);
    }
    if (node.id) nodeIds.add(node.id);
  });

  const hasStart = data.nodes.some((n) => n.type === 'start');
  const hasEnd = data.nodes.some((n) => n.type === 'end');

  if (!hasStart) errors.push('Flowchart must have a "start" node');
  if (!hasEnd) errors.push('Flowchart must have an "end" node');

  data.edges.forEach((edge, idx) => {
    if (!edge.from && !edge.source) errors.push(`Edge at index ${idx} is missing "from"`);
    if (!edge.to && !edge.target) errors.push(`Edge at index ${idx} is missing "to"`);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detects the likely language of a text string.
 * @param {string} text
 * @returns {'EN' | 'HI' | 'JA' | 'ZH' | 'MULTI'}
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'EN';

  const hindiRegex = /[\u0900-\u097F]/;
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
  const chineseRegex = /[\u4E00-\u9FFF]/;
  const japaneseKanaRegex = /[\u3040-\u309F\u30A0-\u30FF]/;

  if (hindiRegex.test(text)) return 'HI';
  if (japaneseKanaRegex.test(text)) return 'JA';
  if (chineseRegex.test(text) && !japaneseKanaRegex.test(text)) return 'ZH';
  if (japaneseRegex.test(text)) return 'JA';

  return 'EN';
}

/**
 * Gets a human-readable label for a language code.
 */
export function getLanguageLabel(code) {
  const labels = {
    EN: 'English',
    HI: 'हिंदी',
    JA: '日本語',
    ZH: '中文',
    MULTI: 'Multilingual',
  };
  return labels[code] || code;
}
