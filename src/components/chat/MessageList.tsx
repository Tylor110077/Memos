'use client';

import { useEffect, useRef } from 'react';
import type { Message } from 'ai';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  selectedMessages?: Set<number>;
  onSelectChange?: (index: number, checked: boolean) => void;
}

export default function MessageList({ messages, selectedMessages, onSelectChange }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
        开始一段对话吧 ✨
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
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
