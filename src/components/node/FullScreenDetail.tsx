'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, FileText, Loader2, Sparkles, MessageSquare, Send, ChevronDown, Split, Trash2, StickyNote, PenLine, Highlighter, Plus, Clock, Globe, Download, ScanEye } from 'lucide-react';
import { nanoid } from 'nanoid';
import dynamic from 'next/dynamic';
import { useUIStore } from '@/stores/uiStore';
import { useGraphStore } from '@/stores/graphStore';
import { useBoardStore } from '@/stores/boardStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { SelectionPopup } from '@/components/shared/SelectionPopup';
import { CognitionRing } from '@/components/cognition/CognitionRing';
import { detectFileType } from '@/lib/fileUtils';
import { apiFetch } from '@/lib/directApi';
import { extractVideoFrames, understandContent } from '@/lib/multimodal';
import { DocxPreview } from '@/components/file-preview/DocxPreview';
import { XlsxPreview } from '@/components/file-preview/XlsxPreview';
import { PptxPreview } from '@/components/file-preview/PptxPreview';
import { MarkdownEditor } from '@/components/file-preview/MarkdownEditor';
import { PipWindow } from '@/components/pip/PipWindow';
import { createConversation, updateConversation } from '@/lib/db';
import type { ChatMessage, ChatMode, ResponseStyle, NoteKind, KnowledgeNode, KnowledgeEdge, NodeType } from '@/types';

// ===== AI 模式配置 =====
const AI_MODES: { value: ChatMode; label: string; color: string }[] = [
  { value: 'learn', label: '学习', color: '#3b82f6' },
  { value: 'feynman', label: '费曼', color: '#22c55e' },
  { value: 'debate', label: '辩论', color: '#ef4444' },
  { value: 'design', label: '设计', color: '#a855f7' },
];

// ===== 回答风格配置 =====
const AI_STYLES: { value: ResponseStyle; label: string; hint: string }[] = [
  { value: 'default', label: '初始', hint: '自然标准的回答' },
  { value: 'balanced', label: '适中', hint: '兼顾完整与简洁' },
  { value: 'concise', label: '精简', hint: '只给要点，无废话无表情' },
  { value: 'custom', label: '自定义', hint: '用你自己的话定义风格' },
];

// ===== 笔记 kind 配置 =====
const NOTE_KINDS: Record<NoteKind, { label: string; className: string }> = {
  manual: { label: '手动', className: 'bg-blue-500/20 text-blue-400' },
  chat: { label: '对话摘录', className: 'bg-purple-500/20 text-purple-400' },
  question: { label: '我的提问', className: 'bg-amber-500/20 text-amber-400' },
};

// 时间戳格式化为 MM-DD HH:mm
const formatNoteTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ===== 白板组件懒加载 =====
// Whiteboard 由其他成员并行开发；模块尚未创建或加载失败时降级为占位符
const WhiteboardPlaceholder = ({ text }: { text: string }) => (
  <div className="h-full flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
    <PenLine size={28} strokeWidth={1.5} />
    <p className="text-sm">{text}</p>
  </div>
);

const WhiteboardUnavailable = () => <WhiteboardPlaceholder text="白板组件暂不可用" />;

const Whiteboard = dynamic(
  () =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore 模块可能尚未创建（由其他成员负责）
    import('@/components/whiteboard/Whiteboard')
      .then((m: { Whiteboard: React.ComponentType<{ nodeId: string }> }) => m.Whiteboard)
      .catch(() => WhiteboardUnavailable),
  {
    ssr: false,
    loading: () => <WhiteboardPlaceholder text="白板加载中..." />,
  }
);

const SIDEBAR_MIN_WIDTH = 280;

