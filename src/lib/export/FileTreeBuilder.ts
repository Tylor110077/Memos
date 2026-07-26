/**
 * FileTreeBuilder — 从 store 数据构建文件树结构
 */

import type { KnowledgeNode, Board } from '@/types';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'attachment';
  nodeType?: string;
  nodeId?: string;
  children?: FileTreeNode[];
  expanded?: boolean;
}

/** 节点类型对应的图标颜色 class */
const NODE_TYPE_COLORS: Record<string, string> = {
  concept: 'text-purple-400',
  theme: 'text-violet-400',
  material: 'text-cyan-400',
  understanding: 'text-blue-400',
  question: 'text-fuchsia-400',
};

export function getNodeTypeColor(nodeType?: string): string {
  return NODE_TYPE_COLORS[nodeType || ''] || 'text-[var(--text-secondary)]';
}

/** 从当前 Board 的节点构建文件树 */
export function buildFileTree(
  nodes: KnowledgeNode[],
  board: Board | null,
  searchQuery?: string
): FileTreeNode[] {
  if (!board) return [];

  const boardNodes = nodes.filter(n => n.boardId === board.id);

  // 搜索过滤
  const filtered = searchQuery
    ? boardNodes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : boardNodes;

  // 按类型分组
  const groups: { label: string; type: string; nodes: KnowledgeNode[] }[] = [
    { label: '概念', type: 'concept', nodes: [] },
    { label: '主题', type: 'theme', nodes: [] },
    { label: '材料', type: 'material', nodes: [] },
    { label: '理解', type: 'understanding', nodes: [] },
    { label: '问题', type: 'question', nodes: [] },
  ];

  for (const node of filtered) {
    const group = groups.find(g => g.type === node.type);
    if (group) group.nodes.push(node);
  }

  const tree: FileTreeNode[] = [];

  for (const group of groups) {
    if (group.nodes.length === 0) continue;
    // 按标题排序
    group.nodes.sort((a, b) => a.title.localeCompare(b.title));

    const children: FileTreeNode[] = group.nodes.map(n => ({
      id: n.id,
      name: n.title || 'untitled',
      type: 'file' as const,
      nodeType: n.type,
      nodeId: n.id,
    }));

    tree.push({
      id: `group-${group.type}`,
      name: `${group.label} (${group.nodes.length})`,
      type: 'folder',
      children,
      expanded: true,
    });
  }

  // 附件文件夹（虚拟）
  const fileNodes = boardNodes.filter(n => n.type === 'material' && n.metadata.materialType);
  if (fileNodes.length > 0) {
    tree.push({
      id: 'attachments',
      name: `attachments (${fileNodes.length})`,
      type: 'folder',
      children: fileNodes.map(n => ({
        id: `attach-${n.id}`,
        name: n.metadata.source?.split('/').pop() || `${n.title}.${n.metadata.materialType}`,
        type: 'attachment' as const,
        nodeId: n.id,
      })),
      expanded: false,
    });
  }

  // 画板文件夹（虚拟）
  const wbNodes = boardNodes.filter(n => n.whiteboard);
  if (wbNodes.length > 0) {
    tree.push({
      id: 'canvas',
      name: `canvas (${wbNodes.length})`,
      type: 'folder',
      children: wbNodes.map(n => ({
        id: `canvas-${n.id}`,
        name: `${n.title}.excalidraw`,
        type: 'attachment' as const,
        nodeId: n.id,
      })),
      expanded: false,
    });
  }

  return tree;
}
