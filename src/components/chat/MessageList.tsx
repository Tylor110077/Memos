'use client';

import { useEffect, useRef } from 'react';
import type { Message } from 'ai';
import { Globe, Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { SegmentHeader } from './SegmentHeader';
import { Logo } from '@/components/Logo';
import type { ChatSegment } from '@/types';

interface MessageListProps {
  messages: Message[];
  selectedMessages?: Set<number>;
  webSearchStatus?: 'searching' | { sources: number } | null;
  segments?: ChatSegment[];
  markStartIndex?: number | null;
  onSelectChange?: (index: number, checked: boolean) => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onMarkStart?: (index: number) => void;
  onMarkEnd?: (index: number) => void;
  onToggleSegment?: (id: string) => void;
  onSelectSegment?: (seg: ChatSegment) => void;
  onGenerateSegment?: (seg: ChatSegment) => void;
  onRenameSegment?: (id: string, name: string) => void;
  onRemoveSegment?: (id: string) => void;
  generatingSegment?: string | null;
}

export default function MessageList({
  messages, selectedMessages, webSearchStatus, segments = [], markStartIndex,
  onSelectChange, onEditMessage, onMarkStart, onMarkEnd,
  onToggleSegment, onSelectSegment, onGenerateSegment, onRenameSegment, onRemoveSegment, generatingSegment,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Logo size={72} className="rounded-2xl shadow-lg shadow-black/30" />
        <h1
          className="text-4xl font-semibold italic tracking-[0.06em] bg-gradient-to-r from-[var(--accent)] to-[var(--text-primary)] bg-clip-text text-transparent"
          style={{ fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif' }}
        >
          Memos
        </h1>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span className="w-8 h-px bg-[var(--border)]" />
          <span className="text-xs">开始一段探索</span>
          <span className="w-8 h-px bg-[var(--border)]" />
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2 tracking-wider">让每一次好奇，都长成知识的形状</p>
      </div>
    );
  }

  // 构建 index → segment 映射
  const segmentAtStart = new Map<number, ChatSegment>(); // segment 起始 index → segment
  const segmentRange = new Map<number, ChatSegment>();   // 所有属于某 segment 的 index → segment
  for (const seg of segments) {
    segmentAtStart.set(seg.startMsgIndex, seg);
    for (let i = seg.startMsgIndex; i <= seg.endMsgIndex; i++) {
      segmentRange.set(i, seg);
    }
  }

  // 计算每条消息的分段标记状态
  const getSegmentMark = (index: number): 'none' | 'start-available' | 'end-available' | 'is-start' | 'in-segment' => {
    if (segmentRange.has(index)) return 'in-segment';
    if (markStartIndex === index) return 'is-start';
    if (markStartIndex !== null && markStartIndex !== undefined && index > markStartIndex) return 'end-available';
    if (markStartIndex === null || markStartIndex === undefined) return 'start-available';
    return 'none';
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((message, index) => {
        const segAtThisIndex = segmentAtStart.get(index);

        // 如果该 segment 折叠，渲染 SegmentHeader 并跳过后续消息
        if (segAtThisIndex && segAtThisIndex.collapsed) {
          const count = segAtThisIndex.endMsgIndex - segAtThisIndex.startMsgIndex + 1;
          return (
            <SegmentHeader
              key={`seg-${segAtThisIndex.id}`}
              segment={segAtThisIndex}
              messageCount={count}
              onToggleCollapse={() => onToggleSegment?.(segAtThisIndex.id)}
              onSelectAll={() => onSelectSegment?.(segAtThisIndex)}
              onGenerateNodes={() => onGenerateSegment?.(segAtThisIndex)}
              onRename={(name) => onRenameSegment?.(segAtThisIndex.id, name)}
              onRemove={() => onRemoveSegment?.(segAtThisIndex.id)}
              generating={generatingSegment === segAtThisIndex.id}
            />
          );
        }

        // 如果属于折叠 segment 范围内的非起始消息，跳过
        const parentSeg = segmentRange.get(index);
        if (parentSeg && parentSeg.collapsed && index !== parentSeg.startMsgIndex) {
          return null;
        }

        // 展开态的 segment 起始位置：先渲染 header 再渲染消息
        const mark = getSegmentMark(index);
        return (
          <div key={message.id}>
            {segAtThisIndex && !segAtThisIndex.collapsed && (
              <SegmentHeader
                segment={segAtThisIndex}
                messageCount={segAtThisIndex.endMsgIndex - segAtThisIndex.startMsgIndex + 1}
                onToggleCollapse={() => onToggleSegment?.(segAtThisIndex.id)}
                onSelectAll={() => onSelectSegment?.(segAtThisIndex)}
                onGenerateNodes={() => onGenerateSegment?.(segAtThisIndex)}
                onRename={(name) => onRenameSegment?.(segAtThisIndex.id, name)}
                onRemove={() => onRemoveSegment?.(segAtThisIndex.id)}
                generating={generatingSegment === segAtThisIndex.id}
              />
            )}
            <MessageBubble
              message={message}
              selected={selectedMessages?.has(index) ?? false}
              onSelectChange={(checked) => onSelectChange?.(index, checked)}
              onEditMessage={onEditMessage}
              segmentMark={mark}
              onMarkStart={() => onMarkStart?.(index)}
              onMarkEnd={() => onMarkEnd?.(index)}
            />
          </div>
        );
      })}
      {/* 联网搜索状态指示器 */}
      {webSearchStatus === 'searching' && (
        <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] w-fit"
          style={{ animation: 'fadeIn 200ms ease-out' }}>
          <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
          <Globe size={12} className="text-[var(--accent)]" />
          <span className="text-[11px] text-[var(--text-secondary)]">正在联网搜索...</span>
        </div>
      )}
      {webSearchStatus && typeof webSearchStatus === 'object' && webSearchStatus.sources > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 mt-1 rounded-md bg-[var(--accent-soft)] w-fit"
          style={{ animation: 'fadeIn 200ms ease-out' }}>
          <Globe size={11} className="text-[var(--accent)]" />
          <span className="text-[10px] text-[var(--accent)] font-medium">已搜索 {webSearchStatus.sources} 个来源</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
