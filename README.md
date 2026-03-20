# FlowMind - AI-Powered Multilingual Flowchart Generator

Convert natural language descriptions into beautiful flowcharts instantly. Supports English, Hindi (हिंदी), Japanese (日本語), and Chinese (中文).

## Features

- **Natural Language to Flowchart**: Describe any process in plain text
- **Multilingual**: Automatically handles EN/HI/JA/ZH input
- **Smart Node Types**: Start/End ovals, Process rectangles, Decision diamonds
- **Loop Detection**: Backward edges animated with dashed lines
- **Edit Existing Charts**: Follow-up messages modify the current flowchart
- **Export PNG**: Download your flowchart at 2x resolution
- **Auto-layout**: Dagre-powered layout prevents node overlap

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI | Anthropic Claude (claude-opus-4-5) |
| Backend | Node.js + Express |
| Frontend | React 18 + Vite |
| Graph Rendering | React Flow v11 |
| Auto-layout | Dagre |
| Validation | Zod (server) |
| Styling | Tailwind CSS |

## Quick Start

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure API key

```bash
cp server/.env.example server/.env
# Edit server/.env and add your Anthropic API key:
# ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run development servers

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Project Structure

```
goflow/
├── package.json              # Root - concurrently scripts
├── server/
│   ├── index.js              # Express app entry
│   ├── package.json
│   ├── .env                  # API keys (not committed)
│   ├── .env.example
│   ├── prompts/
│   │   └── systemPrompt.js   # Claude system prompts
│   ├── routes/
│   │   └── flowchart.js      # POST /api/generate, POST /api/edit
│   └── services/
│       ├── llmService.js     # Anthropic SDK integration
│       └── validator.js      # Zod flowchart validation
└── client/
    ├── package.json
    ├── vite.config.js        # Proxy /api -> :3001
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx            # Root component + state management
        ├── index.css          # Tailwind + React Flow overrides
        ├── components/
        │   ├── ChatPanel.jsx  # Chat UI with sample prompts
        │   ├── FlowchartCanvas.jsx  # React Flow canvas + export
        │   └── nodes/
        │       ├── StartEndNode.jsx  # Oval nodes (blue/green)
        │       ├── ProcessNode.jsx   # Rectangle nodes
        │       └── DecisionNode.jsx  # Diamond nodes (amber)
        ├── services/
        │   └── api.js         # Axios API client
        └── utils/
            ├── layoutEngine.js  # Dagre auto-layout + conversion
            └── validator.js     # Client-side validation + language detection
```

## API Endpoints

### `POST /api/generate`
Generate a new flowchart from natural language.

**Request:**
```json
{ "prompt": "User logs in. If credentials valid, show dashboard. Otherwise show error." }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "n1", "type": "start", "text": "Start" },
      { "id": "n2", "type": "process", "text": "User logs in" },
      { "id": "n3", "type": "decision", "text": "Credentials valid?" },
      { "id": "n4", "type": "process", "text": "Show dashboard" },
      { "id": "n5", "type": "process", "text": "Show error" },
      { "id": "n6", "type": "end", "text": "End" }
    ],
    "edges": [
      { "from": "n1", "to": "n2", "label": "" },
      { "from": "n2", "to": "n3", "label": "" },
      { "from": "n3", "to": "n4", "label": "Yes" },
      { "from": "n3", "to": "n5", "label": "No" },
      { "from": "n4", "to": "n6", "label": "" },
      { "from": "n5", "to": "n6", "label": "" }
    ]
  },
  "meta": { "nodeCount": 6, "edgeCount": 6 }
}
```

### `POST /api/edit`
Edit an existing flowchart via natural language instruction.

**Request:**
```json
{
  "instruction": "Add a step to log the error before showing it",
  "currentFlowchart": { "nodes": [...], "edges": [...] }
}
```

### `GET /api/health`
Health check. Returns API status and whether the key is configured.

## Flowchart JSON Schema

```json
{
  "nodes": [
    { "id": "string", "type": "start | process | decision | end", "text": "string" }
  ],
  "edges": [
    { "from": "node_id", "to": "node_id", "label": "optional string" }
  ]
}
```

**Validation rules enforced on the server:**
- Exactly one `start` node required
- At least one `end` node required
- Decision nodes must have 2+ labeled outgoing edges
- All nodes must be reachable from the start node
- No duplicate node IDs
- All edge references must point to existing nodes

## Sample Prompts

**English:**
> Customer places order. Check inventory. If in stock, process payment. If payment succeeds, ship order. Otherwise show failure.

**Hindi:**
> उपयोगकर्ता फॉर्म भरता है। अगर फॉर्म सही है तो सबमिट करें, वरना त्रुटि दिखाएं।

**Japanese:**
> ユーザーがログインします。もし認証情報が正しければ、ダッシュボードを表示します。

**Chinese:**
> 用户提交申请。如果申请有效，则处理申请。否则，显示错误。

## Production Build

```bash
npm run build
# Builds client to client/dist/
# Serve client/dist/ as static files alongside the Express server
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `PORT` | Server port | `3001` |
| `CLIENT_ORIGIN` | CORS allowed origin | `http://localhost:5173` |
