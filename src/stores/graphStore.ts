import { create } from 'zustand';
import type { KnowledgeNode, KnowledgeEdge, GraphChanges, NoteEntry, NoteKind } from '@/types';
import * as dbOps from '@/lib/db';
import { nanoid } from 'nanoid';

interface GraphState {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isInitialized: boolean;
  /** 正在被认知评审的节点 ID 集合 */
  evaluatingNodeIds: Set<string>;
  setEvaluating: (nodeId: string, evaluating: boolean) => void;

  initializeGraph: (boardId: string) => Promise<void>;
  addNode: (node: KnowledgeNode) => void;
  updateNode: (id: string, updates: Partial<KnowledgeNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: KnowledgeEdge) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  applyGraphChanges: (changes: GraphChanges) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  addNoteToNode: (nodeId: string, content: string, kind: NoteKind) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  isInitialized: false,
  evaluatingNodeIds: new Set(),

  setEvaluating: (nodeId, evaluating) =>
    set((state) => {
      const next = new Set(state.evaluatingNodeIds);
      if (evaluating) next.add(nodeId);
      else next.delete(nodeId);
      return { evaluatingNodeIds: next };
    }),

  initializeGraph: async (boardId: string) => {
    const [nodes, edges] = await Promise.all([
      dbOps.getNodesByBoard(boardId),
      dbOps.getEdgesByBoard(boardId),
    ]);
    set({ nodes, edges, isInitialized: true, selectedNodeId: null, selectedEdgeId: null });
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
    dbOps.createNode(node).catch(console.error);
  },

  updateNode: (id, updates) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
    dbOps.updateNode(id, updates).catch(console.error);
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
    dbOps.deleteNode(id).catch(console.error);
  },

  addEdge: (edge) => {
    set((state) => ({ edges: [...state.edges, edge] }));
    dbOps.createEdge(edge).catch(console.error);
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
    }));
    dbOps.deleteEdge(id).catch(console.error);
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  applyGraphChanges: (changes) => {
    // 先更新内存状态
    set((state) => {
      let nodes = [...state.nodes];
      const edges = [...state.edges];

      for (const node of changes.newNodes) {
        nodes.push(node);
      }
      for (const { id, updates } of changes.updatedNodes) {
        nodes = nodes.map((n) => (n.id === id ? { ...n, ...updates } : n));
      }
      for (const edge of changes.newEdges) {
        edges.push(edge);
      }

      return { nodes, edges };
    });

    // 在 set 外部执行数据库持久化（与 addEdge/addNode 行为一致）
    for (const node of changes.newNodes) {
      dbOps.createNode(node).catch(console.error);
    }
    for (const { id, updates } of changes.updatedNodes) {
      dbOps.updateNode(id, updates).catch(console.error);
    }
    for (const edge of changes.newEdges) {
      dbOps.createEdge(edge).catch(console.error);
    }
  },

  updateNodePosition: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    }));
    dbOps.updateNode(id, { position }).catch(console.error);
  },

  // 给节点追加一条笔记
  addNoteToNode: (nodeId, content, kind) => {
    const note: NoteEntry = { id: nanoid(), content, kind, createdAt: new Date().toISOString() };
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, notes: [...(n.notes || []), note] } : n,
      ),
    }));
    const node = get().nodes.find((n) => n.id === nodeId);
    if (node) dbOps.updateNode(nodeId, { notes: node.notes }).catch(console.error);
  },
}));
