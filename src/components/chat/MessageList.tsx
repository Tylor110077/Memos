'use client';

import { useEffect, useRef } from 'react';
import type { Message } from 'ai';
import MessageBubble from './MessageBubble';
import { Logo } from '@/components/Logo';

interface MessageListProps {
  messages: Message[];
  selectedMessages?: Set<number>;
  onSelectChange?: (index: number, checked: boolean) => void;
  onEditMessage?: (id: string, newContent: string) => void;
}

export default function MessageList({ messages, selectedMessages, onSelectChange, onEditMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {/* 品牌 Logo */}
        <Logo size={72} className="rounded-2xl shadow-lg shadow-black/30" />
        {/* 品牌字 */}
        <h1
          className="text-4xl font-semibold italic tracking-[0.06em] bg-gradient-to-r from-[var(--accent)] to-[var(--text-primary)] bg-clip-text text-transparent"
          style={{ fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif' }}
        >
          Memos
        </h1>
        {/* 点缀 */}
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span className="w-8 h-px bg-[var(--border)]" />
          <span className="text-xs">开始一段探索</span>
          <span className="w-8 h-px bg-[var(--border)]" />
        </div>
        {/* 模式提示 */}
        <p className="text-xs text-[var(--text-muted)] mt-2 tracking-wider">让每一次好奇，都长成知识的形状</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          selected={selectedMessages?.has(index) ?? false}
          onSelectChange={(checked) => onSelectChange?.(index, checked)}
          onEditMessage={onEditMessage}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
