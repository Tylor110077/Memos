'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { nanoid } from 'nanoid';
import { Layers } from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import { useBoardStore } from '@/stores/boardStore';
import { parseConversationToGraph } from '@/lib/graphUtils';
import { createConversation, updateConversation } from '@/lib/db';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

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
  const { nodes, applyGraphChanges, selectedNodeId } = useGraphStore();
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const { pendingMessage, setPendingMessage, resetSignal, pendingConversation, setPendingConversation } = useChatStore();
  const { currentBoardId, boards } = useBoardStore();

  const { messages, append, setMessages, status } = useChat({
    api: '/api/chat',
    body: {
      mode,
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

  // 消费外部设置的 pendingMessage（如破茧推荐"开始学习"）
  useEffect(() => {
    if (pendingMessage && visible) {
      append({ role: 'user', content: pendingMessage });
      setPendingMessage(null);
    }
  }, [pendingMessage, visible, append, setPendingMessage]);

  const isLoading = status === 'streaming' || status === 'submitted';

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

      {/* Messages */}
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
