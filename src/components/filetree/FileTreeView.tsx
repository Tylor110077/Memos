'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, Paperclip, Search } from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useBoardStore } from '@/stores/boardStore';
import { useUIStore } from '@/stores/uiStore';
import { buildFileTree, getNodeTypeColor, type FileTreeNode } from '@/lib/export/FileTreeBuilder';

/** 单个树节点（递归） */
function TreeItem({ node, depth = 0 }: { node: FileTreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(node.expanded ?? false);
  const openFullScreen = useUIStore(s => s.openFullScreen);

  const handleClick = () => {
    if (node.type === 'folder') {
      setExpanded(v => !v);
    } else if (node.nodeId) {
      openFullScreen(node.nodeId);
    }
  };

  const icon = node.type === 'folder'
    ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
    : node.type === 'attachment'
      ? <Paperclip size={13} className="text-[var(--text-muted)]" />
      : <FileText size={13} className={getNodeTypeColor(node.nodeType)} />;

  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left rounded-md hover:bg-[var(--bg-hover)] transition-colors group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="text-[var(--text-muted)] shrink-0">{icon}</span>
        <span className={`text-xs truncate ${node.type === 'file' ? getNodeTypeColor(node.nodeType) : 'text-[var(--text-secondary)]'}`}>
          {node.name}
        </span>
      </button>
      {node.type === 'folder' && expanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 文件树视图主组件 */
export function FileTreeView() {
  const nodes = useGraphStore(s => s.nodes);
  const { currentBoardId, boards } = useBoardStore();
  const [search, setSearch] = useState('');

  const currentBoard = boards.find(b => b.id === currentBoardId) || null;
  const tree = useMemo(() => buildFileTree(nodes, currentBoard, search), [nodes, currentBoard, search]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* 搜索栏 */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)]">
          <Search size={13} className="text-[var(--text-muted)] shrink-0" />
          <input
            className="flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="搜索节点..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 树内容 */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--text-muted)]">
            {currentBoard ? '暂无节点' : '请先选择画板'}
          </div>
        ) : (
          tree.map(node => <TreeItem key={node.id} node={node} />)
        )}
      </div>

      {/* 底部统计 */}
      <div className="px-3 py-1.5 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
        {currentBoard?.name || '未选择画板'} · {nodes.filter(n => n.boardId === currentBoardId).length} 个节点
      </div>
    </div>
  );
}
