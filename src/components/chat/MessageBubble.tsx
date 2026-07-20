'use client';

import { useState } from 'react';
import type { Message } from 'ai';
import { Sparkles, Check } from 'lucide-react';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { useGraphStore } from '@/stores/graphStore';
import { useBoardStore } from '@/stores/boardStore';
import { parseConversationToGraph } from '@/lib/graphUtils';

interface MessageBubbleProps {
  message: Message;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
}

export default function MessageBubble({ message, selected = false, onSelectChange }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const { nodes, applyGraphChanges } = useGraphStore();
  const { currentBoardId } = useBoardStore();

  const handleGenerateNode = async () => {
    if (isGenerating || generated) return;
    setIsGenerating(true);
    try {
      const changes = await parseConversationToGraph(
        [{ role: 'assistant', content: typeof message.content === 'string' ? message.content : '' }],
        nodes,
        currentBoardId!
      );
      if (changes && changes.newNodes.length > 0) {
        applyGraphChanges(changes);
        setGenerated(true);
      }
    } catch (e) {
      console.error('生成节点失败:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div className="relative max-w-[85%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-[var(--accent)]/80 text-white rounded-br-md'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-md'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
        {/* 操作区：多选 + 生成节点 */}
        {!isUser && (
          <div className="flex items-center justify-between mt-1.5 px-1">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelectChange?.(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-purple-500 cursor-pointer"
              />
              <span className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">选择</span>
            </label>
            <button
              onClick={handleGenerateNode}
              disabled={isGenerating || generated}
              className={`flex items-center gap-1 text-xs transition-colors ${
                generated
                  ? 'text-green-400'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'
              }`}
              title={generated ? '已生成节点' : '从此回复生成知识节点'}
            >
              {generated ? <Check size={13} /> : <Sparkles size={13} />}
              {generated ? '已生成' : '生成节点'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
