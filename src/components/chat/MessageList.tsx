'use client';

import { useEffect, useRef, type RefObject } from 'react';
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
  onDeselectSegment?: (seg: ChatSegment) => void;
  onGenerateSegment?: (seg: ChatSegment) => void;
  onRenameSegment?: (id: string, name: string) => void;
  onRemoveSegment?: (id: string) => void;
  generatingSegment?: string | null;
  isSegmentSelected?: (seg: ChatSegment) => boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScrollReady?: (el: HTMLDivElement | null) => void;
}

export default function MessageList({
  messages, selectedMessages, webSearchStatus, segments = [], markStartIndex,
  onSelectChange, onEditMessage, onMarkStart, onMarkEnd,
  onToggleSegment, onSelectSegment, onDeselectSegment, onGenerateSegment, onRenameSegment, onRemoveSegment, generatingSegment, isSegmentSelected, scrollRef, onScrollReady,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  // 用户是否停留在底部附近：是则流式输出时自动跟随，否则不强行拉回
  const stickToBottomRef = useRef(true);

  // 暴露 scroll container 给父组件
  useEffect(() => {
    if (scrollRef && internalScrollRef.current) {
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = internalScrollRef.current;
    }
    if (onScrollReady && internalScrollRef.current) {
      onScrollReady(internalScrollRef.current);
    }
  }, [scrollRef, onScrollReady]);

  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 监听滚动：记录用户是否在底部附近
  const handleListScroll = () => {
    const el = internalScrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

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
    <div ref={internalScrollRef} onScroll={handleListScroll} className="flex-1 overflow-y-auto pl-[28px] pr-4 py-4">
      {messages.map((message, index) => {
        const segAtThisIndex = segmentAtStart.get(index);
        const parentSeg = segmentRange.get(index);

        // 属于折叠 segment 范围内的非起始消息 → 不渲染（由起始位置的动画容器统一处理）
        if (parentSeg && index !== parentSeg.startMsgIndex) {
          return null;
        }

        const mark = getSegmentMark(index);

        // 如果该 index 是某个 segment 的起始，渲染 header + 可折叠内容区
        if (segAtThisIndex) {
          const seg = segAtThisIndex;
          const count = seg.endMsgIndex - seg.startMsgIndex + 1;
          const isCollapsed = seg.collapsed;

          return (
            <div key={`seg-block-${seg.id}`} data-msg-index={seg.startMsgIndex}>
              <SegmentHeader
                segment={seg}
                messageCount={count}
                isSelected={isSegmentSelected?.(seg) ?? false}
                onToggleCollapse={() => onToggleSegment?.(seg.id)}
                onSelectAll={() => onSelectSegment?.(seg)}
                onDeselectAll={() => onDeselectSegment?.(seg)}
                onGenerateNodes={() => onGenerateSegment?.(seg)}
                onRename={(name) => onRenameSegment?.(seg.id, name)}
                onRemove={() => onRemoveSegment?.(seg.id)}
                generating={generatingSegment === seg.id}
              />
              {/* 丝滑折叠动画容器 */}
              <div
                className="grid transition-all duration-300 ease-in-out"
                style={{
                  gridTemplateRows: isCollapsed ? '0fr' : '1fr',
                  opacity: isCollapsed ? 0 : 1,
                }}
              >
                <div className="overflow-hidden min-h-0">
                  {messages.slice(seg.startMsgIndex, seg.endMsgIndex + 1).map((msg, i) => {
                    const msgIndex = seg.startMsgIndex + i;
                    const msgMark = getSegmentMark(msgIndex);
                    return (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        selected={selectedMessages?.has(msgIndex) ?? false}
                        onSelectChange={(checked) => onSelectChange?.(msgIndex, checked)}
                        onEditMessage={onEditMessage}
                        segmentMark={msgMark}
                        onMarkStart={() => onMarkStart?.(msgIndex)}
                        onMarkEnd={() => onMarkEnd?.(msgIndex)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        // 普通消息（不属于任何 segment）
        return (
          <div key={message.id} data-msg-index={index}>
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
