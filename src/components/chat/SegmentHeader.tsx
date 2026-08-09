'use client';

import { useState } from 'react';
import { ChevronRight, CheckSquare, Square, Layers, Loader2, Pencil, X } from 'lucide-react';
import type { ChatSegment } from '@/types';

interface SegmentHeaderProps {
  segment: ChatSegment;
  messageCount: number;
  isSelected?: boolean;
  onToggleCollapse: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onGenerateNodes: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  generating?: boolean;
}

export function SegmentHeader({
  segment,
  messageCount,
  isSelected = false,
  onToggleCollapse,
  onSelectAll,
  onDeselectAll,
  onGenerateNodes,
  onRename,
  onRemove,
  generating,
}: SegmentHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(segment.name);

  const handleRenameConfirm = () => {
    const trimmed = editName.trim();
    if (trimmed) onRename(trimmed);
    setIsEditing(false);
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 my-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] group cursor-pointer select-none"
      style={{ animation: 'fadeIn 150ms ease-out' }}
    >
      {/* 折叠/展开 */}
      <button onClick={onToggleCollapse} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ChevronRight size={14} className={`transition-transform duration-300 ${segment.collapsed ? '' : 'rotate-90'}`} />
      </button>

      {/* 主题名 */}
      {isEditing ? (
        <input
          autoFocus
          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs rounded border border-[var(--accent)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={handleRenameConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setIsEditing(false); }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          className="flex-1 min-w-0 text-xs font-medium text-[var(--text-primary)] truncate"
          onClick={onToggleCollapse}
        >
          {segment.name}
        </span>
      )}

      {/* 消息数 */}
      <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{messageCount} 条</span>

      {/* 操作按钮（悬停显示） */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); isSelected ? onDeselectAll() : onSelectAll(); }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title={isSelected ? '取消全选' : '全选该段消息'}
        >
          {isSelected ? <Square size={11} /> : <CheckSquare size={11} />}
          <span>{isSelected ? '取消' : '全选'}</span>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onGenerateNodes(); }}
          disabled={generating}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
          title="对该段对话生成知识节点"
        >
          {generating ? <Loader2 size={11} className="animate-spin" /> : <Layers size={11} />}
          <span>{generating ? '生成中' : '归纳'}</span>
        </button>
        <button
          onClick={e => { e.stopPropagation(); setEditName(segment.name); setIsEditing(true); }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="重命名分段"
        >
          <Pencil size={11} />
          <span>改名</span>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          title="删除分段（不删除消息）"
        >
          <X size={11} />
          <span>删除</span>
        </button>
      </div>
    </div>
  );
}
