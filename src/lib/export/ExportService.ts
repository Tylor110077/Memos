/**
 * ExportService — 核心导出服务（单例）
 * 负责将 Memos 数据导出为 Obsidian 兼容的文件系统结构
 */

import type { KnowledgeNode, KnowledgeEdge, Board } from '@/types';
import { generateNodeMarkdown } from './MarkdownGenerator';
import { sanitizeFileName, sanitizeFolderName } from './FileNameSanitizer';

/** 检测浏览器是否支持 File System Access API */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

class ExportService {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private dirName: string | null = null;
  private lastExportedAt: string | null = null;

  /** 是否已授权目录 */
  get isReady(): boolean {
    return this.rootHandle !== null;
  }

  get directoryName(): string | null {
    return this.dirName;
  }

  /** 选择导出目录 */
  async selectDirectory(): Promise<boolean> {
    if (!isFileSystemAccessSupported()) return false;
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      this.rootHandle = handle;
      this.dirName = handle.name;
      // 持久化 handle 到 IndexedDB
      await this.saveHandle(handle);
      return true;
    } catch {
      return false; // 用户取消
    }
  }

  /** 恢复之前授权的目录 */
  async restoreHandle(): Promise<boolean> {
    const handle = await this.loadHandle();
    if (!handle) return false;
    try {
      const perm = await (handle as any).requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        this.rootHandle = handle;
        this.dirName = handle.name;
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /** 全量导出 */
  async exportAll(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    boards: Board[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ exported: number; errors: string[] }> {
    if (!this.rootHandle) throw new Error('未选择导出目录');

    const errors: string[] = [];
    let exported = 0;

    for (let i = 0; i < boards.length; i++) {
      const board = boards[i];
      const boardNodes = nodes.filter(n => n.boardId === board.id);
      const boardEdges = edges.filter(e => e.boardId === board.id);

      try {
        const boardDir = await this.rootHandle.getDirectoryHandle(
          sanitizeFolderName(board.name, board.id),
          { create: true }
        );

        // 创建子目录
        await boardDir.getDirectoryHandle('attachments', { create: true });
        await boardDir.getDirectoryHandle('canvas', { create: true });

        // 导出每个节点
        for (let j = 0; j < boardNodes.length; j++) {
          try {
            await this.exportNodeToDir(boardDir, boardNodes[j], boardEdges, nodes);
            exported++;
          } catch (e) {
            errors.push(`${boardNodes[j].title}: ${e}`);
          }
          onProgress?.(exported, boardNodes.length);
        }
      } catch (e) {
        errors.push(`Board "${board.name}": ${e}`);
      }
    }

    this.lastExportedAt = new Date().toISOString();
    return { exported, errors };
  }

  /** 增量导出（仅变更节点） */
  async exportIncremental(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    boards: Board[],
    changedNodeIds: Set<string>
  ): Promise<number> {
    if (!this.rootHandle || changedNodeIds.size === 0) return 0;

    let count = 0;
    for (const nodeId of changedNodeIds) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;
      const board = boards.find(b => b.id === node.boardId);
      if (!board) continue;

      try {
        const boardDir = await this.rootHandle.getDirectoryHandle(
          sanitizeFolderName(board.name, board.id),
          { create: true }
        );
        await boardDir.getDirectoryHandle('attachments', { create: true });
        await boardDir.getDirectoryHandle('canvas', { create: true });
        const boardEdges = edges.filter(e => e.boardId === board.id);
        await this.exportNodeToDir(boardDir, node, boardEdges, nodes);
        count++;
      } catch { /* skip */ }
    }

    this.lastExportedAt = new Date().toISOString();
    return count;
  }

  /** 获取自上次导出后变更的节点 ID */
  getChangedNodeIds(nodes: KnowledgeNode[]): Set<string> {
    if (!this.lastExportedAt) return new Set(nodes.map(n => n.id));
    const changed = new Set<string>();
    for (const node of nodes) {
      if (node.metadata.updatedAt > this.lastExportedAt) {
        changed.add(node.id);
      }
    }
    return changed;
  }

  setLastExportedAt(ts: string | null) {
    this.lastExportedAt = ts;
  }

  // ===== 内部方法 =====

  private async exportNodeToDir(
    boardDir: FileSystemDirectoryHandle,
    node: KnowledgeNode,
    edges: KnowledgeEdge[],
    allNodes: KnowledgeNode[]
  ): Promise<void> {
    const fileName = sanitizeFileName(node.title, node.id);

    // 写入 MD 文件
    const mdContent = generateNodeMarkdown(node, edges, allNodes);
    const mdHandle = await boardDir.getFileHandle(`${fileName}.md`, { create: true });
    const writable = await mdHandle.createWritable();
    await writable.write(mdContent);
    await writable.close();

    // 写入附件文件（base64 → 二进制）
    if (node.fileData && node.metadata.materialType) {
      const ext = node.metadata.materialType;
      const attachmentName = node.metadata.source?.split('/').pop() || `${fileName}.${ext}`;
      try {
        const blob = this.dataUrlToBlob(node.fileData);
        if (blob) {
          const attachDir = await boardDir.getDirectoryHandle('attachments', { create: true });
          const fileHandle = await attachDir.getFileHandle(attachmentName, { create: true });
          const w = await fileHandle.createWritable();
          await w.write(blob);
          await w.close();
        }
      } catch { /* skip attachment write error */ }
    }

    // 写入白板文件
    if (node.whiteboard) {
      try {
        const canvasDir = await boardDir.getDirectoryHandle('canvas', { create: true });
        const wbHandle = await canvasDir.getFileHandle(`${fileName}.excalidraw`, { create: true });
        const w = await wbHandle.createWritable();
        await w.write(node.whiteboard);
        await w.close();
      } catch { /* skip */ }
    }
  }

  /** dataURL/base64 → Blob */
  private dataUrlToBlob(dataUrl: string): Blob | null {
    try {
      if (dataUrl.startsWith('data:')) {
        const [header, base64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      }
      return null;
    } catch {
      return null;
    }
  }

  // ===== Handle 持久化 =====

  private async saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'root');
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch { /* ignore */ }
  }

  private async loadHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get('root');
      const result = await new Promise<FileSystemDirectoryHandle | undefined>((resolve) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });
      db.close();
      return result || null;
    } catch {
      return null;
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('memos-export-handles', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}

/** 全局单例 */
export const exportService = new ExportService();
