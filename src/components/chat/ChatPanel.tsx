'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { nanoid } from 'nanoid';
import { Clock, Plus, Layers } from 'lucide-react';
import type { ChatMode, Conversation } from '@/types';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import { useBoardStore } from '@/stores/boardStore';
import { parseConversationToGraph } from '@/lib/graphUtils';
import { createConversation, updateConversation, getConversationsByBoard } from '@/lib/db';
import ModeSelector from './ModeSelector';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

interface ChatPanelProps {
  visible: boolean;
  onClose: () => void;
  currentNodeTitle?: string;
}

const modeConfig: Record<ChatMode, { label: string; color: string; desc: string }> = {
  learn: { label: '学习', color: 'bg-blue-500', desc: '向 AI 提问，学习新知识' },
  feynman: { label: '费曼', color: 'bg-green-500', desc: '向 AI 讲解你的理解，它来追问' },
  debate: { label: '辩论', color: 'bg-red-500', desc: '为观点辩护，AI 来质疑' },
  design: { label: '设计', color: 'bg-purple-500', desc: '用知识做设计，AI 来引导' },
};

export default function ChatPanel({ visible, onClose, currentNodeTitle }: ChatPanelProps) {
  const [mode, setMode] = useState<ChatMode>('learn');
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set());
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<Conversation[]>([]);
  const currentConvIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { nodes, applyGraphChanges, selectedNodeId } = useGraphStore();
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const { pendingMessage, setPendingMessage } = useChatStore();
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

  // 加载历史对话列表（按当前画板过滤）
  const loadHistory = useCallback(async () => {
    if (!currentBoardId) {
      setHistoryList([]);
      return;
    }
    const convs = await getConversationsByBoard(currentBoardId);
    setHistoryList(convs);
  }, [currentBoardId]);

  // 切换历史面板
  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => {
      if (!prev) loadHistory();
      return !prev;
    });
  }, [loadHistory]);

  // 加载某条历史对话
  const loadConversation = useCallback((conv: Conversation) => {
    currentConvIdRef.current = conv.id;
    setMode(conv.mode);
    setMessages(conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    setShowHistory(false);
  }, [setMessages]);

  // 新建对话
  const startNewConversation = useCallback(() => {
    currentConvIdRef.current = null;
    setMessages([]);
    setShowHistory(false);
  }, [setMessages]);

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI 对话</h2>
        <div className="flex items-center gap-1">
          {/* 历史记录按钮 */}
          <button
            onClick={toggleHistory}
            className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
            title="历史对话"
          >
            <Clock size={16} />
          </button>
          {/* 新建对话按钮 */}
          <button
            onClick={startNewConversation}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="新建对话"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 历史对话列表（sidebar 内联展开） */}
      {showHistory && (
        <div className="border-b border-[var(--border)] bg-[var(--bg-primary)] max-h-[200px] overflow-y-auto">
          {historyList.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">暂无历史对话</p>
          ) : (
            <div className="py-1">
              {historyList.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${modeConfig[conv.mode].color} text-white`}>
                      {modeConfig[conv.mode].label}
                    </span>
                    <span className="text-xs text-[var(--text-primary)] truncate flex-1">
                      {conv.boardName ? `【${conv.boardName}】` : ''}{conv.messages[0]?.content?.slice(0, 24) || '新对话'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5 pl-0.5">
                    {new Date(conv.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode Color Bar */}
      <div className={`h-1 w-full ${modeConfig[mode].color} transition-colors duration-300`} />
      <div className="px-4 py-1.5 bg-[var(--bg-primary)] border-b border-[var(--border)]">
        <p className="text-xs text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{modeConfig[mode].label}模式</span>
          {' · '}{modeConfig[mode].desc}
        </p>
      </div>

      {/* 上下文提示条 */}
      {selectedNode && (
        <div className="px-4 py-1.5 bg-[var(--accent-soft)] border-b border-[var(--accent)]/20 flex items-center gap-2">
          <span className="text-[10px] text-[var(--accent)]">当前上下文</span>
          <span className="text-xs text-[var(--accent)] truncate">{selectedNode.title}</span>
        </div>
      )}

      {/* Mode Selector */}
      <div className="px-3 pt-3">
        <ModeSelector currentMode={mode} onModeChange={setMode} />
      </div>

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
