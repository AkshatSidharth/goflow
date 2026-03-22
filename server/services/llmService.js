import OpenAI from 'openai';
import { SYSTEM_PROMPT, EDIT_SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { validateFlowchart, sanitizeFlowchart } from './validator.js';

let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ---------------------------------------------------------------------------
// Demo mode — returns pre-built flowcharts when no API key is configured
// ---------------------------------------------------------------------------

const DEMO_FLOWCHARTS = {
  login: {
    plan: 'A login flow with 10 nodes and retry logic. Credentials are checked up to 3 times across 3 decision nodes — success leads to the dashboard, while 3 consecutive failures deny access.',
    flowchart: {
      nodes: [
        { id: 'n1', type: 'start', text: 'Start' },
        { id: 'n2', type: 'process', text: 'Enter Credentials' },
        { id: 'n3', type: 'decision', text: 'Login Successful?' },
        { id: 'n4', type: 'process', text: 'Retry (attempt 1)' },
        { id: 'n5', type: 'decision', text: 'Login Successful?' },
        { id: 'n6', type: 'process', text: 'Retry (attempt 2)' },
        { id: 'n7', type: 'decision', text: 'Login Successful?' },
        { id: 'n8', type: 'process', text: 'Go to Dashboard' },
        { id: 'n9', type: 'end', text: 'End — Access Granted' },
        { id: 'n10', type: 'end', text: 'End — Access Denied' },
      ],
      edges: [
        { from: 'n1', to: 'n2', label: '' },
        { from: 'n2', to: 'n3', label: '' },
        { from: 'n3', to: 'n4', label: 'No' },
        { from: 'n3', to: 'n8', label: 'Yes' },
        { from: 'n4', to: 'n5', label: '' },
        { from: 'n5', to: 'n6', label: 'No' },
        { from: 'n5', to: 'n8', label: 'Yes' },
        { from: 'n6', to: 'n7', label: '' },
        { from: 'n7', to: 'n10', label: 'No' },
        { from: 'n7', to: 'n8', label: 'Yes' },
        { from: 'n8', to: 'n9', label: '' },
      ],
    },
  },
  payment: {
    plan: 'A payment flow with 8 nodes. The payment is attempted, and if it fails a retry is offered. Success routes to a confirmation message; a second failure ends with a payment failed state.',
    flowchart: {
      nodes: [
        { id: 'n1', type: 'start', text: 'Start' },
        { id: 'n2', type: 'process', text: 'Initiate Payment' },
        { id: 'n3', type: 'decision', text: 'Payment Successful?' },
        { id: 'n4', type: 'process', text: 'Retry Payment' },
        { id: 'n5', type: 'decision', text: 'Retry Successful?' },
        { id: 'n6', type: 'process', text: 'Show Success Message' },
        { id: 'n7', type: 'end', text: 'End — Payment Complete' },
        { id: 'n8', type: 'end', text: 'End — Payment Failed' },
      ],
      edges: [
        { from: 'n1', to: 'n2', label: '' },
        { from: 'n2', to: 'n3', label: '' },
        { from: 'n3', to: 'n4', label: 'No / Failure' },
        { from: 'n3', to: 'n6', label: 'Yes / Success' },
        { from: 'n4', to: 'n5', label: '' },
        { from: 'n5', to: 'n8', label: 'No' },
        { from: 'n5', to: 'n6', label: 'Yes' },
        { from: 'n6', to: 'n7', label: '' },
      ],
    },
  },
  default: {
    plan: 'A simple 6-node workflow. A request is processed and checked against a condition — the Yes path and No path each lead to their own handling step before both converge at the end.',
    flowchart: {
      nodes: [
        { id: 'n1', type: 'start', text: 'Start' },
        { id: 'n2', type: 'process', text: 'Process Request' },
        { id: 'n3', type: 'decision', text: 'Condition Met?' },
        { id: 'n4', type: 'process', text: 'Handle Yes Path' },
        { id: 'n5', type: 'process', text: 'Handle No Path' },
        { id: 'n6', type: 'end', text: 'End' },
      ],
      edges: [
        { from: 'n1', to: 'n2', label: '' },
        { from: 'n2', to: 'n3', label: '' },
        { from: 'n3', to: 'n4', label: 'Yes' },
        { from: 'n3', to: 'n5', label: 'No' },
        { from: 'n4', to: 'n6', label: '' },
        { from: 'n5', to: 'n6', label: '' },
      ],
    },
  },
};

function getDemoFlowchart(input) {
  const lower = input.toLowerCase();
  if (lower.includes('login') || lower.includes('retry') || lower.includes('再試行') || lower.includes('dubara')) {
    return DEMO_FLOWCHARTS.login;
  }
  if (lower.includes('payment') || lower.includes('pay') || lower.includes('支付') || lower.includes('fail')) {
    return DEMO_FLOWCHARTS.payment;
  }
  return DEMO_FLOWCHARTS.default;
}

function getDemoEdit(instruction, currentFlowchart) {
  const lower = instruction.toLowerCase();
  const flowchart = JSON.parse(JSON.stringify(currentFlowchart)); // deep clone

  if (lower.includes('retry') || lower.includes('again')) {
    const newId = `n${Date.now()}`;
    const lastProcess = [...flowchart.nodes].reverse().find(n => n.type === 'process');
    const endNode = flowchart.nodes.find(n => n.type === 'end');
    if (lastProcess && endNode) {
      flowchart.nodes.splice(flowchart.nodes.indexOf(endNode), 0, {
        id: newId, type: 'process', text: 'Retry Step'
      });
      flowchart.edges.push({ from: lastProcess.id, to: newId, label: '' });
      flowchart.edges.push({ from: newId, to: endNode.id, label: '' });
    }
  } else if (lower.includes('success') || lower.includes('failure') || lower.includes('change')) {
    const target = flowchart.nodes.find(n => n.text.toLowerCase().includes('success'));
    if (target) target.text = target.text.replace(/success/i, 'Failure');
  }

  return {
    plan: `Updated the flowchart based on your instruction. The flow now has ${flowchart.nodes.length} nodes and ${flowchart.edges.length} connections.`,
    flowchart,
  };
}

/**
 * Extracts JSON from LLM response, handling cases where the model
 * wraps JSON in markdown code blocks.
 * @param {string} text - Raw LLM response text
 * @returns {Object} - Parsed JSON object
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid response from LLM');
  }

  let cleaned = text.trim();

  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  cleaned = cleaned.trim();

  // Find the first { and last } to extract JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in LLM response');
  }

  const jsonString = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonString);
  } catch (parseError) {
    throw new Error(`Failed to parse JSON from LLM response: ${parseError.message}`);
  }
}

/**
 * Generates a new flowchart from natural language input.
 * @param {string} userInput - Natural language description
 * @returns {Promise<Object>} - Validated flowchart JSON
 */
export async function generateFlowchart(userInput) {
  if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
    throw new Error('User input cannot be empty');
  }

  const client = getClient();

  // Demo mode — no API key set
  if (!client) {
    console.log('[generate] Demo mode: returning pre-built flowchart');
    await new Promise(r => setTimeout(r, 800)); // simulate latency
    return getDemoFlowchart(userInput);
  }

  let lastError = null;

  // Retry up to 2 times on validation failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const message = await client.chat.completions.create({
        model: 'gpt-5.1',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput.trim() },
        ],
      });

      const responseText = message.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('LLM returned empty content');
      }

      const rawData = extractJSON(responseText);

      // Support both new { plan, flowchart } format and legacy { nodes, edges }
      const flowchartData = rawData.flowchart || rawData;
      const plan = rawData.plan || '';

      const sanitized = sanitizeFlowchart(flowchartData);
      const validation = validateFlowchart(sanitized);

      if (!validation.valid) {
        lastError = new Error(
          `Flowchart validation failed: ${validation.errors.join('; ')}`
        );
        console.warn(`Attempt ${attempt} validation errors:`, validation.errors);

        if (attempt < 2) {
          continue;
        }
        throw lastError;
      }

      return { plan, flowchart: validation.data };
    } catch (error) {
      lastError = error;
      if (attempt < 2 && error.message.includes('validation failed')) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

/**
 * Edits an existing flowchart based on user instruction.
 * @param {string} instruction - User's edit instruction
 * @param {Object} currentFlowchart - Existing flowchart JSON
 * @returns {Promise<Object>} - Updated and validated flowchart JSON
 */
export async function editFlowchart(instruction, currentFlowchart) {
  if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
    throw new Error('Edit instruction cannot be empty');
  }

  if (!currentFlowchart || typeof currentFlowchart !== 'object') {
    throw new Error('Current flowchart data is required for editing');
  }

  const client = getClient();

  // Demo mode — no API key set
  if (!client) {
    console.log('[edit] Demo mode: returning modified flowchart');
    await new Promise(r => setTimeout(r, 600));
    return getDemoEdit(instruction, currentFlowchart);
  }

  const userMessage = `Current flowchart JSON:
${JSON.stringify(currentFlowchart, null, 2)}

User instruction: ${instruction.trim()}

Apply the requested changes and return the complete updated flowchart JSON.`;

  const message = await client.chat.completions.create({
    model: 'gpt-5.1',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: EDIT_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });

  const responseText = message.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('LLM returned empty content');
  }

  const rawData = extractJSON(responseText);

  // Support both new { plan, flowchart } format and legacy { nodes, edges }
  const flowchartData = rawData.flowchart || rawData;
  const plan = rawData.plan || '';

  const sanitized = sanitizeFlowchart(flowchartData);
  const validation = validateFlowchart(sanitized);

  if (!validation.valid) {
    throw new Error(`Edited flowchart validation failed: ${validation.errors.join('; ')}`);
  }

  return { plan, flowchart: validation.data };
}
