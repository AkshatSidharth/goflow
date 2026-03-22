import { Router } from 'express';
import { generateFlowchart, editFlowchart, chat } from '../services/llmService.js';
import { validateFlowchart, sanitizeFlowchart } from '../services/validator.js';

const router = Router();

/**
 * POST /api/generate
 * Generate a flowchart from natural language input.
 *
 * Request body: { prompt: string }
 * Response: { success: true, data: FlowchartJSON } | { success: false, error: string }
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a non-empty "prompt" string',
      });
    }

    if (prompt.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is too long. Please keep it under 5000 characters.',
      });
    }

    console.log(`[generate] Processing prompt (${prompt.length} chars): "${prompt.slice(0, 100)}..."`);

    const result = await generateFlowchart(prompt.trim());
    const { plan, flowchart: flowchartData } = result;

    console.log(
      `[generate] Success: ${flowchartData.nodes.length} nodes, ${flowchartData.edges.length} edges`
    );

    return res.json({
      success: true,
      plan,
      data: flowchartData,
      meta: {
        nodeCount: flowchartData.nodes.length,
        edgeCount: flowchartData.edges.length,
      },
    });
  } catch (error) {
    console.error('[generate] Error:', error.message);

    // Determine appropriate HTTP status
    let status = 500;
    let userMessage = 'Failed to generate flowchart. Please try again.';

    if (error.message.includes('ANTHROPIC_API_KEY')) {
      status = 503;
      userMessage = 'AI service is not configured. Please set ANTHROPIC_API_KEY.';
    } else if (error.message.includes('validation failed')) {
      status = 422;
      userMessage = `AI generated an invalid flowchart structure: ${error.message}`;
    } else if (error.status === 401) {
      status = 503;
      userMessage = 'Invalid API key. Please check your ANTHROPIC_API_KEY.';
    } else if (error.status === 429) {
      status = 429;
      userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (error.status >= 500) {
      status = 503;
      userMessage = 'AI service is temporarily unavailable. Please try again later.';
    }

    return res.status(status).json({
      success: false,
      error: userMessage,
    });
  }
});

/**
 * POST /api/edit
 * Edit an existing flowchart via natural language instruction.
 *
 * Request body: { instruction: string, currentFlowchart: FlowchartJSON }
 * Response: { success: true, data: FlowchartJSON } | { success: false, error: string }
 */
router.post('/edit', async (req, res) => {
  try {
    const { instruction, currentFlowchart } = req.body;

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a non-empty "instruction" string',
      });
    }

    if (!currentFlowchart || typeof currentFlowchart !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body must include "currentFlowchart" object',
      });
    }

    // Validate the incoming flowchart before editing
    const sanitized = sanitizeFlowchart(currentFlowchart);
    const validation = validateFlowchart(sanitized);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid flowchart provided: ${validation.errors.join('; ')}`,
      });
    }

    console.log(
      `[edit] Processing instruction: "${instruction.slice(0, 100)}" on flowchart with ${sanitized.nodes.length} nodes`
    );

    const result = await editFlowchart(instruction.trim(), sanitized);
    const { plan, flowchart: updatedFlowchart } = result;

    console.log(
      `[edit] Success: ${updatedFlowchart.nodes.length} nodes, ${updatedFlowchart.edges.length} edges`
    );

    return res.json({
      success: true,
      plan,
      data: updatedFlowchart,
      meta: {
        nodeCount: updatedFlowchart.nodes.length,
        edgeCount: updatedFlowchart.edges.length,
      },
    });
  } catch (error) {
    console.error('[edit] Error:', error.message);

    let status = 500;
    let userMessage = 'Failed to edit flowchart. Please try again.';

    if (error.message.includes('ANTHROPIC_API_KEY')) {
      status = 503;
      userMessage = 'AI service is not configured. Please set ANTHROPIC_API_KEY.';
    } else if (error.message.includes('validation failed')) {
      status = 422;
      userMessage = `AI generated an invalid flowchart structure: ${error.message}`;
    } else if (error.status === 429) {
      status = 429;
      userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    }

    return res.status(status).json({
      success: false,
      error: userMessage,
    });
  }
});

/**
 * POST /api/chat
 * Conversational chat — returns either a text response or a flowchart proposal.
 *
 * Request body: { message: string, history?: Array<{role, content}> }
 * Response: { success: true, type: "text", message: string }
 *         | { success: true, type: "flowchart", plan: string, data: FlowchartJSON }
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Request body must include a non-empty "message" string' });
    }

    const result = await chat(message.trim(), Array.isArray(history) ? history : []);

    if (result.type === 'text') {
      return res.json({ success: true, type: 'text', message: result.message });
    }

    return res.json({
      success: true,
      type: 'flowchart',
      plan: result.plan,
      data: result.data,
    });
  } catch (error) {
    console.error('[chat] Error:', error.message);
    console.error('[chat] Full error:', JSON.stringify(error?.error || error?.cause || {}, null, 2));
    const userMsg = error?.error?.message || error?.cause?.message || error.message || 'Chat failed. Please try again.';
    return res.status(500).json({ success: false, error: userMsg });
  }
});

/**
 * GET /api/health
 * Health check endpoint.
 */
router.get('/health', (req, res) => {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({
    status: 'ok',
    service: 'FlowMind API',
    version: '1.0.0',
    ai: hasApiKey ? 'configured' : 'not configured',
    timestamp: new Date().toISOString(),
  });
});

export default router;
