import React, { useState, useCallback } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, reconnectEdge } from 'reactflow';
import ChatPanel from './components/ChatPanel.jsx';
import FlowchartCanvas from './components/FlowchartCanvas.jsx';
import { chatMessage, editFlowchart } from './services/api.js';
import { convertAndLayout } from './utils/layoutEngine.js';
import { detectLanguage } from './utils/validator.js';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFlowchart, setCurrentFlowchart] = useState(null);
  const [pendingFlowchart, setPendingFlowchart] = useState(null);
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

  /** Connect two nodes by dragging from one handle to another */
  const handleConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      type: 'deletable',
      style: { stroke: '#64748b', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#64748b' },
    };
    setEdges((eds) => addEdge(newEdge, eds));
    setCurrentFlowchart((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        edges: [...prev.edges, { from: params.source, to: params.target, label: '' }],
      };
    });
  }, [setEdges]);

  /** Delete an edge by clicking its × button */
  const handleEdgeDelete = useCallback((edgeId, source, target) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setCurrentFlowchart((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        edges: prev.edges.filter((e) => !(e.from === source && e.to === target)),
      };
    });
  }, [setEdges]);

  /** Reconnect an edge by dragging its endpoint to a new node/handle */
  const handleReconnect = useCallback((oldEdge, newConnection) => {
    setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    setCurrentFlowchart((prev) => {
      if (!prev) return prev;
      const filtered = prev.edges.filter(
        (e) => !(e.from === oldEdge.source && e.to === oldEdge.target)
      );
      return {
        ...prev,
        edges: [...filtered, { from: newConnection.source, to: newConnection.target, label: oldEdge.label || '' }],
      };
    });
  }, [setEdges]);

  /** Add a new node manually to the canvas */
  const handleAddNode = useCallback((nodeType, label) => {
    const newId = `manual-${Date.now()}`;
    const rfType =
      nodeType === 'decision' ? 'decision'
      : nodeType === 'start' || nodeType === 'end' ? 'startEnd'
      : nodeType === 'io' ? 'io'
      : nodeType === 'database' ? 'database'
      : nodeType === 'document' ? 'document'
      : nodeType === 'hexagon' ? 'hexagon'
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

  /** User confirms the proposed flowchart — apply it to the canvas */
  const handleConfirm = useCallback(() => {
    if (!pendingFlowchart) return;
    applyFlowchart(pendingFlowchart);
    setPendingFlowchart(null);
    addMessage('assistant', 'Flowchart applied to the canvas.', 'system');
  }, [pendingFlowchart, applyFlowchart, addMessage]);

  /** User cancels the proposed flowchart */
  const handleCancel = useCallback(() => {
    setPendingFlowchart(null);
    addMessage('assistant', 'Cancelled. The canvas was not changed.', 'system');
  }, [addMessage]);

  const handleSend = useCallback(async (userInput) => {
    if (!userInput.trim() || isLoading) return;

    const lang = detectLanguage(userInput);
    setDetectedLanguage(lang);

    // If there's a pending flowchart awaiting confirmation, cancel it silently
    if (pendingFlowchart) {
      setPendingFlowchart(null);
    }

    addMessage('user', userInput);
    setIsLoading(true);

    try {
      if (currentFlowchart) {
        // Edit mode: modify existing canvas flowchart
        addMessage('assistant', 'Thinking…', 'system');
        const result = await editFlowchart(userInput, currentFlowchart);
        setMessages((prev) => prev.filter((m) => m.content !== 'Thinking…'));
        setPendingFlowchart(result.data);
        addMessage('assistant', result.plan || 'Here is the updated flowchart.', 'plan');
      } else {
        // Chat mode: can return text response OR a flowchart proposal
        // Strip system/noise messages; annotate plan messages so LLM knows they were proposals
        const historySnapshot = messages
          .filter((m) => m.type !== 'system' && m.content && m.content !== 'Thinking…')
          .map((m) => ({
            role: m.role,
            content: m.type === 'plan' ? `[Proposed flowchart]: ${m.content}` : m.content,
          }));
        const result = await chatMessage(userInput, historySnapshot);
        if (result.type === 'text') {
          addMessage('assistant', result.message, 'text');
        } else {
          setPendingFlowchart(result.data);
          addMessage('assistant', result.plan || 'Here is the proposed flowchart. Confirm to apply it to the canvas.', 'plan');
        }
      }
    } catch (error) {
      console.error('[App] Error:', error.message);
      setMessages((prev) => prev.filter((m) => m.type !== 'system'));
      addMessage('assistant', error.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, currentFlowchart, pendingFlowchart, messages, addMessage]);

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
            hasPending={!!pendingFlowchart}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
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
            onConnect={handleConnect}
            onEdgeDelete={handleEdgeDelete}
            onReconnect={handleReconnect}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
