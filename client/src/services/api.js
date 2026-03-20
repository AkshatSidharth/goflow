import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s timeout for LLM calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error normalization
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    console.error('[API Error]', message);
    return Promise.reject(new Error(message));
  }
);

/**
 * Generate a new flowchart from natural language.
 * @param {string} prompt - Natural language description
 * @returns {Promise<{ nodes: Array, edges: Array }>}
 */
export async function generateFlowchart(prompt) {
  const response = await api.post('/generate', { prompt });
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to generate flowchart');
  }
  return response.data.data;
}

/**
 * Edit an existing flowchart based on a natural language instruction.
 * @param {string} instruction - Edit instruction
 * @param {Object} currentFlowchart - Existing flowchart JSON
 * @returns {Promise<{ nodes: Array, edges: Array }>}
 */
export async function editFlowchart(instruction, currentFlowchart) {
  const response = await api.post('/edit', { instruction, currentFlowchart });
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to edit flowchart');
  }
  return response.data.data;
}

/**
 * Health check for the backend server.
 * @returns {Promise<Object>}
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

export default api;
