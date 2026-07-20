'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { nanoid } from 'nanoid';
import { Sparkles, FolderTree, X, Lightbulb, Clock, Plus, Layers } from 'lucide-react';
import type { ChatMode, KnowledgeNode, KnowledgeEdge, Conversation } from '@/types';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import { useBoardStore } from '@/stores/boardStore';
import { parseConversationToGraph } from '@/lib/graphUtils';
import { createConversation, updateConversation, getAllConversations } from '@/lib/db';
import ModeSelector from './ModeSelector';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

interface RecommendationItem {
  title: string;
  description: string;
  reason: string;
}

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
  const [isParsing, setIsParsing] = useState(false);
  const [isGeneratingThemes, setIsGeneratingThemes] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set());
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<Conversation[]>([]);
  const currentConvIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { nodes, applyGraphChanges, selectedNodeId } = useGraphStore();
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const { pendingMessage, setPendingMessage, pendingContentCategory } = useChatStore();
  const { currentBoardId } = useBoardStore();

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
        const conv = await createConversation({
          nodeId: selectedNodeId || undefined,
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

  // 加载历史对话列表
  const loadHistory = useCallback(async () => {
    const convs = await getAllConversations();
    setHistoryList(convs);
  }, []);

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

  // 消费外部设置的 pendingMessage（如破茧推荐“开始学习”）
  useEffect(() => {
    if (pendingMessage && visible) {
      append({ role: 'user', content: pendingMessage });
      setPendingMessage(null);
    }
  }, [pendingMessage, visible, append, setPendingMessage]);

  const isLoading = status === 'streaming' || status === 'submitted';

  // 生成节点后调用推荐
  const fetchRecommendations = useCallback(async (updatedNodes: KnowledgeNode[]) => {
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentNode: { title: currentNodeTitle || updatedNodes[0]?.title || '', content: '' },
          graph: { nodes: updatedNodes.map(n => ({ title: n.title, type: n.type, level: n.level })), edges: [] },
          type: 'related',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('推荐获取失败:', error);
    }
  }, [currentNodeTitle]);

  // 对话结束后触发图谱解析，生成知识节点
  const handleParseGraph = useCallback(async () => {
    if (messages.length < 2) return; // 至少有一问一答
    setIsParsing(true);
    try {
      const conversationMessages = messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : '',
      }));
      const changes = await parseConversationToGraph(conversationMessages, nodes, currentBoardId!);
      if (changes && (changes.newNodes.length > 0 || changes.updatedNodes.length > 0)) {
        // 如果来自趣闻推荐，给新节点标记 contentCategory
        if (pendingContentCategory) {
          changes.newNodes = changes.newNodes.map((n) => ({
            ...n,
            contentCategory: pendingContentCategory,
          }));
        }
        applyGraphChanges(changes);
        // 生成节点后自动获取推荐
        const allNodes = [...nodes, ...changes.newNodes];
        fetchRecommendations(allNodes);
      }
    } catch (error) {
      console.error('图谱解析失败:', error);
    } finally {
      setIsParsing(false);
    }
  }, [messages, nodes, applyGraphChanges, fetchRecommendations, pendingContentCategory]);

  // 归纳主题
  const handleGenerateThemes = useCallback(async () => {
    setIsGeneratingThemes(true);
    try {
      const res = await fetch('/api/graph/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.themes && data.themes.length > 0) {
          const newNodes: KnowledgeNode[] = [];
          const newEdges: KnowledgeEdge[] = [];
          for (const theme of data.themes) {
            const themeNode: KnowledgeNode = {
              id: nanoid(),
              boardId: currentBoardId!,
              type: 'theme',
              title: theme.title,
              content: theme.content,
              level: 1,
              status: 'lit',
              position: { x: Math.random() * 400 - 200, y: Math.random() * 400 - 200 },
              metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            };
            newNodes.push(themeNode);
            // 连接子节点
            for (const childTitle of theme.childNodeTitles) {
              const childNode = nodes.find(n => n.title === childTitle);
              if (childNode) {
                newEdges.push({
                  id: nanoid(),
                  boardId: currentBoardId!,
                  source: themeNode.id,
                  target: childNode.id,
                  relation: '包含',
                  type: 'hierarchy',
                  autoGenerated: true,
                });
              }
            }
          }
          applyGraphChanges({ newNodes, updatedNodes: [], newEdges });
        }
      }
    } catch (error) {
      console.error('主题归纳失败:', error);
    } finally {
      setIsGeneratingThemes(false);
    }
  }, [nodes, applyGraphChanges]);

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
          {/* 生成节点按钮 */}
          {messages.length >= 2 && (
            <button
              onClick={handleParseGraph}
              disabled={isParsing || isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-hover)]/25 disabled:opacity-50 transition-colors"
              title="将对话内容生成知识节点"
            >
              <Sparkles size={14} />
              {isParsing ? '解析中...' : '生成节点'}
            </button>
          )}
          {/* 归纳主题按钮 */}
          {nodes.length >= 3 && (
            <button
              onClick={handleGenerateThemes}
              disabled={isGeneratingThemes || isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-hover)]/25 disabled:opacity-50 transition-colors"
              title="将相关概念节点归纳为主题"
            >
              <FolderTree size={14} />
              {isGeneratingThemes ? '归纳中...' : '归纳主题'}
            </button>
          )}
        </div>
      </div>

      {/* 历史对话下拉面板 */}
      {showHistory && (
        <div className="absolute top-14 left-3 right-3 z-50 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-xl shadow-black/40 max-h-72 overflow-y-auto">
          <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)]">历史对话</span>
            <button onClick={() => setShowHistory(false)} className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={14} />
            </button>
          </div>
          {historyList.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">暂无历史对话</p>
          ) : (
            <div className="py-1">
              {historyList.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${modeConfig[conv.mode].color} text-white`}>
                      {modeConfig[conv.mode].label}
                    </span>
                    <span className="text-xs text-[var(--text-primary)] truncate flex-1">
                      {conv.messages[0]?.content?.slice(0, 30) || '新对话'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
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

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--accent-soft)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--accent)]">
              <Lightbulb size={13} />
              延伸推荐
            </span>
            <button
              onClick={() => setRecommendations([])}
              className="p-0.5 rounded text-[var(--accent)] hover:text-[var(--accent-hover)] hover:bg-[var(--accent-soft)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {recommendations.map((rec, idx) => (
              <button
                key={idx}
                onClick={() => {
                  append({ role: 'user', content: `我想了解：${rec.title}` });
                  setRecommendations([]);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm transition-all"
              >
                <p className="text-xs font-medium text-[var(--text-primary)]">{rec.title}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">{rec.reason}</p>
              </button>
            ))}
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
