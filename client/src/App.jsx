import React, { useState, useCallback } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import ChatPanel from './components/ChatPanel.jsx';
import FlowchartCanvas from './components/FlowchartCanvas.jsx';
import { generateFlowchart, editFlowchart } from './services/api.js';
import { convertAndLayout } from './utils/layoutEngine.js';
import { detectLanguage } from './utils/validator.js';

/**
 * Root application component.
 * Manages global state: messages, flowchart data, loading state.
 */
export default function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFlowchart, setCurrentFlowchart] = useState(null); // Raw API JSON
  const [detectedLanguage, setDetectedLanguage] = useState('EN');

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /**
   * Applies new flowchart data: converts to React Flow format and updates state.
   */
  const applyFlowchart = useCallback((flowchartData) => {
    setCurrentFlowchart(flowchartData);
    const { nodes: rfNodes, edges: rfEdges } = convertAndLayout(flowchartData);
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [setNodes, setEdges]);

  /**
   * Adds a message to the chat history.
   */
  const addMessage = useCallback((role, content, type = 'text') => {
    setMessages((prev) => [
      ...prev,
      {
        role,
        content,
        type,
        timestamp: new Date(),
      },
    ]);
  }, []);

  /**
   * Handles sending a message from the chat panel.
   * If a flowchart already exists, treats it as an edit request.
   * Otherwise, generates a new flowchart.
   */
  const handleSend = useCallback(async (userInput) => {
    if (!userInput.trim() || isLoading) return;

    // Detect language for the badge
    const lang = detectLanguage(userInput);
    setDetectedLanguage(lang);

    // Add user message to chat
    addMessage('user', userInput);
    setIsLoading(true);

    try {
      let newFlowchart;

      if (currentFlowchart) {
        // Edit mode: send current flowchart + instruction
        addMessage('assistant', 'Updating your flowchart…', 'system');
        newFlowchart = await editFlowchart(userInput, currentFlowchart);

        // Remove the "updating" system message and replace with success
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.content !== 'Updating your flowchart…');
          return [
            ...filtered,
            {
              role: 'assistant',
              content: `Flowchart updated! Made changes based on: "${userInput.length > 60 ? userInput.slice(0, 60) + '…' : userInput}"`,
              type: 'text',
              timestamp: new Date(),
            },
          ];
        });
      } else {
        // Generate mode: create new flowchart
        newFlowchart = await generateFlowchart(userInput);

        const nodeCount = newFlowchart.nodes.length;
        const edgeCount = newFlowchart.edges.length;
        const decisionCount = newFlowchart.nodes.filter((n) => n.type === 'decision').length;

        let summary = `Generated flowchart with ${nodeCount} nodes and ${edgeCount} connections`;
        if (decisionCount > 0) {
          summary += `, including ${decisionCount} decision branch${decisionCount > 1 ? 'es' : ''}`;
        }
        summary += '.';

        addMessage('assistant', summary);
      }

      applyFlowchart(newFlowchart);
    } catch (error) {
      console.error('[App] Error:', error.message);

      // Remove any pending system messages
      setMessages((prev) => prev.filter((m) => m.type !== 'system'));

      addMessage(
        'assistant',
        error.message || 'Something went wrong. Please try again.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, currentFlowchart, addMessage, applyFlowchart]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
        {/* ─── Left panel: Chat ──────────────────────────────────────── */}
        <div
          className="flex-shrink-0 h-full border-r border-gray-800 overflow-hidden"
          style={{ width: '36%', minWidth: '320px', maxWidth: '480px' }}
        >
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
            hasFlowchart={!!currentFlowchart}
          />
        </div>

        {/* ─── Right panel: Canvas ───────────────────────────────────── */}
        <div className="flex-1 h-full overflow-hidden relative">
          <FlowchartCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            detectedLanguage={detectedLanguage !== 'EN' ? detectedLanguage : null}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
