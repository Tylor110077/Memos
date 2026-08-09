'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ChatSegment } from '@/types';
import type { Message } from 'ai';

interface ChatMinimapProps {
  messages: Message[];
  segments: ChatSegment[];
  scrollContainer: HTMLDivElement | null;
  onScrollTo: (index: number) => void;
}

/**
 * 对话缩略导航条（左侧横向短条）
 * - 用户消息 = 灰色横条
 * - 分段 = 紫色稍长横条
 * - 悬停显示完整用户发言（横向文字气泡）
 * - 点击跳转到对应位置
 */
export function ChatMinimap({ messages, segments, scrollContainer, onScrollTo }: ChatMinimapProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // 构建条目：只取用户消息 + 分段（useMemo 保证数据变化触发重渲染）
  const items = useMemo(() => {
    const segStarts = new Map<number, ChatSegment>();
    const segRanges = new Set<number>();
    for (const seg of segments) {
      segStarts.set(seg.startMsgIndex, seg);
      for (let i = seg.startMsgIndex; i <= seg.endMsgIndex; i++) segRanges.add(i);
    }

    const list: { type: 'msg' | 'segment'; index: number; text: string; segId?: string }[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (segStarts.has(i)) {
        const seg = segStarts.get(i)!;
        const firstUserMsg = messages.slice(seg.startMsgIndex, seg.endMsgIndex + 1)
          .find(m => m.role === 'user');
        list.push({
          type: 'segment',
          index: i,
          text: seg.name || firstUserMsg?.content?.slice(0, 80) || '分段',
          segId: seg.id,
        });
        i = seg.endMsgIndex;
      } else if (!segRanges.has(i) && messages[i].role === 'user') {
        const content = typeof messages[i].content === 'string' ? messages[i].content : '';
        list.push({ type: 'msg', index: i, text: content });
      }
    }
    return list;
  }, [messages, segments]);

  // 监听滚动高亮
  useEffect(() => {
    if (!scrollContainer) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const ratio = scrollTop / Math.max(1, scrollHeight - clientHeight);
      const idx = Math.round(ratio * (items.length - 1));
      setActiveIndex(Math.max(0, Math.min(idx, items.length - 1)));
    };
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollContainer, items]);

  const handleClick = useCallback((item: { index: number }) => {
    onScrollTo(item.index);
  }, [onScrollTo]);

  if (items.length === 0) return null;

  return (
    <div
      className="absolute left-0 top-0 bottom-0 w-[20px] flex flex-col items-center gap-[3px] py-4 z-[1] pointer-events-none"
      style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.3), transparent)' }}
    >
      {items.map((item, i) => {
        const isActive = i === activeIndex;
        const isHovered = i === hoveredIdx;
        const isSeg = item.type === 'segment';

        return (
          <div
            key={isSeg ? `seg-${item.segId}` : `msg-${item.index}`}
            className="relative flex items-center justify-center w-full pointer-events-auto"
            style={{ height: isSeg ? '10px' : '8px' }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => handleClick(item)}
          >
            {/* 可见的横条 */}
            <div
              className="rounded-[1px] transition-all duration-150 cursor-pointer"
              style={{
                width: isSeg ? '12px' : '8px',
                height: isSeg ? '4px' : '2px',
                backgroundColor: isSeg
                  ? (isActive ? 'var(--accent)' : 'rgba(139, 92, 246, 0.7)')
                  : (isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)'),
                boxShadow: isActive
                  ? (isSeg ? '0 0 4px var(--accent)' : '0 0 3px rgba(255,255,255,0.4)')
                  : isHovered
                    ? (isSeg ? '0 0 3px rgba(139,92,246,0.5)' : '0 0 2px rgba(255,255,255,0.3)')
                    : 'none',
                transform: isHovered ? 'scaleX(1.4) scaleY(1.5)' : 'none',
              }}
            />

            {/* 悬停提示气泡 — 固定宽度，横向文字 */}
            {isHovered && (
              <div
                className="absolute left-[24px] top-1/2 -translate-y-1/2 z-[200] pointer-events-none"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-strong, var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  width: '220px',
                  minWidth: '120px',
                }}
              >
                <p
                  className="text-[11px] leading-[1.5] m-0"
                  style={{
                    color: isSeg ? 'var(--accent)' : 'var(--text-primary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}
                >
                  {isSeg && <span style={{ marginRight: '4px' }}>📌</span>}
                  {item.text || '(空消息)'}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
