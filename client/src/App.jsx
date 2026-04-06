import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, updateEdge } from 'reactflow';
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

  // ─── Undo / Redo history ───────────────────────────────────────────────────
  // Each entry: { nodes, edges, flowchart }
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((ns, es, fc) => {
    // Drop any forward history when a new action is taken
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push({ nodes: ns, edges: es, flowchart: fc });
    if (historyRef.current.length > 60) historyRef.current.shift();
    else historyIndexRef.current += 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCurrentFlowchart(snap.flowchart);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCurrentFlowchart(snap.flowchart);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [setNodes, setEdges]);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ─── Flowchart application ─────────────────────────────────────────────────

  const applyFlowchart = useCallback((flowchartData) => {
    setCurrentFlowchart(flowchartData);
    const { nodes: rfNodes, edges: rfEdges } = convertAndLayout(flowchartData);
    setNodes(rfNodes);
    setEdges(rfEdges);
    pushHistory(rfNodes, rfEdges, flowchartData);
  }, [setNodes, setEdges, pushHistory]);

  const addMessage = useCallback((role, content, type = 'text') => {
    setMessages((prev) => [
      ...prev,
      { role, content, type, timestamp: new Date() },
    ]);
  }, []);

  // ─── Canvas handlers (each computes the new state and pushes history) ──────

  /** Rename a node label */
  const handleNodeLabelChange = useCallback((nodeId, newLabel) => {
    const newNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
    );
    const newFlowchart = currentFlowchart ? {
      ...currentFlowchart,
      nodes: currentFlowchart.nodes.map((n) =>
        n.id === nodeId ? { ...n, text: newLabel } : n
      ),
    } : null;
    setNodes(newNodes);
    setCurrentFlowchart(newFlowchart);
    pushHistory(newNodes, edges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setNodes]);

  /** Delete a node and its connected edges */
  const handleNodeDelete = useCallback((nodeId) => {
    const newNodes = nodes.filter((n) => n.id !== nodeId);
    const newEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    const newFlowchart = currentFlowchart ? {
      ...currentFlowchart,
      nodes: currentFlowchart.nodes.filter((n) => n.id !== nodeId),
      edges: currentFlowchart.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    } : null;
    setNodes(newNodes);
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(newNodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setNodes, setEdges]);

  /** Connect two nodes by dragging from one handle to another */
  const handleConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      type: 'deletable',
      style: { stroke: '#64748b', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#64748b' },
    };
    const newEdges = addEdge(newEdge, edges);
    const newFlowchart = currentFlowchart ? {
      ...currentFlowchart,
      edges: [...currentFlowchart.edges, { from: params.source, to: params.target, label: '' }],
    } : null;
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(nodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setEdges]);

  /** Delete an edge */
  const handleEdgeDelete = useCallback((edgeId, source, target) => {
    const newEdges = edges.filter((e) => e.id !== edgeId);
    const newFlowchart = currentFlowchart ? {
      ...currentFlowchart,
      edges: currentFlowchart.edges.filter((e) => !(e.from === source && e.to === target)),
    } : null;
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(nodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setEdges]);

  /** Reconnect an edge by dragging its endpoint to a new node/handle */
  const handleReconnect = useCallback((oldEdge, newConnection) => {
    const newEdges = updateEdge(oldEdge, newConnection, edges);
    const newFlowchart = currentFlowchart ? {
      ...currentFlowchart,
      edges: [
        ...currentFlowchart.edges.filter(
          (e) => !(e.from === oldEdge.source && e.to === oldEdge.target)
        ),
        { from: newConnection.source, to: newConnection.target, label: oldEdge.label || '' },
      ],
    } : null;
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(nodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setEdges]);

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

    const newNode = {
      id: newId,
      type: rfType,
      position: { x: 280 + Math.random() * 120, y: 240 + Math.random() * 120 },
      data: { label, nodeType },
    };
    const newNodes = [...nodes, newNode];
    const newFlowchart = currentFlowchart
      ? { ...currentFlowchart, nodes: [...currentFlowchart.nodes, { id: newId, type: nodeType, text: label }] }
      : { nodes: [{ id: newId, type: nodeType, text: label }], edges: [] };
    setNodes(newNodes);
    setCurrentFlowchart(newFlowchart);
    pushHistory(newNodes, edges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setNodes]);

  // ─── Chat / confirm / cancel ───────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (!pendingFlowchart) return;
    applyFlowchart(pendingFlowchart);
    setPendingFlowchart(null);
    addMessage('assistant', 'Flowchart applied to the canvas.', 'system');
  }, [pendingFlowchart, applyFlowchart, addMessage]);

  const handleCancel = useCallback(() => {
    setPendingFlowchart(null);
    addMessage('assistant', 'Cancelled. The canvas was not changed.', 'system');
  }, [addMessage]);

  const handleSend = useCallback(async (userInput) => {
    if (!userInput.trim() || isLoading) return;

    const lang = detectLanguage(userInput);
    setDetectedLanguage(lang);

    if (pendingFlowchart) setPendingFlowchart(null);

    addMessage('user', userInput);
    setIsLoading(true);

    try {
      if (currentFlowchart) {
        addMessage('assistant', 'Thinking…', 'system');
        const result = await editFlowchart(userInput, currentFlowchart);
        setMessages((prev) => prev.filter((m) => m.content !== 'Thinking…'));
        setPendingFlowchart(result.data);
        addMessage('assistant', result.plan || 'Here is the updated flowchart.', 'plan');
      } else {
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
      <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-app)' }}>
        {/* Left panel: Chat */}
        <div
          className="flex-shrink-0 h-full border-r border-gray-800/80 overflow-hidden"
          style={{ width: '34%', minWidth: '300px', maxWidth: '440px' }}
        >
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
            hasFlowchart={!!currentFlowchart}
            hasPending={!!pendingFlowchart}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onAddNode={handleAddNode}
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
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