export function FullScreenDetail() {
  const { fullScreenNodeId, closeFullScreen } = useUIStore();
  const { nodes, edges, updateNode, removeNode, applyGraphChanges, addNoteToNode, setEvaluating } = useGraphStore();
  const { boards } = useBoardStore();
  const { customStyle, responseStyle, setResponseStyle, apiKey, autoCognitionEval, defaultSelectionOpen } = useSettingsStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false); // 关闭动效状态

  // ===== Tab 切换（源文件 / 内容 / 白板） =====
  const [activeTab, setActiveTab] = useState<'source' | 'content' | 'whiteboard'>('content');
  const [sourceMode, setSourceMode] = useState<'raw' | 'rendered'>('raw');

  // ===== 分化状态 =====
  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitInstruction, setSplitInstruction] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);

  // ===== AI 对话侧栏状态 =====
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiConvIdRef = useRef<string | null>(null);
  const aiListRef = useRef<HTMLDivElement>(null);

  // ===== T-521: AI 模式切换 =====
  const [aiMode, setAiMode] = useState<ChatMode>('learn');
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  // ===== 回答风格切换（使用全局设置） =====
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement>(null);

  // ===== AI 侧栏圈选加入笔记 =====
  const [aiSelectionMode, setAiSelectionMode] = useState(defaultSelectionOpen);
  const [aiWebSearch, setAiWebSearch] = useState(true);
  const [aiSelectionPopup, setAiSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [showAiHistory, setShowAiHistory] = useState(false);

  // ===== T-540: 侧栏拖拽宽度 =====
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });

  // ===== 画中画（B站式滚动小窗） =====
  const [showPip, setShowPip] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const lastEvalMsgCountRef = useRef(0); // 上次评审时的消息数
  const prevNodeIdRef = useRef<string | null>(null); // 追踪上一个节点 ID

  const node = nodes.find(n => n.id === fullScreenNodeId);

  // ESC 关闭（带动效 + 触发评审）
  const handleClose = useCallback(() => {
    // 关闭前触发认知评审（只要有新对话更新）
    if (autoCognitionEval && node && aiMessages.length > lastEvalMsgCountRef.current) {
      triggerCognitionEval(aiMessages);
    }
    setIsClosing(true);
    setTimeout(() => { setIsClosing(false); closeFullScreen(); }, 250);
  }, [closeFullScreen, autoCognitionEval, node, aiMessages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  // 快捷键切换 AI 侧栏
  useEffect(() => {
    const handler = () => setAiSidebarOpen(v => !v);
    window.addEventListener('studyboard:toggle-chat', handler);
    return () => window.removeEventListener('studyboard:toggle-chat', handler);
  }, []);

  // 初始化编辑内容和摘要（仅在切换节点时重置，避免 notes 更新导致 iframe 重载）
  useEffect(() => {
    if (node) {
      setEditContent(node.content);
      setSummary(node.summary || null);
      setIsEditing(false);
      setIframeLoading(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  // 切换节点时：保存旧节点对话 + 加载新节点对话
  useEffect(() => {
    const prevId = prevNodeIdRef.current;
    const newId = fullScreenNodeId;

    // 保存旧节点的对话
    if (prevId && aiMessages.length > 0) {
      const prevNode = nodes.find(n => n.id === prevId);
      if (prevNode) {
        const convs = prevNode.aiConversations || [];
        const msgData = aiMessages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
        const convId = aiConvIdRef.current || nanoid();
        const existing = convs.find(c => c.id === convId);
        if (existing) {
          const updated = convs.map(c => c.id === convId ? { ...c, messages: msgData } : c);
          updateNode(prevId, { aiConversations: updated });
        } else {
          const newConv = { id: convId, messages: msgData, mode: aiMode, createdAt: new Date().toISOString() };
          updateNode(prevId, { aiConversations: [...convs, newConv] });
        }
      }
    }

    // 加载新节点的最近一次对话
    if (newId) {
      const newNode = nodes.find(n => n.id === newId);
      const lastConv = newNode?.aiConversations?.[newNode.aiConversations.length - 1];
      if (lastConv && lastConv.messages.length > 0) {
        const loaded = lastConv.messages.map(m => ({ ...m, id: nanoid(), role: m.role as 'user' | 'assistant' }));
        setAiMessages(loaded);
        lastEvalMsgCountRef.current = loaded.length; // 同步基准，避免误触发评审
        aiConvIdRef.current = lastConv.id;
      } else {
        setAiMessages([]);
        lastEvalMsgCountRef.current = 0;
        aiConvIdRef.current = nanoid();
      }
    } else {
      setAiMessages([]);
      lastEvalMsgCountRef.current = 0;
      aiConvIdRef.current = null;
    }

    setAiInput('');
    setAiLoading(false);
    setActiveTab('content');
    setShowSplitForm(false);
    setSplitInstruction('');
    setEditingNoteId(null);
    setShowAiHistory(false);
    lastEvalMsgCountRef.current = 0;
    prevNodeIdRef.current = newId;
  }, [fullScreenNodeId]);

  // 消息列表自动滚动到底部
  useEffect(() => {
    aiListRef.current?.scrollTo({ top: aiListRef.current.scrollHeight, behavior: 'smooth' });
  }, [aiMessages, aiLoading]);

  // 画中画：监听内容区滚动，当内容区滚出视口时显示小窗
  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const contentEl = contentAreaRef.current;
      if (!contentEl) return;
      // 内容区底部相对于滚动容器的位置
      const contentBottom = contentEl.offsetTop + contentEl.offsetHeight;
      setShowPip(el.scrollTop > contentBottom - 60);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeTab, fullScreenNodeId]);

  // 点击外部关闭模式/风格下拉
  useEffect(() => {
    if (!modeDropdownOpen && !styleDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setModeDropdownOpen(false);
      }
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
        setStyleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modeDropdownOpen, styleDropdownOpen]);

  // ===== T-540: 拖拽逻辑 =====
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartRef.current = { x: e.clientX, width: sidebarWidth };
    setIsResizing(true);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxWidth = window.innerWidth / 2;
      // 向左拖增大宽度
      const delta = resizeStartRef.current.x - e.clientX;
      const newWidth = Math.min(maxWidth, Math.max(SIDEBAR_MIN_WIDTH, resizeStartRef.current.width + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    // 拖拽时禁止文本选中
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  const handleSave = () => {
    if (node) updateNode(node.id, { content: editContent });
    setIsEditing(false);
  };

  const handleSummarize = async () => {
    if (!node) return;
    setIsSummarizing(true);
    try {
      const res = await apiFetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: node.content, title: node.title, apiKey: apiKey || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        updateNode(node.id, { summary: data.summary });
      }
    } catch (e) { console.error(e); }
    finally { setIsSummarizing(false); }
  };

  // ===== 多模态理解：图片/文件/视频 =====
  const [isUnderstanding, setIsUnderstanding] = useState(false);
  const handleUnderstand = async () => {
    if (!node || isUnderstanding) return;
    setIsUnderstanding(true);
    try {
      const mt = node.metadata?.materialType;
      const isImage = mt === 'image' || (node.fileData?.startsWith('data:image') ?? false);
      const isVideo = mt === 'video';
      let summaryText = '';
      if (isVideo && node.fileData) {
        const frames = await extractVideoFrames(node.fileData, 4);
        summaryText = await understandContent({ type: 'video', dataUrls: frames, title: node.title, apiKey: apiKey || undefined });
      } else if (isImage && node.fileData) {
        summaryText = await understandContent({ type: 'image', dataUrls: [node.fileData], title: node.title, apiKey: apiKey || undefined });
      } else {
        summaryText = await understandContent({ type: 'file', text: node.content, title: node.title, apiKey: apiKey || undefined });
      }
      if (summaryText) {
        setSummary(summaryText);
        updateNode(node.id, { summary: summaryText, metadata: { ...node.metadata, understood: true, understoodAt: new Date().toISOString() } });
      }
    } catch (e) {
      console.error('理解失败:', e);
    } finally {
      setIsUnderstanding(false);
    }
  };
  
  // ===== 笔记：创建空笔记 =====
  const handleCreateEmptyNote = () => {
    if (!node) return;
    addNoteToNode(node.id, '', 'manual');
  };

  // ===== 笔记：更新内容（自动保存） =====
  const noteDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const handleUpdateNoteContent = (noteId: string, content: string) => {
    if (!node) return;
    // 先更新本地显示
    const updatedNotes = (node.notes || []).map(n => n.id === noteId ? { ...n, content } : n);
    updateNode(node.id, { notes: updatedNotes });
    // debounce 写入 IndexedDB
    if (noteDebounceRef.current[noteId]) clearTimeout(noteDebounceRef.current[noteId]);
    noteDebounceRef.current[noteId] = setTimeout(() => {
      updateNode(node.id, { notes: updatedNotes });
    }, 800);
  };

  // ===== 笔记：删除 =====
  const handleDeleteNote = (noteId: string) => {
    if (!node) return;
    const updatedNotes = (node.notes || []).filter(n => n.id !== noteId);
    updateNode(node.id, { notes: updatedNotes });
  };
  
  // ===== 删除节点（二次确认） =====
  const handleDelete = () => {
    if (!node) return;
    if (window.confirm(`确定删除节点「${node.title}」吗？\n此操作不可撤销。`)) {
      removeNode(node.id);
      closeFullScreen();
    }
  };

  // ===== AI 侧栏圈选：监听 mouseup 获取选区 =====
  const handleAiMouseUp = (e: React.MouseEvent) => {
    if (!aiSelectionMode) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;
    const text = selection.toString().trim();
    if (aiListRef.current && selection.anchorNode && aiListRef.current.contains(selection.anchorNode)) {
      setAiSelectionPopup({ text, x: e.clientX, y: e.clientY });
    }
  };

  const handleAddAiSelectionToNote = () => {
    if (!aiSelectionPopup || !node) return;
    addNoteToNode(node.id, aiSelectionPopup.text, 'chat');
    window.getSelection()?.removeAllRanges();
    setAiSelectionPopup(null);
  };

  // 续写：将选中文字追加到指定笔记末尾
  const handleAppendAiSelectionToNote = (noteId?: string) => {
    if (!aiSelectionPopup || !node) return;
    const noteList = node.notes || [];
    if (noteList.length === 0) {
      addNoteToNode(node.id, aiSelectionPopup.text, 'manual');
    } else {
      const targetId = noteId || noteList[noteList.length - 1].id;
      const updatedNotes = noteList.map(n =>
        n.id === targetId ? { ...n, content: (n.content ? n.content + '\n\n' : '') + aiSelectionPopup.text } : n
      );
      updateNode(node.id, { notes: updatedNotes });
    }
    window.getSelection()?.removeAllRanges();
    setAiSelectionPopup(null);
  };

  // ===== 分化节点（复用 NodeDetail 的分化逻辑） =====
  const handleSplit = async () => {
    if (!splitInstruction.trim() || !node || isSplitting) return;
    setIsSplitting(true);
    try {
      const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
  
      const res = await apiFetch('/api/node/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: { id: node.id, title: node.title, content: node.content },
          instruction: splitInstruction,
          connectedEdges: connectedEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            relation: e.relation,
          })),
          apiKey: apiKey || undefined,
        }),
      });
  
      if (!res.ok) throw new Error('分化失败');
      const data = await res.json();
  
      // 删除原节点
      removeNode(node.id);
  
      // 创建新节点（在原节点位置附近）
      const newNodes: KnowledgeNode[] = (data.newNodes || []).map(
        (n: { type: NodeType; title: string; content: string; level: number }, i: number) => ({
          id: nanoid(),
          boardId: node.boardId,
          type: n.type,
          title: n.title,
          content: n.content,
          level: n.level,
          status: 'lit' as const,
          position: { x: node.position.x + (i - 1) * 200, y: node.position.y + 100 },
          metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        })
      );
  
      // 创建新节点间的边
      const titleToId = new Map(newNodes.map((n) => [n.title, n.id]));
      const newEdges: KnowledgeEdge[] = (data.newEdges || [])
        .filter(
          (e: { sourceTitle: string; targetTitle: string }) =>
            titleToId.has(e.sourceTitle) && titleToId.has(e.targetTitle)
        )
        .map((e: { sourceTitle: string; targetTitle: string; relation: string; type: KnowledgeEdge['type'] }) => ({
          id: nanoid(),
          boardId: node.boardId,
          source: titleToId.get(e.sourceTitle)!,
          target: titleToId.get(e.targetTitle)!,
          relation: e.relation,
          type: e.type,
          autoGenerated: true,
        }));
  
      applyGraphChanges({ newNodes, updatedNodes: [], newEdges });
      setShowSplitForm(false);
      setSplitInstruction('');
      closeFullScreen();
    } catch (error) {
      console.error('节点分化失败:', error);
    } finally {
      setIsSplitting(false);
    }
  };

  // ===== AI 侧栏对话逻辑（非流式，解析 data stream 文本块）=====
  const handleAiSend = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading || !node) return;

    const userMsg: ChatMessage = { id: nanoid(), role: 'user', content: text, timestamp: new Date().toISOString() };
    const history = [...aiMessages, userMsg];
    setAiMessages(history);
    setAiInput('');
    setAiLoading(true);

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          mode: aiMode,
          style: responseStyle,
          customStyleText: responseStyle === 'custom' ? customStyle : undefined,
          apiKey: apiKey || undefined,
          webSearch: aiWebSearch,
          // 注入当前节点上下文，/api/chat 会将其拼入 system prompt
          context: { selectedNode: { title: node.title, content: node.content, summary: node.summary } },
        }),
      });
      if (!res.ok) throw new Error(`AI 请求失败: ${res.status}`);

      // 流式读取：边接收边展示
      const assistantId = nanoid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      setAiMessages([...history, assistantMsg]);

      let accumulated = '';
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的最后一行
          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                accumulated += JSON.parse(line.slice(2)) as string;
                setAiMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m));
              } catch { /* 忽略解析失败的行 */ }
            }
          }
        }
      }

      const finalContent = accumulated || '抱歉，我暂时无法生成回答。';
      setAiMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalContent } : m));
      const finalMessages = [...history, { ...assistantMsg, content: finalContent }];

      // 保存到全局对话历史（带画板来源标注）
      const now = new Date().toISOString();
      const boardName = boards.find(b => b.id === node.boardId)?.name;
      if (aiConvIdRef.current) {
        await updateConversation(aiConvIdRef.current, { messages: finalMessages, updatedAt: now });
      } else {
        const conv = await createConversation({
          nodeId: node.id,
          boardId: node.boardId,
          boardName,
          mode: aiMode,
          messages: finalMessages,
          createdAt: now,
          updatedAt: now,
        });
        aiConvIdRef.current = conv.id;
      }
    } catch (e) {
      console.error('AI sidebar chat error:', e);
      setAiMessages(prev => [...prev, {
        id: nanoid(),
        role: 'assistant',
        content: '⚠️ AI 服务暂时不可用，请稍后再试。',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  // 认知评审触发函数（复用）
  const triggerCognitionEval = (msgs: ChatMessage[]) => {
    if (!node) return;
    setEvaluating(node.id, true);
    apiFetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation: msgs.map(m => ({ role: m.role, content: m.content })),
        nodeContent: node.content,
        notes: (node.notes || []).map(n => n.content).filter(Boolean),
        apiKey: apiKey || undefined,
      }),
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data && node) {
        const history = [...(node.cognitionHistory || []), { level: data.level, evaluatedAt: new Date().toISOString(), conversationLength: msgs.length }];
        updateNode(node.id, { cognitionLevel: data.level, cognitionReason: data.reason, cognitionHistory: history });
      }
    }).catch(() => {}).finally(() => {
      if (node) setEvaluating(node.id, false);
    });
  };

  if (!fullScreenNodeId || !node) return null;

  const notes = [...(node.notes || [])].reverse(); // 新笔记在前

  const isMaterial = node.type === 'material';
  const isWebMaterial = isMaterial && node.metadata.source?.startsWith('http');
  const isMarkdownFile = isMaterial && node.metadata.source && detectFileType(node.metadata.source) === 'markdown';
  const isPdfFile = isMaterial && (node.fileData || node.metadata.materialType === 'pdf');
  const isDocxFile = isMaterial && node.fileData && (node.metadata.materialType === 'docx' || node.metadata.source?.endsWith('.docx') || node.metadata.source?.endsWith('.doc'));
  const isXlsxFile = isMaterial && node.fileData && (node.metadata.materialType === 'xlsx' || node.metadata.source?.endsWith('.xlsx') || node.metadata.source?.endsWith('.xls'));
  const isPptxFile = isMaterial && node.fileData && (node.metadata.materialType === 'pptx' || node.metadata.source?.endsWith('.pptx') || node.metadata.source?.endsWith('.ppt'));

  const currentMode = AI_MODES.find(m => m.value === aiMode) || AI_MODES[0];
  const currentStyle = AI_STYLES.find(s => s.value === responseStyle) || AI_STYLES[0];

  return (
    /* T-530: 遮罩层 — 背景模糊，四周留缝 */
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center"
      style={{ animation: 'fadeIn 200ms ease-out' }}
    >
      {/* T-530: 内容卡片 — 不完全覆盖 */}
      <div className="relative w-[calc(100%-80px)] h-[calc(100%-80px)] max-md:w-[calc(100%-32px)] max-md:h-[calc(100%-32px)] md:max-lg:w-[calc(100%-64px)] md:max-lg:h-[calc(100%-64px)] rounded-2xl shadow-2xl bg-[var(--bg-primary)] overflow-hidden flex"
        style={{ animation: isClosing ? 'scaleOut 250ms ease-in forwards' : 'scaleIn 350ms ease-out' }}>

        {/* 主内容区 */}
        <div className="flex-1 min-w-0 flex flex-col bg-[var(--bg-secondary)]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <div className="max-w-3xl mx-auto w-full flex items-center gap-3 min-w-0">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  className="text-lg font-semibold text-[var(--text-primary)] bg-[var(--bg-primary)] border border-[var(--accent)] rounded-md px-2 py-1 outline-none min-w-[120px] max-w-[400px] flex-1"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => {
                    const trimmed = editTitle.trim();
                    if (trimmed && trimmed !== node.title) updateNode(node.id, { title: trimmed });
                    else setEditTitle(node.title);
                    setIsEditingTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                    if (e.key === 'Escape') { setEditTitle(node.title); setIsEditingTitle(false); }
                  }}
                  autoFocus
                />
              ) : (
                <h2
                  className="text-lg font-semibold text-[var(--text-primary)] truncate cursor-text hover:text-[var(--accent)] transition-colors"
                  onClick={() => { setEditTitle(node.title); setIsEditingTitle(true); }}
                  title="点击编辑标题"
                >
                  {node.title}
                </h2>
              )}
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">{{ concept: '概念', theme: '主题', material: '材料', understanding: '理解', question: '问题' }[node.type] || node.type}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowSplitForm(open => !open)}
                className={`p-2 rounded-lg transition-colors ${
                  showSplitForm
                    ? 'text-green-400 bg-green-500/15'
                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-green-400'
                }`}
                title="分化节点"
              >
                <Split size={18} />
              </button>
              <button
                onClick={() => {
                  if (!node) return;
                  const { generateNodeMarkdown } = require('@/lib/export/MarkdownGenerator');
                  const { sanitizeFileName } = require('@/lib/export/FileNameSanitizer');
                  const { nodes: allNodes, edges } = useGraphStore.getState();
                  const md = generateNodeMarkdown(node, edges, allNodes);
                  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${sanitizeFileName(node.title, node.id)}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="下载为 Markdown"
              >
                <Download size={18} />
              </button>
              <button
                onClick={handleUnderstand}
                disabled={isUnderstanding}
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                title="理解内容（图片/文件/视频）"
              >
                {isUnderstanding ? <Loader2 size={18} className="animate-spin" /> : <ScanEye size={18} />}
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg hover:bg-red-500/15 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                title="删除节点"
              >
                <Trash2 size={18} />
              </button>
              <button
                onClick={() => setAiSidebarOpen(open => !open)}
                className={`p-2 rounded-lg transition-colors ${
                  aiSidebarOpen
                    ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
                }`}
                title="问 AI 关于这个节点的问题"
              >
                <MessageSquare size={18} />
              </button>
              <button onClick={handleClose} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tab 切换：源文件 / 内容 / 白板 */}
          <div className="px-6 border-b border-[var(--border)]">
            <div className="max-w-3xl mx-auto flex gap-4">
              {([
                { value: 'source', label: '源文件' },
                { value: 'content', label: '内容' },
                { value: 'whiteboard', label: '白板' },
              ] as const).map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                    activeTab === tab.value
                      ? 'text-[var(--text-primary)] font-medium border-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 分化表单 */}
          {showSplitForm && (
            <div className="px-6 py-3 border-b border-[var(--border)] bg-green-500/10" style={{ animation: 'fadeIn 150ms ease-out' }}>
              <div className="max-w-3xl mx-auto">
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">分化指示</label>
                <textarea
                  value={splitInstruction}
                  onChange={(e) => setSplitInstruction(e.target.value)}
                  placeholder="例如：按概念维度拆分为三个子节点"
                  disabled={isSplitting}
                  className="w-full h-20 border border-[var(--border-strong)] rounded-md p-2 text-sm resize-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleSplit}
                    disabled={isSplitting || !splitInstruction.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSplitting ? <Loader2 size={14} className="animate-spin" /> : <Split size={14} />}
                    {isSplitting ? '分化中...' : '确认分化'}
                  </button>
                  <button
                    onClick={() => { setShowSplitForm(false); setSplitInstruction(''); }}
                    disabled={isSplitting}
                    className="px-3 py-1.5 text-[var(--text-primary)] text-sm rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Content Area */}
          {activeTab === 'source' ? (
          /* 源文件视图：展示当前节点的 MD 原始内容 */
          <div className="flex-1 relative overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto">
                {/* 文件名 + 切换按钮 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-[var(--accent)]" />
                    <span className="text-xs text-[var(--text-muted)] font-mono">{node.title}.md</span>
                  </div>
                  <div className="flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] p-0.5">
                    <button
                      onClick={() => setSourceMode('raw')}
                      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${sourceMode === 'raw' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    >
                      原生
                    </button>
                    <button
                      onClick={() => setSourceMode('rendered')}
                      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${sourceMode === 'rendered' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    >
                      渲染
                    </button>
                  </div>
                </div>
                {/* 内容区 */}
                {sourceMode === 'raw' ? (
                  <pre className="text-xs leading-relaxed text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-words bg-[var(--bg-primary)] rounded-lg border border-[var(--border)] p-4 overflow-x-auto">
                    {(() => {
                      try {
                        const { generateNodeMarkdown } = require('@/lib/export/MarkdownGenerator');
                        const { nodes: allNodes, edges } = useGraphStore.getState();
                        return generateNodeMarkdown(node, edges, allNodes);
                      } catch { return '# 生成失败'; }
                    })()}
                  </pre>
                ) : (
                  <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border)] p-4 prose prose-invert prose-sm max-w-none">
                    <MarkdownRenderer content={(() => {
                      try {
                        const { generateNodeMarkdown } = require('@/lib/export/MarkdownGenerator');
                        const { nodes: allNodes, edges } = useGraphStore.getState();
                        return generateNodeMarkdown(node, edges, allNodes);
                      } catch { return '# 生成失败'; }
                    })()} />
                  </div>
                )}
              </div>
            </div>
          </div>
          ) : activeTab === 'content' ? (
          <div className="flex-1 relative overflow-hidden flex flex-col">
          <div ref={contentScrollRef} className="flex-1 overflow-y-auto flex flex-col">
            {/* 内容展示区：自然高度，随滚动流动。key=node.id 确保 notes 变化不重建 iframe */}
            <div ref={contentAreaRef} key={node.id}>
            {isPdfFile && node.fileData ? (
              /* PDF 文件节点：使用 dataURL 渲染 */
              <div className="h-[75vh] min-h-[400px] relative border-b border-[var(--border)]">
                  {iframeLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-tertiary)] z-10">
                      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
                      <span className="ml-2 text-sm text-[var(--text-muted)]">加载中...</span>
                    </div>
                  )}
                  <iframe
                    src={node.fileData}
                    className="w-full h-full border-0"
                    title={node.title}
                    onLoad={() => setIframeLoading(false)}
                  />
              </div>
            ) : isDocxFile && node.fileData ? (
              /* Word 文档节点 */
              <div className="flex-1 overflow-y-auto">
                <DocxPreview fileData={node.fileData} />
              </div>
            ) : isXlsxFile && node.fileData ? (
              /* Excel 表格节点 */
              <div className="flex-1 overflow-hidden">
                <XlsxPreview fileData={node.fileData} />
              </div>
            ) : isPptxFile && node.fileData ? (
              /* PPT 演示文稿节点 */
              <PptxPreview fileData={node.fileData} />
            ) : isMarkdownFile ? (
              /* Markdown 文件节点：可编辑 + 实时预览 */
              <div className="flex-1 overflow-hidden">
                <MarkdownEditor
                  content={node.content || ''}
                  onChange={(val) => updateNode(node.id, { content: val })}
                />
              </div>
            ) : isWebMaterial ? (
              /* 网页材料节点：iframe 嵌入原文 + 摘要 */
              <>
              <div className="h-[75vh] min-h-[400px] relative border-b border-[var(--border)]">
                  {iframeLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-tertiary)] z-10">
                      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
                      <span className="ml-2 text-sm text-[var(--text-muted)]">加载中...</span>
                    </div>
                  )}
                  <iframe
                    src={node.metadata.source}
                    className="w-full h-full border-0"
                    title={node.title}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    onLoad={() => setIframeLoading(false)}
                  />
              </div>
                {/* 抓取的内容/摘要 */}
                {node.content && (
                  <div className="px-6 py-4">
                    <div className="max-w-3xl mx-auto">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1">
                        <FileText size={14} /> 内容摘要
                      </h3>
                      <MarkdownRenderer content={summary || node.content.slice(0, 500)} className="text-sm" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* 文本节点：主要内容框 + 摘要框 */
              <div className="px-6 py-4">
                <div className="max-w-3xl mx-auto">
                    {/* 主要内容框：平时透明，编辑时显现边框 */}
                    <div
                      className={`group/content relative rounded-xl transition-all duration-200 ${
                        isEditing
                          ? 'border border-[var(--border-strong)] bg-[var(--bg-tertiary)] shadow-sm'
                          : 'border border-transparent hover:border-[var(--border)]'
                      }`}
                    >
                      {isEditing ? (
                        <div className="p-4">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
                            autoFocus
                            className="w-full min-h-[280px] font-mono text-sm resize-y bg-transparent text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
                            placeholder="输入 Markdown 内容…支持代码块、表格等格式"
                          />
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]">
                            <span className="text-[10px] text-[var(--text-muted)]">Markdown · ⌘/Ctrl+Enter 保存</span>
                            <button onClick={handleSave} className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors">保存</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => { setEditContent(node.content || ''); setIsEditing(true); }}
                          className="p-4 cursor-text min-h-[120px]"
                          title="点击编辑内容"
                        >
                          <MarkdownRenderer content={node.content || '*点击这里开始记录内容…*'} />
                        </div>
                      )}
                      {/* 生成摘要按钮：框内右下角 */}
                      {!isEditing && (
                        <button
                          onClick={handleSummarize}
                          disabled={isSummarizing}
                          className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] opacity-0 group-hover/content:opacity-100 transition-all disabled:opacity-50"
                        >
                          {isSummarizing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          {isSummarizing ? '生成中…' : '生成摘要'}
                        </button>
                      )}
                    </div>

                    {/* 摘要框：位于主要内容框之下 */}
                    {summary && (
                      <div className="mt-3 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] p-4" style={{ animation: 'fadeIn 200ms ease-out' }}>
                        <h3 className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1 mb-2">
                          <Sparkles size={12} /> AI 摘要
                        </h3>
                        <MarkdownRenderer content={summary} className="text-sm" />
                      </div>
                    )}

                    {/* 白板缩略图预览 */}
                    {node.whiteboardThumbnail && (
                      <div className="mt-6 pt-4 border-t border-[var(--border)]">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                            <PenLine size={12} /> 白板
                          </h3>
                          <button
                            onClick={() => setActiveTab('whiteboard')}
                            className="ml-auto text-[11px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                          >
                            打开白板 →
                          </button>
                        </div>
                        <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white shadow-sm">
                          <img
                            src={node.whiteboardThumbnail}
                            alt="白板缩略图"
                            className="w-full h-auto max-h-[240px] object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            )}
            </div>{/* end contentAreaRef */}

            {/* 笔记区：所有节点类型共享 */}
            <div className="max-w-3xl mx-auto w-full px-6 mt-4 pt-4 pb-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                  <PenLine size={12} /> 笔记
                  {notes.length > 0 && <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]">{notes.length}</span>}
                </h3>
                <button
                  onClick={handleCreateEmptyNote}
                  className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                  title="新建笔记"
                >
                  <PenLine size={11} />
                  新建笔记
                </button>
              </div>

              {notes.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">点击上方「新建笔记」开始记录…</p>
              ) : (
                <div className="space-y-2">
                  {notes.map(note => {
                    const kind = NOTE_KINDS[note.kind] || NOTE_KINDS.manual;
                    return (
                      <div key={note.id} className="group/note relative rounded-lg border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors" style={{ animation: 'fadeIn 150ms ease-out' }}>
                        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                          <span className={`text-[10px] leading-none px-1.5 py-0.5 rounded font-medium ${kind.className}`}>{kind.label}</span>
                          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{formatNoteTime(note.createdAt)}</span>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="ml-auto opacity-0 group-hover/note:opacity-100 p-0.5 rounded text-[var(--text-muted)] hover:text-red-400 transition-all"
                            title="删除笔记"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        {editingNoteId === note.id ? (
                          <textarea
                            value={note.content}
                            onChange={e => handleUpdateNoteContent(note.id, e.target.value)}
                            onBlur={() => setEditingNoteId(null)}
                            placeholder="写下你的笔记…支持 Markdown 格式"
                            rows={Math.max(2, note.content.split('\n').length)}
                            autoFocus
                            className="w-full px-3 pb-2 text-sm text-[var(--text-primary)] bg-transparent resize-none focus:outline-none placeholder:text-[var(--text-muted)] leading-relaxed font-mono"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingNoteId(note.id)}
                            className="px-3 pb-2 cursor-text min-h-[32px] text-sm text-[var(--text-primary)]"
                            title="点击编辑"
                          >
                            {note.content ? (
                              <MarkdownRenderer content={note.content} className="text-sm" />
                            ) : (
                              <span className="text-[var(--text-muted)] italic">点击编辑…</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

            {/* 画中画小窗：内容区滚出视口时显示 */}
            <PipWindow
              visible={showPip}
              title={node.title}
              onClose={() => setShowPip(false)}
              onScrollToTop={() => contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              {isPdfFile && node.fileData ? (
                <iframe src={node.fileData} className="w-full h-full border-0" title="pip" />
              ) : isWebMaterial ? (
                <iframe src={node.metadata.source} className="w-full h-full border-0" title="pip" sandbox="allow-scripts allow-same-origin" />
              ) : (
                <div className="p-2">
                  <MarkdownRenderer content={(node.content || '').slice(0, 500)} className="text-xs" />
                </div>
              )}
            </PipWindow>
          </div>
          ) : (
            /* 白板 Tab：带边界感和空隙 */
            <div className="flex-1 overflow-hidden p-3">
              <div className="h-full w-full rounded-xl border border-[var(--border)] bg-[var(--bg-tertiary)] overflow-hidden shadow-sm">
                <Whiteboard nodeId={node.id} />
              </div>
            </div>
          )}
        </div>

        {/* AI 对话 sidebar（T-540: 可拖拽宽度） */}
        {aiSidebarOpen && (
          <div
            className="relative shrink-0 h-full flex flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]"
            style={{ width: sidebarWidth, animation: 'slideInRight 250ms ease-out' }}
          >
            {/* T-540: 拖拽手柄 — sidebar 左边缘 */}
            <div
              onMouseDown={handleResizeStart}
              className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors ${
                isResizing ? 'bg-[var(--accent)]' : 'bg-transparent hover:bg-[var(--accent)]/40'
              }`}
              title="拖拽调整宽度"
            />

            {/* 侧栏顶部：新建对话 + 历史 + 收起 */}
            <div className="flex items-center justify-end gap-1 px-3 py-2.5 border-b border-[var(--border)]">
              <button
                onClick={() => {
                  // 保存当前对话后新建
                  if (node && aiMessages.length > 0) {
                    const convs = node.aiConversations || [];
                    const msgData = aiMessages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
                    const newConv = { id: aiConvIdRef.current || nanoid(), messages: msgData, mode: aiMode, createdAt: new Date().toISOString() };
                    const existing = convs.find(c => c.id === newConv.id);
                    const updated = existing ? convs.map(c => c.id === newConv.id ? newConv : c) : [...convs, newConv];
                    updateNode(node.id, { aiConversations: updated });
                  }
                  setAiMessages([]);
                  aiConvIdRef.current = nanoid();
                  lastEvalMsgCountRef.current = 0;
                }}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                title="新建对话"
              >
                <Plus size={16} />
              </button>
              {(node?.aiConversations?.length || 0) > 0 && (
                <button
                  onClick={() => setShowAiHistory(v => !v)}
                  className={`p-2 rounded-lg transition-colors ${showAiHistory ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
                  title="对话历史"
                >
                  <Clock size={16} />
                </button>
              )}
              <button
                onClick={() => {
                  // 关闭侧栏前触发评审（只要有新对话更新）
                  if (autoCognitionEval && node && aiMessages.length > lastEvalMsgCountRef.current) {
                    triggerCognitionEval(aiMessages);
                  }
                  setAiSidebarOpen(false);
                }}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                title="收起侧栏"
              >
                <X size={16} />
              </button>
            </div>

            {/* 对话历史独立视图 */}
            {showAiHistory ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
                  <button
                    onClick={() => setShowAiHistory(false)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <ChevronDown size={14} className="rotate-90" />
                    返回对话
                  </button>
                  <span className="text-xs text-[var(--text-muted)]">共 {node?.aiConversations?.length || 0} 条</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {node?.aiConversations && node.aiConversations.length > 0 ? (
                    <div className="py-1">
                      {node.aiConversations.map((conv, i) => (
                        <button
                          key={conv.id}
                          onClick={() => {
                            // 保存当前对话
                            if (aiMessages.length > 0 && node) {
                              const convs = node.aiConversations || [];
                              const msgData = aiMessages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
                              const cur = { id: aiConvIdRef.current || nanoid(), messages: msgData, mode: aiMode, createdAt: new Date().toISOString() };
                              const existing = convs.find(c => c.id === cur.id);
                              const updated = existing ? convs.map(c => c.id === cur.id ? cur : c) : [...convs, cur];
                              updateNode(node.id, { aiConversations: updated });
                            }
                            // 加载选中的历史对话
                            setAiMessages(conv.messages.map(m => ({ ...m, id: nanoid(), role: m.role as 'user' | 'assistant' })));
                            aiConvIdRef.current = conv.id;
                            lastEvalMsgCountRef.current = conv.messages.length;
                            setShowAiHistory(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors group ${
                            conv.id === aiConvIdRef.current ? 'bg-[var(--accent-soft)]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              conv.mode === 'feynman' ? 'bg-green-500/80' : conv.mode === 'debate' ? 'bg-red-500/80' : conv.mode === 'design' ? 'bg-purple-500/80' : 'bg-blue-500/80'
                            } text-white`}>
                              {conv.mode === 'feynman' ? '费曼' : conv.mode === 'debate' ? '辩论' : conv.mode === 'design' ? '设计' : '学习'}
                            </span>
                            <span className={`text-xs truncate flex-1 transition-colors ${
                              conv.id === aiConvIdRef.current ? 'text-[var(--accent)]' : 'text-[var(--text-primary)] group-hover:text-[var(--accent)]'
                            }`}>
                              对话 {i + 1} · {conv.messages.length} 条
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 pl-0.5">
                            {conv.messages[0]?.content?.slice(0, 30) || '空对话'}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 pl-0.5">
                            {new Date(conv.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">暂无历史对话</p>
                  )}
                </div>
              </div>
            ) : (
            <>

            {/* 当前节点上下文提示 + 认知同心圆 */}
            <div className="px-4 py-1.5 bg-[var(--accent-soft)] border-b border-[var(--accent)]/20 flex items-center gap-2">
              <span className="shrink-0 text-[10px] text-[var(--accent)]">当前上下文</span>
              <span className="text-xs text-[var(--accent)] truncate flex-1">{node.title}</span>
              {node.cognitionLevel !== undefined && node.cognitionLevel > 0 && (
                <CognitionRing level={node.cognitionLevel} reason={node.cognitionReason} size={32} />
              )}
            </div>

            {/* 控制栏：圈选 / 联网 / 风格 / 模式，右对齐 */}
            <div className="flex items-center justify-end gap-1.5 px-3 py-2 border-b border-[var(--border)]">
              <button
                onClick={() => { setAiSelectionMode(v => !v); setAiSelectionPopup(null); }}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                  aiSelectionMode
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                }`}
                title="圈选回复文字加入笔记"
              >
                <Highlighter size={12} />
                圈选
              </button>
              <button
                onClick={() => setAiWebSearch(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                  aiWebSearch
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                }`}
                title="联网搜索"
              >
                <Globe size={12} />
                联网
              </button>
              {/* 回答风格 */}
              <div className="relative" ref={styleDropdownRef}>
                <button
                  onClick={() => setStyleDropdownOpen(open => !open)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
                  title={`回答风格：${currentStyle.hint}`}
                >
                  {currentStyle.label}
                  <ChevronDown size={12} className={`transition-transform duration-200 ${styleDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {styleDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl z-50"
                    style={{ animation: 'dropdownIn 150ms ease-out' }}>
                    {AI_STYLES.map(style => (
                      <button
                        key={style.value}
                        onClick={() => { setResponseStyle(style.value); setStyleDropdownOpen(false); }}
                        className={`w-full flex flex-col items-start gap-0.5 px-3 py-1.5 text-xs transition-colors ${
                          responseStyle === style.value
                            ? 'bg-[var(--bg-hover)]'
                            : 'hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <span className={`flex items-center gap-1.5 ${responseStyle === style.value ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                          {style.label}
                          {responseStyle === style.value && <span className="text-[var(--accent)]">✓</span>}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">{style.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* 模式切换 */}
              <div className="relative" ref={modeDropdownRef}>
                <button
                  onClick={() => setModeDropdownOpen(open => !open)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
                  title="切换 AI 模式"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentMode.color }} />
                  {currentMode.label}
                  <ChevronDown size={12} className={`transition-transform duration-200 ${modeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {modeDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-28 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl z-50"
                    style={{ animation: 'dropdownIn 150ms ease-out' }}>
                    {AI_MODES.map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => { setAiMode(mode.value); setModeDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                          aiMode === mode.value
                            ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: mode.color }} />
                        {mode.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 消息列表（圈选模式下监听 mouseup） */}
            <div ref={aiListRef} onMouseUp={handleAiMouseUp} className={`flex-1 overflow-y-auto p-3 space-y-3 ${aiSelectionMode ? 'select-text cursor-text' : ''}`}>
              {aiMessages.length === 0 && !aiLoading && (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
                  <MessageSquare size={24} className="text-[var(--text-muted)]" />
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    关于「{node.title}」，<br />有什么想问的？
                  </p>
                </div>
              )}
              {aiMessages.map((msg) => (
                <div key={msg.id}
                  className={`group/msg text-sm ${msg.role === 'user' ? 'text-right' : ''}`}
                  style={{ animation: 'msgIn 200ms ease-out' }}>
                  {msg.role === 'user' ? (
                    <div className="inline-block max-w-[90%] text-left px-3 py-2 rounded-lg bg-[var(--accent)] text-white">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[95%]">
                      <div className="inline-block px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                        <MarkdownRenderer content={msg.content} className="text-sm" />
                      </div>
                      <button
                        onClick={() => {
                          if (!node) return;
                          addNoteToNode(node.id, msg.content, 'chat');
                        }}
                        className="mt-1 ml-1 flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors opacity-0 group-hover/msg:opacity-100"
                        title="将此回复加入笔记"
                      >
                        <StickyNote size={10} />
                        加入笔记
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {aiLoading && (
                <div className="text-sm" style={{ animation: 'msgIn 200ms ease-out' }}>
                  <div className="inline-block px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                    <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
                  </div>
                </div>
              )}
            </div>

            {/* 圈选确认浮层 */}
            {aiSelectionPopup && (
              <SelectionPopup
                text={aiSelectionPopup.text}
                initialX={aiSelectionPopup.x}
                initialY={aiSelectionPopup.y}
                onClose={() => { setAiSelectionPopup(null); window.getSelection()?.removeAllRanges(); }}
                onAddToNote={handleAddAiSelectionToNote}
                onAppendToNote={handleAppendAiSelectionToNote}
                notes={(node.notes || []).map(n => ({ id: n.id, content: n.content }))}
                onCreateNode={() => {
                  if (!aiSelectionPopup || !node) return;
                  const text = aiSelectionPopup.text.trim();
                  if (!text) return;
                  const now = new Date().toISOString();
                  const { currentBoardId } = useBoardStore.getState();
                  useGraphStore.getState().addNode({
                    id: `node-${nanoid(8)}`,
                    boardId: currentBoardId || node.boardId,
                    type: 'understanding',
                    title: text.length > 24 ? text.slice(0, 24) + '…' : text,
                    content: text,
                    level: 3,
                    status: 'lit',
                    position: { x: (node.position?.x || 0) + Math.random() * 200 - 100, y: (node.position?.y || 0) + Math.random() * 200 - 100 },
                    metadata: { createdAt: now, updatedAt: now },
                  });
                  window.getSelection()?.removeAllRanges();
                  setAiSelectionPopup(null);
                }}
              />
            )}

            {/* 输入框 */}
            <div className="p-3 border-t border-[var(--border)]">
              <div className="flex gap-2">
                <input
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAiSend(); }}
                  placeholder="问关于这个节点的问题..."
                  className="flex-1 min-w-0 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  onClick={handleAiSend}
                  disabled={aiLoading || !aiInput.trim()}
                  className="shrink-0 px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
            </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
