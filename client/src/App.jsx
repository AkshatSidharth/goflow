import React, { useState, useCallback } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import ChatPanel from './components/ChatPanel.jsx';
import FlowchartCanvas from './components/FlowchartCanvas.jsx';
import { generateFlowchart, editFlowchart } from './services/api.js';
import { convertAndLayout } from './utils/layoutEngine.js';
import { detectLanguage } from './utils/validator.js';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFlowchart, setCurrentFlowchart] = useState(null);
  const [detectedLanguage, setDetectedLanguage] = useState('EN');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const applyFlowchart = useCallback((flowchartData) => {
    setCurrentFlowchart(flowchartData);
    const { nodes: rfNodes, edges: rfEdges } = convertAndLayout(flowchartData);
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [setNodes, setEdges]);

  const addMessage = useCallback((role, content, type = 'text') => {
    setMessages((prev) => [
      ...prev,
      { role, content, type, timestamp: new Date() },
    ]);
  }, []);

  /** Rename a node label — syncs React Flow state + raw flowchart JSON */
  const handleNodeLabelChange = useCallback((nodeId, newLabel) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
      )
    );
    setCurrentFlowchart((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId ? { ...n, text: newLabel } : n
        ),
      };
    });
  }, [setNodes]);

  /** Delete a node and its connected edges */
  const handleNodeDelete = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setCurrentFlowchart((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== nodeId),
        edges: prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
      };
    });
  }, [setNodes, setEdges]);

  /** Add a new node manually to the canvas */
  const handleAddNode = useCallback((nodeType, label) => {
    const newId = `manual-${Date.now()}`;
    const rfType =
      nodeType === 'decision' ? 'decision'
      : nodeType === 'start' || nodeType === 'end' ? 'startEnd'
      : 'process';

    const newRfNode = {
      id: newId,
      type: rfType,
      position: { x: 280 + Math.random() * 120, y: 240 + Math.random() * 120 },
      data: { label, nodeType },
    };
    setNodes((nds) => [...nds, newRfNode]);
    setCurrentFlowchart((prev) => {
      const newApiNode = { id: newId, type: nodeType, text: label };
      if (!prev) return { nodes: [newApiNode], edges: [] };
      return { ...prev, nodes: [...prev.nodes, newApiNode] };
    });
  }, [setNodes]);

  const handleSend = useCallback(async (userInput) => {
    if (!userInput.trim() || isLoading) return;

    const lang = detectLanguage(userInput);
    setDetectedLanguage(lang);

    addMessage('user', userInput);
    setIsLoading(true);

    try {
      let newFlowchart;

      if (currentFlowchart) {
        addMessage('assistant', 'Updating your flowchart…', 'system');
        newFlowchart = await editFlowchart(userInput, currentFlowchart);

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.content !== 'Updating your flowchart…');
          return [
            ...filtered,
            {
              role: 'assistant',
              content: `Updated! "${userInput.length > 60 ? userInput.slice(0, 60) + '…' : userInput}"`,
              type: 'text',
              timestamp: new Date(),
            },
          ];
        });
      } else {
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
      setMessages((prev) => prev.filter((m) => m.type !== 'system'));
      addMessage('assistant', error.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, currentFlowchart, addMessage, applyFlowchart]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
        {/* Left panel: Chat */}
        <div
          className="flex-shrink-0 h-full border-r border-gray-800/80 overflow-hidden"
          style={{ width: '36%', minWidth: '320px', maxWidth: '480px' }}
        >
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
            hasFlowchart={!!currentFlowchart}
          />
        </div>

        {/* Right panel: Canvas */}
        <div className="flex-1 h-full overflow-hidden relative">
          <FlowchartCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            detectedLanguage={detectedLanguage !== 'EN' ? detectedLanguage : null}
            onNodeLabelChange={handleNodeLabelChange}
            onNodeDelete={handleNodeDelete}
            onAddNode={handleAddNode}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
