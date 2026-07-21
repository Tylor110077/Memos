'use client';

import { useState } from 'react';
import type { Message } from 'ai';
import { Sparkles, Check, Loader2, StickyNote } from 'lucide-react';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { useGraphStore } from '@/stores/graphStore';
import { useBoardStore } from '@/stores/boardStore';
import { parseConversationToGraph } from '@/lib/graphUtils';
import { nanoid } from 'nanoid';

interface MessageBubbleProps {
  message: Message;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
}

export default function MessageBubble({ message, selected = false, onSelectChange }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [noteAdded, setNoteAdded] = useState(false);
  const { nodes, applyGraphChanges, addNode, addNoteToNode, selectedNodeId } = useGraphStore();
  const { currentBoardId } = useBoardStore();

  // 用户消息：直接将自己的话作为"理解"节点加入图谱
  const handleGenerateFromUser = () => {
    if (isGenerating || generated || !currentBoardId) return;
    const content = typeof message.content === 'string' ? message.content.trim() : '';
    if (!content) return;
    const now = new Date().toISOString();
    addNode({
      id: `node-${nanoid(8)}`,
      boardId: currentBoardId,
      type: 'understanding',
      title: content.length > 24 ? content.slice(0, 24) + '…' : content,
      content,
      level: 3,
      status: 'lit',
      position: { x: Math.random() * 300 - 150, y: Math.random() * 300 - 150 },
      metadata: { createdAt: now, updatedAt: now },
    });
    setGenerated(true);
  };

  // AI 消息：调用 AI 提取知识点
  const handleGenerateFromAi = async () => {
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

  const handleGenerate = isUser ? handleGenerateFromUser : handleGenerateFromAi;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div className={`relative max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
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
        {/* 操作区：悬停浮现，圆润融入背景 */}
        <div className={`flex items-center gap-2 mt-1.5 px-1 transition-opacity duration-200 ${generated ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isUser ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || generated}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all ${
              generated
                ? 'text-green-400 bg-green-400/10'
                : 'text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]'
            }`}
            title={generated ? '已加入图谱' : isUser ? '把我的话加入图谱' : '从此回复生成知识节点'}
          >
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : generated ? <Check size={12} /> : <Sparkles size={12} />}
            {generated ? '已加入' : '生成节点'}
          </button>
          <button
            onClick={() => {
              if (!selectedNodeId || noteAdded) return;
              const content = typeof message.content === 'string' ? message.content : '';
              addNoteToNode(selectedNodeId, content, isUser ? 'question' : 'chat');
              setNoteAdded(true);
            }}
            disabled={!selectedNodeId || noteAdded}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all ${
              noteAdded
                ? 'text-green-400 bg-green-400/10'
                : !selectedNodeId
                  ? 'text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                  : 'text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]'
            }`}
            title={noteAdded ? '已加入笔记' : !selectedNodeId ? '先选中一个节点' : '加入节点笔记'}
          >
            {noteAdded ? <Check size={12} /> : <StickyNote size={12} />}
            {noteAdded ? '已加入' : '加入笔记'}
          </button>
          <label className="flex items-center gap-1 cursor-pointer select-none px-1 py-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelectChange?.(e.target.checked)}
              className="w-3.5 h-3.5 rounded-full accent-[var(--accent)] cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
            />
            <span className="text-[10px] text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity">选择</span>
          </label>
        </div>
      </div>
    </div>
  );
}
