import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, updateEdge } from 'reactflow';
import ChatPanel from './components/ChatPanel.jsx';
import FlowchartCanvas from './components/FlowchartCanvas.jsx';
import { chatMessage, editFlowchart } from './services/api.js';
import { convertAndLayout } from './utils/layoutEngine.js';
import { detectLanguage } from './utils/validator.js';

// ─── Page helpers ─────────────────────────────────────────────────────────────

let _pageSeq = 1;
const newPage = (name) => ({
  id: `page-${Date.now()}-${_pageSeq++}`,
  name: name || `Page ${_pageSeq - 1}`,
  nodes: [],
  edges: [],
  flowchart: null,
});

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFlowchart, setPendingFlowchart] = useState(null);
  const [detectedLanguage, setDetectedLanguage] = useState('EN');

  // ─── Multi-page state ──────────────────────────────────────────────────────
  const [pages, setPages] = useState(() => {
    const p = newPage('Page 1');
    return [p];
  });
  const [currentPageId, setCurrentPageId] = useState(() => pages[0].id);

  const currentPage = useMemo(
    () => pages.find((p) => p.id === currentPageId) || pages[0],
    [pages, currentPageId],
  );
  const currentFlowchart = currentPage?.flowchart ?? null;

  // Helper: update the current page's flowchart inside the pages array
  const setCurrentFlowchart = useCallback((fc) => {
    setPages((prev) =>
      prev.map((p) => (p.id === currentPageId ? { ...p, flowchart: fc } : p)),
    );
  }, [currentPageId]);

  // ─── React Flow nodes/edges state ─────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ─── Undo / Redo history ──────────────────────────────────────────────────
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const resetHistory = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const pushHistory = useCallback((ns, es, fc) => {
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
  }, [setNodes, setEdges, setCurrentFlowchart]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCurrentFlowchart(snap.flowchart);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [setNodes, setEdges, setCurrentFlowchart]);

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

  // ─── Page management ──────────────────────────────────────────────────────

  const addPage = useCallback(() => {
    const p = newPage(`Page ${pages.length + 1}`);
    setPages((prev) => [
      ...prev.map((pg) => (pg.id === currentPageId ? { ...pg, nodes, edges } : pg)),
      p,
    ]);
    setNodes([]);
    setEdges([]);
    setCurrentPageId(p.id);
    resetHistory();
  }, [pages.length, currentPageId, nodes, edges, setNodes, setEdges, resetHistory]);

  const switchPage = useCallback((pageId) => {
    if (pageId === currentPageId) return;
    // Save current nodes/edges into the pages array before switching
    setPages((prev) =>
      prev.map((pg) => (pg.id === currentPageId ? { ...pg, nodes, edges } : pg)),
    );
    // Load target page
    const target = pages.find((p) => p.id === pageId);
    if (target) {
      setNodes(target.nodes);
      setEdges(target.edges);
    }
    setCurrentPageId(pageId);
    resetHistory();
  }, [currentPageId, nodes, edges, pages, setNodes, setEdges, resetHistory]);

  const deletePage = useCallback((pageId) => {
    if (pages.length <= 1) return;
    const idx = pages.findIndex((p) => p.id === pageId);
    const remaining = pages.filter((p) => p.id !== pageId);
    setPages(remaining);
    if (pageId === currentPageId) {
      const next = remaining[Math.max(0, idx - 1)];
      setNodes(next.nodes);
      setEdges(next.edges);
      setCurrentPageId(next.id);
      resetHistory();
    }
  }, [pages, currentPageId, setNodes, setEdges, resetHistory]);

  const renamePage = useCallback((pageId, name) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, name } : p)),
    );
  }, []);

  // ─── Flowchart application ─────────────────────────────────────────────────

  const applyFlowchart = useCallback((flowchartData) => {
    setCurrentFlowchart(flowchartData);
    const { nodes: rfNodes, edges: rfEdges } = convertAndLayout(flowchartData);
    setNodes(rfNodes);
    setEdges(rfEdges);
    pushHistory(rfNodes, rfEdges, flowchartData);
  }, [setNodes, setEdges, pushHistory, setCurrentFlowchart]);

  const addMessage = useCallback((role, content, type = 'text') => {
    setMessages((prev) => [...prev, { role, content, type, timestamp: new Date() }]);
  }, []);

  // ─── Canvas handlers ───────────────────────────────────────────────────────

  const handleNodeLabelChange = useCallback((nodeId, newLabel) => {
    const newNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n,
    );
    const newFlowchart = currentFlowchart
      ? { ...currentFlowchart, nodes: currentFlowchart.nodes.map((n) => n.id === nodeId ? { ...n, text: newLabel } : n) }
      : null;
    setNodes(newNodes);
    setCurrentFlowchart(newFlowchart);
    pushHistory(newNodes, edges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setNodes, setCurrentFlowchart]);

  const handleNodeDelete = useCallback((nodeId) => {
    const newNodes = nodes.filter((n) => n.id !== nodeId);
    const newEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    const newFlowchart = currentFlowchart
      ? {
          ...currentFlowchart,
          nodes: currentFlowchart.nodes.filter((n) => n.id !== nodeId),
          edges: currentFlowchart.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
        }
      : null;
    setNodes(newNodes);
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(newNodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setNodes, setEdges, setCurrentFlowchart]);

  const handleConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      type: 'deletable',
      style: { stroke: '#64748b', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#64748b' },
    };
    const newEdges = addEdge(newEdge, edges);
    const newFlowchart = currentFlowchart
      ? { ...currentFlowchart, edges: [...currentFlowchart.edges, { from: params.source, to: params.target, label: '' }] }
      : null;
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(nodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setEdges, setCurrentFlowchart]);

  const handleEdgeDelete = useCallback((edgeId, source, target) => {
    const newEdges = edges.filter((e) => e.id !== edgeId);
    const newFlowchart = currentFlowchart
      ? { ...currentFlowchart, edges: currentFlowchart.edges.filter((e) => !(e.from === source && e.to === target)) }
      : null;
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(nodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setEdges, setCurrentFlowchart]);

  const handleReconnect = useCallback((oldEdge, newConnection) => {
    const newEdges = updateEdge(oldEdge, newConnection, edges);
    const newFlowchart = currentFlowchart
      ? {
          ...currentFlowchart,
          edges: [
            ...currentFlowchart.edges.filter((e) => !(e.from === oldEdge.source && e.to === oldEdge.target)),
            { from: newConnection.source, to: newConnection.target, label: oldEdge.label || '' },
          ],
        }
      : null;
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(nodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setEdges, setCurrentFlowchart]);

  const handleAddNode = useCallback((nodeType, label, posX, posY) => {
    const newId = `manual-${Date.now()}`;
    const rfType =
      nodeType === 'decision' ? 'decision'
      : (nodeType === 'start' || nodeType === 'end') ? 'startEnd'
      : nodeType === 'io' ? 'io'
      : nodeType === 'database' ? 'database'
      : nodeType === 'document' ? 'document'
      : nodeType === 'hexagon' ? 'hexagon'
      : nodeType === 'group' ? 'group'
      : 'process';

    const newNode = {
      id: newId,
      type: rfType,
      position: (posX != null && posY != null)
        ? { x: posX, y: posY }
        : { x: 280 + Math.random() * 120, y: 240 + Math.random() * 120 },
      data: { label, nodeType },
    };
    const newNodes = [...nodes, newNode];
    const newFlowchart = currentFlowchart
      ? { ...currentFlowchart, nodes: [...currentFlowchart.nodes, { id: newId, type: nodeType, text: label }] }
      : { nodes: [{ id: newId, type: nodeType, text: label }], edges: [] };
    setNodes(newNodes);
    setCurrentFlowchart(newFlowchart);
    pushHistory(newNodes, edges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setNodes, setCurrentFlowchart]);

  const handleNodeRotate = useCallback((nodeId, rotation) => {
    setNodes((prev) =>
      prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, rotation } } : n),
    );
  }, [setNodes]);

  const handleAddConnectedNode = useCallback((sourceNodeId, nodeType, defaultLabel, flowX, flowY) => {
    const newId = `manual-${Date.now()}`;
    const rfType =
      nodeType === 'decision' ? 'decision'
      : (nodeType === 'start' || nodeType === 'end') ? 'startEnd'
      : nodeType === 'io' ? 'io'
      : nodeType === 'database' ? 'database'
      : nodeType === 'document' ? 'document'
      : nodeType === 'hexagon' ? 'hexagon'
      : nodeType === 'group' ? 'group'
      : 'process';

    const newNode = {
      id: newId,
      type: rfType,
      position: { x: flowX, y: flowY },
      data: { label: defaultLabel, nodeType },
    };
    const newEdge = {
      id: `e-${sourceNodeId}-${newId}-${Date.now()}`,
      source: sourceNodeId,
      target: newId,
      type: 'deletable',
      style: { stroke: '#64748b', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#64748b' },
    };
    const newNodes = [...nodes, newNode];
    const newEdges = [...edges, newEdge];
    const newFlowchart = currentFlowchart
      ? {
          ...currentFlowchart,
          nodes: [...currentFlowchart.nodes, { id: newId, type: nodeType, text: defaultLabel }],
          edges: [...currentFlowchart.edges, { from: sourceNodeId, to: newId, label: '' }],
        }
      : { nodes: [{ id: newId, type: nodeType, text: defaultLabel }], edges: [] };

    setNodes(newNodes);
    setEdges(newEdges);
    setCurrentFlowchart(newFlowchart);
    pushHistory(newNodes, newEdges, newFlowchart);
  }, [nodes, edges, currentFlowchart, pushHistory, setNodes, setEdges, setCurrentFlowchart]);

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
            onAddConnectedNode={handleAddConnectedNode}
            onNodeRotate={handleNodeRotate}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            pages={pages}
            currentPageId={currentPageId}
            onAddPage={addPage}
            onSwitchPage={switchPage}
            onDeletePage={deletePage}
            onRenamePage={renamePage}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
