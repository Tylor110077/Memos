'use client';

import { useState, useRef } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="border-t border-[var(--border)] p-3">
      <div className="flex items-end gap-2 bg-[var(--bg-tertiary)] rounded-xl px-3 py-2 border border-[var(--border)]">
        <textarea
          ref={textareaRef}
          id="chat-input"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none max-h-[120px]"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="p-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
