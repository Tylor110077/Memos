/**
 * Markdown 生成器
 * 将 KnowledgeNode 转换为 Obsidian 兼容的 Markdown 文件内容
 */

import type { KnowledgeNode, KnowledgeEdge } from '@/types';
import { sanitizeFileName } from './FileNameSanitizer';

/** 生成 YAML frontmatter */
export function generateFrontmatter(node: KnowledgeNode): string {
  const lines: string[] = ['---'];
  lines.push(`id: ${node.id}`);
  lines.push(`type: ${node.type}`);
  lines.push(`level: ${node.level}`);
  lines.push(`status: ${node.status}`);
  lines.push(`boardId: ${node.boardId}`);
  lines.push(`createdAt: ${node.metadata.createdAt}`);
  lines.push(`updatedAt: ${node.metadata.updatedAt}`);

  // tags
  const tags: string[] = [node.type];
  if (node.contentCategory) tags.push(node.contentCategory);
  lines.push(`tags:`);
  tags.forEach(t => lines.push(`  - ${t}`));

  // 可选字段
  if (node.metadata.source) lines.push(`source: ${node.metadata.source}`);
  if (node.metadata.materialType) lines.push(`materialType: ${node.metadata.materialType}`);
  if (node.cognitionLevel !== undefined) lines.push(`cognitionLevel: ${node.cognitionLevel}`);
  if (node.whiteboard) {
    const wbFileName = sanitizeFileName(node.title, node.id);
    lines.push(`whiteboard: canvas/${wbFileName}.excalidraw`);
  }

  lines.push('---');
  return lines.join('\n');
}

/** 生成笔记区域 */
function generateNotesSection(node: KnowledgeNode): string {
  if (!node.notes || node.notes.length === 0) return '';

  const lines: string[] = ['', '## 笔记', ''];
  const sorted = [...node.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const note of sorted) {
    const kindLabel = { manual: '手动笔记', chat: '对话摘录', question: '我的提问' }[note.kind] || note.kind;
    const date = new Date(note.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const calloutType = note.kind === 'question' ? 'quote' : 'note';
    lines.push(`> [!${calloutType}] ${kindLabel} · ${date}`);
    // 多行内容每行加 > 前缀
    const contentLines = note.content.split('\n');
    contentLines.forEach(l => lines.push(`> ${l}`));
    lines.push('');
  }

  return lines.join('\n');
}

/** 生成关联区域（双链） */
function generateLinksSection(
  node: KnowledgeNode,
  edges: KnowledgeEdge[],
  allNodes: KnowledgeNode[]
): string {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  const hierarchy: string[] = [];
  const association: string[] = [];
  const reference: string[] = [];

  for (const edge of edges) {
    if (edge.source !== node.id && edge.target !== node.id) continue;
    const otherId = edge.source === node.id ? edge.target : edge.source;
    const otherNode = nodeMap.get(otherId);
    if (!otherNode) continue;
    const link = `[[${otherNode.title}]]`;

    switch (edge.type) {
      case 'hierarchy': hierarchy.push(link); break;
      case 'association': association.push(link); break;
      case 'reference': reference.push(link); break;
    }
  }

  if (hierarchy.length === 0 && association.length === 0 && reference.length === 0) return '';

  const lines: string[] = ['', '## 关联', ''];
  if (hierarchy.length > 0) {
    lines.push('### 层级');
    hierarchy.forEach(l => lines.push(`- ${l}`));
    lines.push('');
  }
  if (association.length > 0) {
    lines.push('### 相关');
    association.forEach(l => lines.push(`- ${l}`));
    lines.push('');
  }
  if (reference.length > 0) {
    lines.push('### 引用');
    reference.forEach(l => lines.push(`- ${l}`));
    lines.push('');
  }

  return lines.join('\n');
}

/** 生成节点正文（根据类型区分） */
function generateBodyContent(node: KnowledgeNode): string {
  const isWebMaterial = node.type === 'material' && node.metadata.source?.startsWith('http');
  const isFileMaterial = node.type === 'material' && node.metadata.materialType && !isWebMaterial;

  if (isWebMaterial) {
    // 网页节点：链接 + 内容
    const lines = [`[原文链接](${node.metadata.source})`, ''];
    if (node.content) lines.push(node.content);
    return lines.join('\n');
  }

  if (isFileMaterial) {
    // 文件节点：嵌入链接 + 内容
    const ext = node.metadata.materialType || 'file';
    const fileName = node.metadata.source?.split('/').pop() || `${sanitizeFileName(node.title, node.id)}.${ext}`;
    const lines = [`![[attachments/${fileName}]]`, ''];
    if (node.content) lines.push(node.content);
    return lines.join('\n');
  }

  // 普通节点：直接输出内容
  return node.content || '';
}

/** 生成完整的 Markdown 文件内容 */
export function generateNodeMarkdown(
  node: KnowledgeNode,
  edges: KnowledgeEdge[],
  allNodes: KnowledgeNode[]
): string {
  const parts: string[] = [];

  // Frontmatter
  parts.push(generateFrontmatter(node));
  parts.push('');

  // H1 标题
  parts.push(`# ${node.title}`);
  parts.push('');

  // 正文
  const body = generateBodyContent(node);
  if (body) parts.push(body);

  // 笔记区
  const notes = generateNotesSection(node);
  if (notes) parts.push(notes);

  // 关联区
  const links = generateLinksSection(node, edges, allNodes);
  if (links) parts.push(links);

  return parts.join('\n');
}
