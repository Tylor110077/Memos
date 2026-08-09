'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Maximize2, StickyNote, PenLine } from 'lucide-react';
import type { KnowledgeNode } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  concept: '概念',
  theme: '主题',
  material: '材料',
  understanding: '理解',
  question: '问题',
};

const TYPE_COLOR: Record<string, string> = {
  concept: 'var(--node-concept, #8b5cf6)',
  theme: 'var(--node-theme, #a78bfa)',
  material: 'var(--node-material, #22d3ee)',
  understanding: 'var(--node-understanding, #60a5fa)',
  question: 'var(--node-question, #c084fc)',
};

interface NodeCardProps {
  node: KnowledgeNode;
  selected?: boolean;
  onOpenDetail?: () => void;
}

/**
 * 节点卡片形态：展示标题/摘要/笔记数/类型标签/白板缩略图/展开按钮
 */
export function NodeCard({ node, selected, onOpenDetail }: NodeCardProps) {
  const color = TYPE_COLOR[node.type] || 'var(--text-muted)';
  const summaryText = node.summary || node.content || '';
  const excerpt = summaryText.length > 80 ? `${summaryText.slice(0, 80)}…` : summaryText;
  const noteCount = node.notes?.length || 0;

  return (
    <div
      className="relative rounded-lg border bg-[var(--bg-secondary)]/95 backdrop-blur-sm shadow-md p-2.5 w-[180px] cursor-pointer transition-all duration-200 hover:shadow-lg"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        boxShadow: selected ? '0 0 0 2px var(--accent-soft)' : undefined,
      }}
      onClick={onOpenDetail}
    >
      {/* 类型标签 + 标题 */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-medium text-[var(--text-primary)] truncate flex-1">
          {node.title}
        </span>
      </div>

      {/* 摘要 */}
      {excerpt && (
        <p className="text-[10px] leading-snug text-[var(--text-secondary)] line-clamp-3 mb-1.5">
          {excerpt}
        </p>
      )}

      {/* 白板缩略图 */}
      {node.whiteboardThumbnail && (
        <img
          src={node.whiteboardThumbnail}
          alt="whiteboard"
          className="w-full h-[60px] object-cover rounded-md border border-[var(--border)] mb-1.5"
        />
      )}

      {/* 底部：类型 + 笔记数 + 操作 */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {TYPE_LABEL[node.type] || node.type}
        </span>
        {noteCount > 0 && (
          <span className="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]">
            <StickyNote size={9} /> {noteCount}
          </span>
        )}
        {node.whiteboard && (
          <PenLine size={9} className="text-[var(--text-muted)]" />
        )}
        <span className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onOpenDetail?.(); }}
          className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          title="展开详情"
        >
          <Maximize2 size={11} />
        </button>
      </div>
    </div>
  );
}
