'use client';

import { useState } from 'react';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';

interface MarkdownEditorProps {
  /** 初始 Markdown 内容 */
  content: string;
  /** 内容变更回调 */
  onChange: (content: string) => void;
}

/** Markdown 编辑器：左右分栏，左侧编辑右侧预览 */
export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const [text, setText] = useState(content);
  const [mode, setMode] = useState<'split' | 'edit' | 'preview'>('split');

  const handleChange = (value: string) => {
    setText(value);
    onChange(value);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border)]">
        {(['split', 'edit', 'preview'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
              mode === m
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {m === 'split' ? '分栏' : m === 'edit' ? '编辑' : '预览'}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {(mode === 'split' || mode === 'edit') && (
          <textarea
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            className={`flex-1 p-4 text-sm font-mono bg-transparent text-[var(--text-primary)] resize-none focus:outline-none placeholder:text-[var(--text-muted)] ${
              mode === 'split' ? 'border-r border-[var(--border)]' : ''
            }`}
            placeholder="输入 Markdown 内容…"
          />
        )}
        {(mode === 'split' || mode === 'preview') && (
          <div className="flex-1 overflow-y-auto p-4">
            <MarkdownRenderer content={text || '*暂无内容*'} className="text-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
