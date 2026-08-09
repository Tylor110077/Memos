'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { nanoid } from 'nanoid';
import { Layers, ChevronDown, Highlighter, Globe } from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import { useBoardStore } from '@/stores/boardStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { parseConversationToGraph } from '@/lib/graphUtils';
import { buildNodeMedia } from '@/lib/multimodal';
import { apiFetch } from '@/lib/directApi';
import { createConversation, updateConversation } from '@/lib/db';
import { SelectionPopup } from '@/components/shared/SelectionPopup';
import { SegmentNameModal } from './SegmentNameModal';
import { ChatMinimap } from './ChatMinimap';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { ResponseStyle, ChatSegment } from '@/types';

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
  const { nodes, edges, applyGraphChanges, selectedNodeId, addNoteToNode } = useGraphStore();
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const { pendingMessage, setPendingMessage, resetSignal, pendingConversation, setPendingConversation, setSegments } = useChatStore();
  const { currentBoardId, boards } = useBoardStore();
  const { responseStyle, setResponseStyle, customStyle, apiKey, defaultSelectionOpen } = useSettingsStore();
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(defaultSelectionOpen);
  const [webSearch, setWebSearch] = useState(true);
  const [webSearchStatus, setWebSearchStatus] = useState<'searching' | { sources: number } | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  // 选中节点的媒体上下文（图片/视频帧），供对话多模态理解
  const [nodeMedia, setNodeMedia] = useState<{ kind: 'image' | 'video'; dataUrls: string[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!selectedNode) { setNodeMedia(null); return; }
    buildNodeMedia(selectedNode).then(m => { if (!cancelled) setNodeMedia(m); }).catch(() => setNodeMedia(null));
    return () => { cancelled = true; };
  }, [selectedNode?.id]);

  // ===== 对话分段 =====
  const { segments, addSegment, updateSegment, removeSegment } = useChatStore();
  const [markStartIndex, setMarkStartIndex] = useState<number | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingEndIndex, setPendingEndIndex] = useState<number | null>(null);
  const [generatingSegment, setGeneratingSegment] = useState<string | null>(null);

  const handleMarkStart = (index: number) => { setMarkStartIndex(index); };
  const handleMarkEnd = (index: number) => { setPendingEndIndex(index); setShowNameModal(true); };
  const handleCancelMark = () => { setMarkStartIndex(null); setShowNameModal(false); setPendingEndIndex(null); };
  const handleConfirmSegment = (name: string) => {
    if (markStartIndex === null || pendingEndIndex === null) return;
    const seg: ChatSegment = {
      id: nanoid(),
      name,
      startMsgIndex: markStartIndex,
      endMsgIndex: pendingEndIndex,
      collapsed: false,
      createdAt: new Date().toISOString(),
    };
    addSegment(seg);
    setMarkStartIndex(null);
    setShowNameModal(false);
    setPendingEndIndex(null);
  };
  const handleToggleSegment = (id: string) => {
    const seg = segments.find(s => s.id === id);
    if (seg) updateSegment(id, { collapsed: !seg.collapsed });
  };
  const handleSelectSegment = (seg: ChatSegment) => {
    const indices = new Set<number>();
    for (let i = seg.startMsgIndex; i <= seg.endMsgIndex; i++) indices.add(i);
    setSelectedMessages(indices);
  };
  const handleDeselectSegment = (seg: ChatSegment) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      for (let i = seg.startMsgIndex; i <= seg.endMsgIndex; i++) next.delete(i);
      return next;
    });
  };
  const isSegmentSelected = (seg: ChatSegment): boolean => {
    for (let i = seg.startMsgIndex; i <= seg.endMsgIndex; i++) {
      if (!selectedMessages.has(i)) return false;
    }
    return true;
  };
  const handleGenerateSegment = async (seg: ChatSegment) => {
    if (!currentBoardId || generatingSegment) return;
    setGeneratingSegment(seg.id);
    try {
      const segMessages = messages.slice(seg.startMsgIndex, seg.endMsgIndex + 1)
        .map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }));
      // 直接调用归纳 API 生成新节点（而非仅建边）
      const res = await apiFetch('/api/graph/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: segMessages,
          existingNodes: nodes.map(n => ({ id: n.id, title: n.title })),
          apiKey: apiKey || undefined,
        }),
      });
      if (res.ok) {
        const parseResult = await res.json();
        // 使用 buildGraphChanges 但强制允许新节点
        const { buildGraphChanges } = await import('@/lib/graphUtils');
        const changes = buildGraphChanges(parseResult, nodes, currentBoardId, edges, true);
        if (changes && (changes.newNodes.length > 0 || changes.newEdges.length > 0)) {
          applyGraphChanges(changes);
        }
      }
    } catch (e) { console.error('分段生成节点失败:', e); }
    finally { setGeneratingSegment(null); }
  };
  const handleRenameSegment = (id: string, name: string) => { updateSegment(id, { name }); };
  const handleRemoveSegment = (id: string) => { removeSegment(id); };

  const { messages, append, setMessages, status, data } = useChat({
    api: '/api/chat',
    fetch: apiFetch,
    body: {
      mode,
      style: responseStyle,
      customStyleText: responseStyle === 'custom' ? customStyle : undefined,
      apiKey: apiKey || undefined,
      webSearch,
      context: {
        currentNodeTitle: selectedNode?.title || currentNodeTitle,
        selectedNode: selectedNode ? { title: selectedNode.title, content: selectedNode.content, summary: selectedNode.summary } : undefined,
        media: nodeMedia || undefined,
      },
    },
  });

  // 监听联网搜索数据事件
  useEffect(() => {
    if (!data || data.length === 0) return;
    const lastData = data[data.length - 1] as any;
    if (lastData?.type === 'web-search') {
      if (lastData.status === 'searching') {
        setWebSearchStatus('searching');
      } else if (lastData.status === 'done') {
        setWebSearchStatus({ sources: lastData.sources || 0 });
      }
    }
  }, [data]);

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
        await updateConversation(currentConvIdRef.current, { messages: chatMessages, segments: useChatStore.getState().segments, updatedAt: now });
      } else {
        const currentBoardName = boards.find(b => b.id === currentBoardId)?.name;
        const conv = await createConversation({
          nodeId: selectedNodeId || undefined,
          boardId: currentBoardId || undefined,
          boardName: currentBoardName,
          mode,
          messages: chatMessages,
          segments: useChatStore.getState().segments,
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

  // 分段变更时也持久化
  useEffect(() => {
    if (!currentConvIdRef.current || segments.length === 0) return;
    updateConversation(currentConvIdRef.current, { segments }).catch(() => {});
  }, [segments]);

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
      setSegments(pendingConversation.segments || []);
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

  // 续写：将选中文字追加到指定笔记末尾
  const handleAppendSelectionToNote = (noteId?: string) => {
    if (!selectionPopup || !selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    const noteList = node.notes || [];
    if (noteList.length === 0) {
      addNoteToNode(selectedNodeId, selectionPopup.text, 'manual');
    } else {
      const targetId = noteId || noteList[noteList.length - 1].id;
      const updatedNotes = noteList.map(n =>
        n.id === targetId ? { ...n, content: (n.content ? n.content + '\n\n' : '') + selectionPopup.text } : n
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
                  const changes = await parseConversationToGraph(selectedContent, nodes, currentBoardId!, edges, true);
                  if (changes && (changes.newNodes.length > 0 || changes.newEdges.length > 0 || changes.updatedNodes.length > 0)) {
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

      {/* 回答风格选择器 + 圈选开关 + 联网搜索开关 */}
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
          onClick={() => setWebSearch(v => !v)}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors ${
            webSearch
              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
          }`}
          title="联网搜索"
        >
          <Globe size={12} />
          联网
        </button>
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
      <div ref={messageListRef} onMouseUp={handleMouseUp} className="flex-1 overflow-hidden flex flex-col relative">
        <MessageList
          messages={messages}
          selectedMessages={selectedMessages}
          webSearchStatus={webSearchStatus}
          segments={segments}
          markStartIndex={markStartIndex}
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
          onEditMessage={(id, newContent) => {
            const idx = messages.findIndex(m => m.id === id);
            if (idx < 0) return;
            const truncated = messages.slice(0, idx);
            setMessages([...truncated, { ...messages[idx], content: newContent }]);
            setTimeout(() => append({ role: 'user', content: newContent }), 50);
          }}
          onMarkStart={handleMarkStart}
          onMarkEnd={handleMarkEnd}
          onToggleSegment={handleToggleSegment}
          onSelectSegment={handleSelectSegment}
          onDeselectSegment={handleDeselectSegment}
          onGenerateSegment={handleGenerateSegment}
          onRenameSegment={handleRenameSegment}
          onRemoveSegment={handleRemoveSegment}
          generatingSegment={generatingSegment}
          isSegmentSelected={isSegmentSelected}
          scrollRef={scrollContainerRef}
          onScrollReady={(el) => setScrollEl(el)}
        />
        {/* 左侧缩略导航条 */}
        <ChatMinimap
          messages={messages}
          segments={segments}
          scrollContainer={scrollEl}
          onScrollTo={(index) => {
            const container = scrollContainerRef.current;
            if (!container) return;
            // 找到第 index 个消息元素并滚动到它
            const msgElements = container.querySelectorAll('[data-msg-index]');
            const target = Array.from(msgElements).find(el => el.getAttribute('data-msg-index') === String(index));
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
        />
      </div>

      {/* 圈选确认浮层 */}
      {selectionPopup && (
        <SelectionPopup
          text={selectionPopup.text}
          initialX={selectionPopup.x}
          initialY={selectionPopup.y}
          onClose={() => { window.getSelection()?.removeAllRanges(); setSelectionPopup(null); }}
          onAddToNote={handleAddSelectionToNote}
          onAppendToNote={handleAppendSelectionToNote}
          notes={selectedNodeId ? (nodes.find(n => n.id === selectedNodeId)?.notes || []).map(n => ({ id: n.id, content: n.content })) : []}
          onCreateNode={() => {
            if (!selectionPopup || !currentBoardId) return;
            const text = selectionPopup.text.trim();
            if (!text) return;
            const now = new Date().toISOString();
            useGraphStore.getState().addNode({
              id: `node-${nanoid(8)}`,
              boardId: currentBoardId,
              type: 'understanding',
              title: text.length > 24 ? text.slice(0, 24) + '…' : text,
              content: text,
              level: 3,
              status: 'lit',
              position: { x: Math.random() * 300 - 150, y: Math.random() * 300 - 150 },
              metadata: { createdAt: now, updatedAt: now },
            });
            window.getSelection()?.removeAllRanges();
            setSelectionPopup(null);
          }}
          noteDisabled={!selectedNodeId}
          noteDisabledHint="先选中一个节点"
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={(message) => {
          if (webSearch) setWebSearchStatus('searching');
          append({ role: 'user', content: message });
        }}
        disabled={isLoading}
      />

      {/* 分段命名弹窗 */}
      <SegmentNameModal
        visible={showNameModal}
        messages={markStartIndex !== null && pendingEndIndex !== null
          ? messages.slice(markStartIndex, pendingEndIndex + 1).map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))
          : []}
        onConfirm={handleConfirmSegment}
        onCancel={handleCancelMark}
      />
    </div>
  );
}
