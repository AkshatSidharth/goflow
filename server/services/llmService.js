import OpenAI from 'openai';
import { SYSTEM_PROMPT, EDIT_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
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
  banking: {
    plan: '銀行業務フロー（12ノード）: 顧客の来店・オンラインアクセスから始まり、サービス選択→KYC本人確認→書類確認→承認判断という流れで進みます。承認された場合は取引実行→完了通知→記録保存で終了、却下された場合は別の終了ノードに分岐します。',
    flowchart: {
      nodes: [
        { id: 'n1',  type: 'start',    text: '開始' },
        { id: 'n2',  type: 'process',  text: '顧客が来店またはオンラインアクセス' },
        { id: 'n3',  type: 'process',  text: 'サービスの選択（口座開設・入出金・送金・ローン申請など）' },
        { id: 'n4',  type: 'process',  text: '本人確認（KYC）プロセス' },
        { id: 'n5',  type: 'decision', text: '本人確認成功？' },
        { id: 'n6',  type: 'process',  text: '必要書類の提出・確認' },
        { id: 'n7',  type: 'decision', text: '承認または却下？' },
        { id: 'n8',  type: 'process',  text: '取引またはサービスの実行' },
        { id: 'n9',  type: 'process',  text: '完了通知の送信（SMSまたはメール）' },
        { id: 'n10', type: 'process',  text: 'トランザクションの記録・保存' },
        { id: 'n11', type: 'end',      text: '終了 — 完了' },
        { id: 'n12', type: 'end',      text: '終了 — 却下' },
      ],
      edges: [
        { from: 'n1',  to: 'n2',  label: '' },
        { from: 'n2',  to: 'n3',  label: '' },
        { from: 'n3',  to: 'n4',  label: '' },
        { from: 'n4',  to: 'n5',  label: '' },
        { from: 'n5',  to: 'n6',  label: 'はい' },
        { from: 'n5',  to: 'n12', label: 'いいえ' },
        { from: 'n6',  to: 'n7',  label: '' },
        { from: 'n7',  to: 'n8',  label: '承認' },
        { from: 'n7',  to: 'n12', label: '却下' },
        { from: 'n8',  to: 'n9',  label: '' },
        { from: 'n9',  to: 'n10', label: '' },
        { from: 'n10', to: 'n11', label: '' },
      ],
    },
  },
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
  // Banking — English and Japanese keywords
  if (
    lower.includes('bank') || lower.includes('banking') || lower.includes('kyc') ||
    input.includes('銀行') || input.includes('口座') || input.includes('入金') ||
    input.includes('出金') || input.includes('送金') || input.includes('トランザクション') ||
    input.includes('本人確認') || input.includes('ローン申請')
  ) {
    return DEMO_FLOWCHARTS.banking;
  }
  if (lower.includes('login') || lower.includes('retry') || lower.includes('再試行') || lower.includes('dubara') || lower.includes('sign in') || lower.includes('credential')) {
    return DEMO_FLOWCHARTS.login;
  }
  if (lower.includes('payment') || lower.includes('pay') || lower.includes('支付') || lower.includes('checkout') || lower.includes('fail')) {
    return DEMO_FLOWCHARTS.payment;
  }
  return DEMO_FLOWCHARTS.default;
}

const DEMO_STEPS = {
  banking: `Here are the key steps in a banking transaction flow:

1. **Customer Initiates Request** – Customer visits branch, ATM, or online portal.
2. **Identity Verification** – System checks customer credentials (PIN, OTP, or biometrics).
3. **Account Validation** – Verify account exists and is active.
4. **Balance Check** – Confirm sufficient funds are available for the transaction.
5. **Transaction Processing** – Debit or credit the appropriate accounts.
6. **Fraud Detection Check** – Flag any suspicious or unusual activity.
7. **Confirmation** – Generate receipt or confirmation message for the customer.
8. **Record Keeping** – Update transaction logs and account statements.

Would you like me to generate a flowchart based on these steps?`,

  login: `Here are the steps in a user login flow:

1. **Open Login Page** – User navigates to the login screen.
2. **Enter Credentials** – User inputs username and password.
3. **Validate Input** – Check fields are not empty/malformed.
4. **Authenticate** – Verify credentials against the database.
5. **Check Result** – Valid credentials grant access; invalid shows error.
6. **Retry or Lock** – Allow limited retries before locking the account.
7. **Redirect on Success** – Navigate user to the dashboard.
8. **Create Session** – Establish an authenticated session token.

Would you like me to generate a flowchart for this?`,

  payment: `Here are the steps in a payment processing flow:

1. **Customer Selects Items** – Items are added to the cart.
2. **Proceed to Checkout** – Customer reviews the order total.
3. **Enter Payment Details** – Input card number, CVV, and expiry date.
4. **Submit to Payment Gateway** – Send payment request to the gateway.
5. **Bank Authorization** – Bank approves or declines the charge.
6. **Check Result** – If approved, complete the order; if declined, show error.
7. **Retry Option** – Allow the customer to try a different payment method.
8. **Send Confirmation** – Email or notify customer with order confirmation.

Would you like me to generate a flowchart for this?`,

  order: `Here are the steps in an order processing flow:

1. **Customer Places Order** – Selects items and submits the order.
2. **Order Received** – System logs the new order with a unique ID.
3. **Inventory Check** – Verify that all items are in stock.
4. **Payment Processing** – Charge customer for the order amount.
5. **Payment Verification** – Confirm successful payment.
6. **Order Fulfillment** – Pick, pack, and prepare items for shipping.
7. **Dispatch** – Ship order with a tracking number.
8. **Delivery Confirmation** – Mark order as delivered and notify customer.

Would you like me to generate a flowchart for this?`,

  default: `Here are the general steps in this workflow:

1. **Start** – Initiate the process.
2. **Gather Input** – Collect the required data or information.
3. **Validate** – Check that the input meets requirements.
4. **Process** – Execute the main logic or action.
5. **Decision Point** – Evaluate if the result meets the success criteria.
6. **Handle Success** – If yes, proceed with the success path.
7. **Handle Failure** – If no, handle the error or exception.
8. **Complete** – Finalize and record the outcome.

Would you like me to generate a flowchart for this?`,
};

