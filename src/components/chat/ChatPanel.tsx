'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { nanoid } from 'nanoid';
import { Layers, ChevronDown, Highlighter } from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import { useBoardStore } from '@/stores/boardStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { parseConversationToGraph } from '@/lib/graphUtils';
import { createConversation, updateConversation } from '@/lib/db';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { ResponseStyle } from '@/types';

// 回答风格选项（与 AI 助手一致）
const STYLE_OPTIONS: { value: ResponseStyle; label: string }[] = [
  { value: 'default', label: '初始' },
  { value: 'balanced', label: '适中' },
  { value: 'concise', label: '精简' },
  { value: 'custom', label: '自定义' },
];

interface ChatPanelProps {
  visible: boolean;
  onClose: () => void;
  currentNodeTitle?: string;
}

export default function ChatPanel({ visible, onClose, currentNodeTitle }: ChatPanelProps) {
  const mode = 'learn' as const;
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set());
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const currentConvIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConsumedRef = useRef<string | null>(null); // 防止 pendingMessage 被重复消费（发送两遍）
  const { nodes, applyGraphChanges, selectedNodeId, addNoteToNode } = useGraphStore();
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const { pendingMessage, setPendingMessage, resetSignal, pendingConversation, setPendingConversation } = useChatStore();
  const { currentBoardId, boards } = useBoardStore();
  const { responseStyle, setResponseStyle, customStyle, apiKey } = useSettingsStore();
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  const { messages, append, setMessages, status } = useChat({
    api: '/api/chat',
    body: {
      mode,
      style: responseStyle,
      customStyleText: responseStyle === 'custom' ? customStyle : undefined,
      apiKey: apiKey || undefined,
      context: {
        currentNodeTitle: selectedNode?.title || currentNodeTitle,
        selectedNode: selectedNode ? { title: selectedNode.title, content: selectedNode.content } : undefined,
      },
    },
  });

  // 对话持久化：messages 变化时 debounce 1秒后保存
  useEffect(() => {
    if (messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const now = new Date().toISOString();
      const chatMessages = messages.map((m) => ({
        id: m.id || nanoid(),
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: now,
      }));
      if (currentConvIdRef.current) {
        await updateConversation(currentConvIdRef.current, { messages: chatMessages, updatedAt: now });
      } else {
        const currentBoardName = boards.find(b => b.id === currentBoardId)?.name;
        const conv = await createConversation({
          nodeId: selectedNodeId || undefined,
          boardId: currentBoardId || undefined,
          boardName: currentBoardName,
          mode,
          messages: chatMessages,
          createdAt: now,
          updatedAt: now,
        });
        currentConvIdRef.current = conv.id;
      }
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, mode, selectedNodeId]);

  // 监听 resetSignal：清空消息，开始新对话
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    currentConvIdRef.current = null;
    setMessages([]);
    setSelectedMessages(new Set());
  }, [resetSignal, setMessages]);

  // 监听 pendingConversation：加载历史对话
  useEffect(() => {
    if (pendingConversation) {
      currentConvIdRef.current = pendingConversation.id;
      setMessages(pendingConversation.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
      setPendingConversation(null);
    }
  }, [pendingConversation, setMessages, setPendingConversation]);

  // 消费外部设置的 pendingMessage（如推荐"学习"/破茧"开始学习"）
  // 用 ref 做幂等保护：同一条消息只发送一次，避免 effect 重复执行导致发两遍
  useEffect(() => {
    if (!pendingMessage) {
      pendingConsumedRef.current = null;
      return;
    }
    if (visible && pendingConsumedRef.current !== pendingMessage) {
      pendingConsumedRef.current = pendingMessage;
      append({ role: 'user', content: pendingMessage });
      setPendingMessage(null);
    }
  }, [pendingMessage, visible, append, setPendingMessage]);

  const isLoading = status === 'streaming' || status === 'submitted';

  // 圈选模式：监听 mouseup 获取选区
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!selectionMode) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;
    const text = selection.toString().trim();
    if (messageListRef.current && selection.anchorNode && messageListRef.current.contains(selection.anchorNode)) {
      setSelectionPopup({ text, x: e.clientX, y: e.clientY });
    }
  };

  const handleAddSelectionToNote = () => {
    if (!selectionPopup || !selectedNodeId) return;
    addNoteToNode(selectedNodeId, selectionPopup.text, 'chat');
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  };

  // 续写：将选中文字追加到当前节点最后一条笔记末尾
  const handleAppendSelectionToNote = () => {
    if (!selectionPopup || !selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    const notes = node.notes || [];
    if (notes.length === 0) {
      // 无笔记时创建新笔记
      addNoteToNode(selectedNodeId, selectionPopup.text, 'manual');
    } else {
      // 追加到最后一条笔记末尾
      const lastNote = notes[notes.length - 1];
      const updatedNotes = notes.map(n =>
        n.id === lastNote.id ? { ...n, content: n.content + '\n' + selectionPopup.text } : n
      );
      useGraphStore.getState().updateNode(selectedNodeId, { notes: updatedNotes });
    }
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* 上下文提示条 */}
      {selectedNode && (
        <div className="px-4 py-1.5 bg-[var(--accent-soft)] border-b border-[var(--accent)]/20 flex items-center gap-2">
          <span className="text-[10px] text-[var(--accent)]">当前上下文</span>
          <span className="text-xs text-[var(--accent)] truncate">{selectedNode.title}</span>
        </div>
      )}

      {/* 批量操作栏 */}
      {selectedMessages.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--accent-soft)] border-b border-[var(--accent)]/20">
          <span className="text-xs text-[var(--accent)]">已选 {selectedMessages.size} 条</span>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setIsBatchGenerating(true);
                try {
                  const selectedContent = messages
                    .filter((_, idx) => selectedMessages.has(idx))
                    .map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }));
                  const changes = await parseConversationToGraph(selectedContent, nodes, currentBoardId!);
                  if (changes && changes.newNodes.length > 0) {
                    applyGraphChanges(changes);
                  }
                  setSelectedMessages(new Set());
                } catch (e) {
                  console.error('批量生成节点失败:', e);
                } finally {
                  setIsBatchGenerating(false);
                }
              }}
              disabled={isBatchGenerating}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-hover)]/30 disabled:opacity-50 transition-colors"
            >
              <Layers size={13} />
              {isBatchGenerating ? '生成中...' : '生成选中节点'}
            </button>
            <button
              onClick={() => setSelectedMessages(new Set())}
              className="px-2 py-1 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* 回答风格选择器 + 圈选开关（圈选仅在选中节点时显示） */}
      <div className="relative px-4 pt-2 flex justify-end items-center gap-2">
        {selectedNode && (
          <button
            onClick={() => { setSelectionMode(v => !v); setSelectionPopup(null); }}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors ${
              selectionMode
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
            }`}
            title="圈选文字加入笔记"
          >
            <Highlighter size={12} />
            圈选
          </button>
        )}
        <button
          onClick={() => setStyleDropdownOpen(open => !open)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
          title="回答风格"
        >
          {STYLE_OPTIONS.find(s => s.value === responseStyle)?.label || '适中'}
          <ChevronDown size={12} className={`transition-transform duration-200 ${styleDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {styleDropdownOpen && (
          <div className="absolute right-4 top-full mt-1 w-32 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl z-50"
            style={{ animation: 'fadeIn 120ms ease-out' }}>
            {STYLE_OPTIONS.map(style => (
              <button
                key={style.value}
                onClick={() => { setResponseStyle(style.value); setStyleDropdownOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                  responseStyle === style.value
                    ? 'text-[var(--text-primary)] bg-[var(--bg-hover)] font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {style.label}
                {responseStyle === style.value && <span className="text-[var(--accent)]">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messageListRef} onMouseUp={handleMouseUp} className="flex-1 overflow-hidden flex flex-col">
        <MessageList
          messages={messages}
          selectedMessages={selectedMessages}
          onSelectChange={(index, checked) => {
            setSelectedMessages((prev) => {
              const next = new Set(prev);
              if (checked) {
                next.add(index);
              } else {
                next.delete(index);
              }
              return next;
            });
          }}
        />
      </div>

      {/* 圈选确认浮层 */}
      {selectionPopup && (
        <div
          className="fixed z-[999] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl"
          style={{ left: Math.min(selectionPopup.x, window.innerWidth - 220), top: selectionPopup.y + 8 }}
        >
          <p className="text-[11px] text-[var(--text-secondary)] max-w-[200px] truncate mb-2">“{selectionPopup.text}”</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSelectionToNote}
              disabled={!selectedNodeId}
              className="px-2 py-1 text-[11px] rounded-md bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-hover)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={!selectedNodeId ? '先选中一个节点' : '加入笔记'}
            >
              加入笔记
            </button>
            <button
              onClick={handleAppendSelectionToNote}
              disabled={!selectedNodeId}
              className="px-2 py-1 text-[11px] rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={!selectedNodeId ? '先选中一个节点' : '续写到笔记末尾'}
            >
              续写 ⊕
            </button>
            <button
              onClick={() => { window.getSelection()?.removeAllRanges(); setSelectionPopup(null); }}
              className="px-2 py-1 text-[11px] rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={(message) => {
          append({ role: 'user', content: message });
        }}
        disabled={isLoading}
      />
    </div>
  );
}
