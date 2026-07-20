import { create } from 'zustand';
import type { KnowledgeNode, KnowledgeEdge, GraphChanges } from '@/types';
import * as dbOps from '@/lib/db';

interface GraphState {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isInitialized: boolean;

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
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  isInitialized: false,

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
    set((state) => {
      let nodes = [...state.nodes];
      const edges = [...state.edges];

      // 添加新节点
      for (const node of changes.newNodes) {
        nodes.push(node);
        dbOps.createNode(node).catch(console.error);
      }

      // 更新已有节点
      for (const { id, updates } of changes.updatedNodes) {
        nodes = nodes.map((n) => (n.id === id ? { ...n, ...updates } : n));
        dbOps.updateNode(id, updates).catch(console.error);
      }

      // 添加新边
      for (const edge of changes.newEdges) {
        edges.push(edge);
        dbOps.createEdge(edge).catch(console.error);
      }

      return { nodes, edges };
    });
  },

  updateNodePosition: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    }));
    dbOps.updateNode(id, { position }).catch(console.error);
  },
}));
