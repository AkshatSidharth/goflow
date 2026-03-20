import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, EDIT_SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { validateFlowchart, sanitizeFlowchart } from './validator.js';

let anthropicClient = null;

function getClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
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

  let lastError = null;

  // Retry up to 2 times on validation failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userInput.trim(),
          },
        ],
      });

      const responseText = message.content[0]?.text;
      if (!responseText) {
        throw new Error('LLM returned empty content');
      }

      const rawData = extractJSON(responseText);
      const sanitized = sanitizeFlowchart(rawData);
      const validation = validateFlowchart(sanitized);

      if (!validation.valid) {
        lastError = new Error(
          `Flowchart validation failed: ${validation.errors.join('; ')}`
        );
        console.warn(`Attempt ${attempt} validation errors:`, validation.errors);

        if (attempt < 2) {
          // On second attempt, include the validation errors in the prompt
          continue;
        }
        throw lastError;
      }

      return validation.data;
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

  const userMessage = `Current flowchart JSON:
${JSON.stringify(currentFlowchart, null, 2)}

User instruction: ${instruction.trim()}

Apply the requested changes and return the complete updated flowchart JSON.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    system: EDIT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const responseText = message.content[0]?.text;
  if (!responseText) {
    throw new Error('LLM returned empty content');
  }

  const rawData = extractJSON(responseText);
  const sanitized = sanitizeFlowchart(rawData);
  const validation = validateFlowchart(sanitized);

  if (!validation.valid) {
    throw new Error(`Edited flowchart validation failed: ${validation.errors.join('; ')}`);
  }

  return validation.data;
}