function isConversationalRequest(input) {
  const lower = input.toLowerCase();
  return (
    lower.includes('step') ||
    lower.includes('explain') ||
    lower.includes('describe') ||
    lower.includes('how does') ||
    lower.includes('tell me') ||
    lower.includes('walk me through') ||
    lower.includes('what are') ||
    lower.includes('list the') ||
    lower.includes('show me the process') ||
    lower.includes('break it down')
  );
}

function getDemoTopic(texts) {
  const combined = texts.join(' ');
  const lower = combined.toLowerCase();
  if (
    lower.includes('bank') || lower.includes('banking') || lower.includes('transaction') || lower.includes('atm') || lower.includes('kyc') ||
    combined.includes('銀行') || combined.includes('口座') || combined.includes('入金') || combined.includes('出金') || combined.includes('送金') || combined.includes('本人確認')
  ) return 'banking';
  if (lower.includes('login') || lower.includes('credential') || lower.includes('sign in') || combined.includes('ログイン')) return 'login';
  if (lower.includes('payment') || lower.includes('pay') || lower.includes('checkout') || combined.includes('支払') || combined.includes('決済')) return 'payment';
  if (lower.includes('order') || lower.includes('inventory') || lower.includes('shipping') || combined.includes('注文') || combined.includes('配送')) return 'order';
  return 'default';
}

function getDemoChat(input, history = []) {
  if (isConversationalRequest(input)) {
    const allTexts = [input, ...history.map((m) => m.content || '')];
    const topic = getDemoTopic(allTexts);
    return { type: 'text', message: DEMO_STEPS[topic] };
  }
  const demoResult = getDemoFlowchart(input);
  return { type: 'flowchart', plan: demoResult.plan, data: demoResult.flowchart };
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

/**
 * Conversational chat — returns either a text response or a flowchart proposal.
 * @param {string} userInput - User's message
 * @param {Array} history - Previous messages [{role, content}]
 * @returns {Promise<{type: "text", message: string} | {type: "flowchart", plan: string, data: Object}>}
 */
export async function chat(userInput, history = []) {
  if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
    throw new Error('User input cannot be empty');
  }

  const client = getClient();

  if (!client) {
    console.log('[chat] Demo mode');
    await new Promise((r) => setTimeout(r, 700));
    return getDemoChat(userInput, history);
  }

  const messages = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }];

  // Include recent conversation history for context (last 8 messages)
  const recentHistory = history.slice(-8);
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: String(msg.content) });
    }
  }
  messages.push({ role: 'user', content: userInput.trim() });

  const response = await client.chat.completions.create({
    model: 'gpt-5.1',
    max_tokens: 4096,
    messages,
  });

  const responseText = response.choices[0]?.message?.content;
  if (!responseText) throw new Error('LLM returned empty content');

  const rawData = extractJSON(responseText);

  if (rawData.type === 'text') {
    return { type: 'text', message: rawData.message || '' };
  }

  // type === 'flowchart'
  const flowchartData = rawData.flowchart || rawData;
  const plan = rawData.plan || '';
  const sanitized = sanitizeFlowchart(flowchartData);
  const validation = validateFlowchart(sanitized);

  if (!validation.valid) {
    throw new Error(`Flowchart validation failed: ${validation.errors.join('; ')}`);
  }

  return { type: 'flowchart', plan, data: validation.data };
}
