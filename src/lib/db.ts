import Dexie, { type EntityTable } from 'dexie';
import type { KnowledgeNode, KnowledgeEdge, Conversation, DomainGraph, NodeType, Board } from '@/types';
import { nanoid } from 'nanoid';

class StudyboardDB extends Dexie {
  boards!: EntityTable<Board, 'id'>;
  nodes!: EntityTable<KnowledgeNode, 'id'>;
  edges!: EntityTable<KnowledgeEdge, 'id'>;
  conversations!: EntityTable<Conversation, 'id'>;
  domains!: EntityTable<DomainGraph, 'id'>;

  constructor() {
    super('StudyboardDB');
    this.version(2).stores({
      boards: 'id, name',
      nodes: 'id, type, level, status, parentId, boardId, metadata.createdAt, metadata.domainId',
      edges: 'id, source, target, type, boardId, [source+target]',
      conversations: 'id, nodeId, mode, createdAt',
      domains: 'id, name',
    });
  }
}

export const db = new StudyboardDB();

// 节点 CRUD
export async function createNode(node: Omit<KnowledgeNode, 'id'>): Promise<KnowledgeNode> {
  const newNode = { ...node, id: nanoid() };
  await db.nodes.add(newNode);
  return newNode;
}

export async function updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<void> {
  await db.nodes.update(id, updates);
}

export async function deleteNode(id: string): Promise<void> {
  await db.transaction('rw', [db.nodes, db.edges], async () => {
    await db.nodes.delete(id);
    await db.edges.where('source').equals(id).delete();
    await db.edges.where('target').equals(id).delete();
  });
}

export async function getNode(id: string): Promise<KnowledgeNode | undefined> {
  return db.nodes.get(id);
}

export async function getAllNodes(): Promise<KnowledgeNode[]> {
  return db.nodes.toArray();
}

export async function getNodesByType(type: NodeType): Promise<KnowledgeNode[]> {
  return db.nodes.where('type').equals(type).toArray();
}

export async function getNodesByDomain(domainId: string): Promise<KnowledgeNode[]> {
  return db.nodes.where('metadata.domainId').equals(domainId).toArray();
}

export async function getChildNodes(parentId: string): Promise<KnowledgeNode[]> {
  return db.nodes.where('parentId').equals(parentId).toArray();
}

// 边 CRUD
export async function createEdge(edge: Omit<KnowledgeEdge, 'id'>): Promise<KnowledgeEdge> {
  const newEdge = { ...edge, id: nanoid() };
  await db.edges.add(newEdge);
  return newEdge;
}

export async function deleteEdge(id: string): Promise<void> {
  await db.edges.delete(id);
}

export async function getAllEdges(): Promise<KnowledgeEdge[]> {
  return db.edges.toArray();
}

export async function getEdgesByNode(nodeId: string): Promise<KnowledgeEdge[]> {
  const outgoing = await db.edges.where('source').equals(nodeId).toArray();
  const incoming = await db.edges.where('target').equals(nodeId).toArray();
  return [...outgoing, ...incoming];
}

export async function getEdgeBetween(source: string, target: string): Promise<KnowledgeEdge | undefined> {
  return db.edges.where('[source+target]').equals([source, target]).first();
}

// 对话 CRUD
export async function createConversation(conv: Omit<Conversation, 'id'>): Promise<Conversation> {
  const newConv = { ...conv, id: nanoid() };
  await db.conversations.add(newConv);
  return newConv;
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
  await db.conversations.update(id, updates);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return db.conversations.get(id);
}

export async function getConversationsByNode(nodeId: string): Promise<Conversation[]> {
  return db.conversations.where('nodeId').equals(nodeId).toArray();
}

export async function getAllConversations(): Promise<Conversation[]> {
  return db.conversations.orderBy('createdAt').reverse().toArray();
}

// 领域 CRUD
export async function createDomain(domain: Omit<DomainGraph, 'id'>): Promise<DomainGraph> {
  const newDomain = { ...domain, id: nanoid() };
  await db.domains.add(newDomain);
  return newDomain;
}

export async function getAllDomains(): Promise<DomainGraph[]> {
  return db.domains.toArray();
}

// 画板 CRUD
export async function createBoard(board: Omit<Board, 'id'>): Promise<Board> {
  const newBoard = { ...board, id: nanoid() };
  await db.boards.add(newBoard);
  return newBoard;
}

export async function getAllBoards(): Promise<Board[]> {
  return db.boards.toArray();
}

export async function deleteBoard(id: string): Promise<void> {
  await db.transaction('rw', [db.boards, db.nodes, db.edges], async () => {
    await db.boards.delete(id);
    await db.nodes.where('boardId').equals(id).delete();
    await db.edges.where('boardId').equals(id).delete();
  });
}

export async function updateBoard(id: string, updates: Partial<Board>): Promise<void> {
  await db.boards.update(id, updates);
}

// 按画板查询节点和边
export async function getNodesByBoard(boardId: string): Promise<KnowledgeNode[]> {
  return db.nodes.where('boardId').equals(boardId).toArray();
}

export async function getEdgesByBoard(boardId: string): Promise<KnowledgeEdge[]> {
  return db.edges.where('boardId').equals(boardId).toArray();
}
