/**
 * ZIP Fallback — 不支持 File System Access API 时的导出方案
 * 使用 JSZip 打包所有文件为 .zip 下载
 */

import type { KnowledgeNode, KnowledgeEdge, Board } from '@/types';
import { generateNodeMarkdown } from './MarkdownGenerator';
import { sanitizeFileName, sanitizeFolderName } from './FileNameSanitizer';

/** 检测是否支持 File System Access API */
export function needsZipFallback(): boolean {
  return typeof window !== 'undefined' && !('showDirectoryPicker' in window);
}

/** 动态加载 JSZip 并打包导出 */
export async function exportAsZip(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  boards: Board[]
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const board of boards) {
    const boardNodes = nodes.filter(n => n.boardId === board.id);
    const boardEdges = edges.filter(e => e.boardId === board.id);
    const boardFolder = zip.folder(sanitizeFolderName(board.name, board.id))!;
    boardFolder.folder('attachments');
    boardFolder.folder('canvas');

    for (const node of boardNodes) {
      const fileName = sanitizeFileName(node.title, node.id);

      // MD 文件
      const mdContent = generateNodeMarkdown(node, boardEdges, nodes);
      boardFolder.file(`${fileName}.md`, mdContent);

      // 附件文件（base64 → binary）
      if (node.fileData && node.metadata.materialType) {
        const ext = node.metadata.materialType;
        const attachmentName = node.metadata.source?.split('/').pop() || `${fileName}.${ext}`;
        try {
          const binary = dataUrlToBase64(node.fileData);
          if (binary) {
            boardFolder.folder('attachments')!.file(attachmentName, binary, { base64: true });
          }
        } catch { /* skip */ }
      }

      // 白板文件
      if (node.whiteboard) {
        boardFolder.folder('canvas')!.file(`${fileName}.excalidraw`, node.whiteboard);
      }
    }
  }

  // 生成并下载
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `memos-vault-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 从 dataURL 提取 base64 部分 */
function dataUrlToBase64(dataUrl: string): string | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  return dataUrl.slice(commaIdx + 1);
}
