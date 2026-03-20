import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import flowchartRouter from './routes/flowchart.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', flowchartRouter);

// Root route
app.get('/', (_req, res) => {
  res.json({
    name: 'FlowMind API',
    version: '1.0.0',
    description: 'AI-Powered Multilingual Flowchart Generator',
    endpoints: {
      health: 'GET /api/health',
      generate: 'POST /api/generate',
      edit: 'POST /api/edit',
    },
  });
});

// ─── Error Handling ────────────────────────────────────────────────────────────

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 FlowMind API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   API Key: ${process.env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ not set (set ANTHROPIC_API_KEY)'}`);
  console.log('');
});

export default app;
