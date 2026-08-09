/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nanoid } from 'nanoid';
import { Logo } from '@/components/Logo';

import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { useBoardStore } from '@/stores/boardStore';
import type { KnowledgeNode, KnowledgeEdge } from '@/types';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { Toolbar } from './Toolbar';
import { BoardSelector } from './BoardSelector';
import { useForceSimulation } from '@/lib/useForceSimulation';

function CanvasInner() {
  const { nodes: storeNodes, edges: storeEdges, selectedNodeId, selectedEdgeId } = useGraphStore();
  const { updateNodePosition, selectNode, selectEdge, addEdge, removeEdge, removeNode } = useGraphStore();
  const { openFullScreen, openNodeDetail } = useUIStore();
  const selectionTool = useUIStore((s) => s.selectionTool);
  const setSelectionTool = useUIStore((s) => s.setSelectionTool);
  const nodeDisplayMode = useUIStore((s) => s.nodeDisplayMode);
  const { currentBoardId } = useBoardStore();
  const reactFlowInstance = useReactFlow();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  // Shift+Click 多选状态（T-421）
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const isDraggingRef = useRef(false);
  const draggingNodeIdRef = useRef<string | null>(null);
  const hoverClearTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null); // 连线预览目标

  // 力导向模拟（拖拽时邻居被拉动，但跳过被拖拽节点）
  const onSimTick = useCallback((newPositions: Map<string, { x: number; y: number }>) => {
    // 仅更新内存位置（不写 IndexedDB），跳过拖拽中的节点
    useGraphStore.setState((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id === draggingNodeIdRef.current) return n; // 拖拽节点由 React Flow 控制
        const pos = newPositions.get(n.id);
        return pos ? { ...n, position: pos } : n;
      }),
    }));
  }, []);
  const { dragStart, dragEnd, dragMove } = useForceSimulation(storeNodes, storeEdges, onSimTick, nodeDisplayMode);

  // Hover 高亮
  const highlightedIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const ids = new Set<string>([hoveredNodeId]);
    for (const e of storeEdges) {
      if (e.source === hoveredNodeId) ids.add(e.target);
      if (e.target === hoveredNodeId) ids.add(e.source);
    }
    return ids;
  }, [hoveredNodeId, storeEdges]);

  // 转换节点（直接用 store 位置，React Flow 原生拖拽）
  const nodes: Node[] = useMemo(
    () =>
      storeNodes.map((n: KnowledgeNode) => {
        const isHoverDimmed = highlightedIds ? !highlightedIds.has(n.id) : false;
        return {
          id: n.id,
          type: n.type,
          position: n.position,
          data: {
            ...n,
            isDimmed: isHoverDimmed,
            isHovered: n.id === hoveredNodeId,
            isMultiSelected: multiSelectedIds.has(n.id),
          } as unknown as Record<string, unknown>,
          selected: n.id === selectedNodeId || multiSelectedIds.has(n.id),
        };
      }),
    [storeNodes, selectedNodeId, highlightedIds, hoveredNodeId, multiSelectedIds],
  );

  // 转换边
  const edges: Edge[] = useMemo(
    () => {
      const result: Edge[] = storeEdges.map((e: KnowledgeEdge) => {
        const isHoverDimmed = highlightedIds
          ? !highlightedIds.has(e.source) || !highlightedIds.has(e.target)
          : false;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'knowledge',
          data: {
            isDimmed: isHoverDimmed,
            isHighlighted: highlightedIds ? highlightedIds.has(e.source) && highlightedIds.has(e.target) : false,
            isSelected: e.id === selectedEdgeId,
          } as unknown as Record<string, unknown>,
        };
      });
      // T-440: 连线预览（流动虚线）
      if (previewTargetId && draggingNodeIdRef.current) {
        result.push({
          id: 'preview-edge',
          source: draggingNodeIdRef.current,
          target: previewTargetId,
          type: 'knowledge',
          style: { stroke: 'var(--accent)', strokeWidth: 1.5, strokeDasharray: '4 8', opacity: 0.9 },
          data: { isPreview: true } as unknown as Record<string, unknown>,
        } as Edge);
      }
      return result;
    },
    [storeEdges, highlightedIds, selectedEdgeId, previewTargetId],
  );

  // 节点拖拽结束：保存位置 + 近距离连线
  const onNodeDragStart = useCallback((_: any, node: Node) => {
    isDraggingRef.current = true;
    draggingNodeIdRef.current = node.id;
    setHoveredNodeId(null);
    dragStart(node.id);
  }, [dragStart]);

  const onNodeDrag = useCallback((_: any, node: Node) => {
    dragMove(node.id, node.position.x, node.position.y);
    // 连线预览：检测近距离节点
    const PROXIMITY = 80;
    let closest: string | null = null;
    for (const other of storeNodes) {
      if (other.id === node.id) continue;
      const dx = node.position.x - other.position.x;
      const dy = node.position.y - other.position.y;
      if (Math.sqrt(dx * dx + dy * dy) < PROXIMITY) {
        const exists = storeEdges.some(e => (e.source === node.id && e.target === other.id) || (e.source === other.id && e.target === node.id));
        if (!exists) { closest = other.id; break; }
      }
    }
    setPreviewTargetId(closest);
  }, [dragMove, storeNodes, storeEdges]);

  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      isDraggingRef.current = false;
      draggingNodeIdRef.current = null;
      setPreviewTargetId(null);
      dragEnd(node.id);
      updateNodePosition(node.id, node.position);

      // 近距离自动连线
      const PROXIMITY_THRESHOLD = 80;
      for (const otherNode of storeNodes) {
        if (otherNode.id === node.id) continue;
        const dx = node.position.x - otherNode.position.x;
        const dy = node.position.y - otherNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < PROXIMITY_THRESHOLD) {
          const edgeExists = storeEdges.some(
            (e) => (e.source === node.id && e.target === otherNode.id) || (e.source === otherNode.id && e.target === node.id),
          );
          if (!edgeExists && currentBoardId) {
            addEdge({ id: `edge-${nanoid(8)}`, boardId: currentBoardId, source: node.id, target: otherNode.id, relation: '关联', type: 'association', autoGenerated: false });
            break;
          }
        }
      }
    },
    [updateNodePosition, storeNodes, storeEdges, addEdge, currentBoardId],
  );

  // 节点变化（位置同步 + 删除）
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging) {
          // 拖拽中：仅更新 store 内存位置（不写 IndexedDB）
          useGraphStore.setState((state) => ({
            nodes: state.nodes.map((n) => n.id === change.id ? { ...n, position: change.position! } : n),
          }));
        } else if (change.type === 'remove') {
          removeNode(change.id);
        }
      }
    },
    [removeNode],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'remove') removeEdge(change.id);
      }
    },
    [removeEdge],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target || !currentBoardId) return;
      addEdge({ id: `edge-${nanoid(8)}`, boardId: currentBoardId, source: connection.source, target: connection.target, relation: '关联', type: 'association', autoGenerated: false });
    },
    [addEdge, currentBoardId],
  );

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    // 点选工具模式：点击即 toggle 多选，无需 Shift
    if (selectionTool === 'click') {
      setMultiSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      return;
    }
    // Shift+Click：toggle 多选（T-421）
    if (event.shiftKey) {
      setMultiSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
      return;
    }
    selectNode(node.id);
    openNodeDetail(node.id);
  }, [selectNode, openNodeDetail, selectionTool]);
  const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => { openFullScreen(node.id); }, [openFullScreen]);
  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    if (isDraggingRef.current) return;
    // 取消待定的清除，避免快速进出闪烁
    if (hoverClearTimeout.current) clearTimeout(hoverClearTimeout.current);
    setHoveredNodeId(node.id);
  }, []);
  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    if (isDraggingRef.current) return;
    // 延迟 50ms 清除，如果 50ms 内进入了另一个节点则不会闪烁
    hoverClearTimeout.current = setTimeout(() => setHoveredNodeId(null), 50);
  }, []);
  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    // 点选工具模式：点击边也加入多选
    if (selectionTool === 'click') {
      // 边没有 multiSelected 状态，但可以通过 selectEdge 高亮
      selectEdge(edge.id);
      return;
    }
    selectEdge(edge.id);
  }, [selectEdge, selectionTool]);
  const onPaneClick = useCallback(() => {
    selectNode(null);
    setMultiSelectedIds(new Set());
    // 点击空白处退出圈选工具
    if (selectionTool !== 'none') setSelectionTool('none');
  }, [selectNode, selectionTool, setSelectionTool]);

  // 框选工具：React Flow 原生 selection 变化时同步到 multiSelectedIds
  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    if (selectionTool === 'box') {
      const ids = new Set(params.nodes.map(n => n.id));
      setMultiSelectedIds(ids);
    }
  }, [selectionTool]);

  // Delete/Backspace：删除 Shift 多选的节点（一键删除），或删除选中的边（T-441）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      // 全屏详情弹窗打开时不处理（白板/笔记等内部操作不应触发画布删除）
      if (useUIStore.getState().fullScreenNodeId) return;
      // Excalidraw 白板内部不处理
      if (target.closest('.excalidraw')) return;

      // 优先：删除 Shift 多选的节点
      if (multiSelectedIds.size > 0) {
        e.preventDefault();
        const { removeNode: delNode } = useGraphStore.getState();
        multiSelectedIds.forEach((id) => delNode(id));
        setMultiSelectedIds(new Set());
        return;
      }

      // 其次：删除选中的边
      const { selectedEdgeId: edgeId, removeEdge: delEdge } = useGraphStore.getState();
      if (edgeId) {
        e.preventDefault();
        delEdge(edgeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [multiSelectedIds]);

  // 切换画板后自动居中
  useEffect(() => {
    if (currentBoardId) {
      setTimeout(() => reactFlowInstance.fitView({ duration: 300 }), 100);
    }
  }, [currentBoardId, reactFlowInstance]);

  // 监听全局快捷键触发的 fitView 事件（快捷键系统在 React Flow 上下文外部，通过自定义事件通信）
  useEffect(() => {
    const handleFitView = () => reactFlowInstance.fitView({ duration: 300 });
    window.addEventListener('studyboard:fit-view', handleFitView);
    return () => window.removeEventListener('studyboard:fit-view', handleFitView);
  }, [reactFlowInstance]);

  return (
    <div className="relative h-full w-full" style={{ backgroundColor: '#1e1e2e' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        fitView
        zoomOnDoubleClick={false}
        panOnDrag={selectionTool === 'box' ? [1, 2] : true}
        panOnScroll={false}
        selectionOnDrag={selectionTool === 'box'}
        selectionKeyCode={null}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        style={selectionTool !== 'none' ? { cursor: selectionTool === 'box' ? 'crosshair' : 'pointer' } : undefined}
      >
        <Background variant={BackgroundVariant.Lines} gap={36} size={1} color="rgba(255,255,255,0.045)" />
      </ReactFlow>

      {storeNodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <Logo size={64} className="mb-4 opacity-60" />
          <p className="text-gray-500 text-lg">开始你的知识探索之旅</p>
          <p className="text-gray-600 text-sm mt-2">在右侧对话面板提问，开始你的知识探索</p>
        </div>
      )}

      <Toolbar selectedNodeIds={multiSelectedIds} />
      <BoardSelector />
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
