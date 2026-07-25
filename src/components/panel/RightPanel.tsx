'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Info, PanelRightClose, PanelRightOpen, Plus, Clock, ArrowLeft } from 'lucide-react';
import ChatPanel from '@/components/chat/ChatPanel';
import { NodeDetail } from '@/components/node/NodeDetail';
import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';
import { useBoardStore } from '@/stores/boardStore';
import { getConversationsByBoard } from '@/lib/db';
import type { ChatMode, Conversation } from '@/types';

type TabId = 'chat' | 'detail';

const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 360;
const STORAGE_KEY = 'memos-sidebar-width';

const modeConfig: Record<ChatMode, { label: string; color: string }> = {
  learn: { label: '学习', color: 'bg-blue-500' },
  feynman: { label: '费曼', color: 'bg-green-500' },
  debate: { label: '辩论', color: 'bg-red-500' },
  design: { label: '设计', color: 'bg-purple-500' },
};

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [collapsed, setCollapsed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH;
    const stored = parseInt(localStorage.getItem(STORAGE_KEY) || '360');
    return isNaN(stored) ? DEFAULT_WIDTH : stored;
  });
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  const { selectedNodeId } = useGraphStore();
  const { nodeDetailOpen } = useUIStore();
  const { chatPanelOpen, setChatPanelOpen, triggerReset, setPendingConversation } = useChatStore();
  const { currentBoardId } = useBoardStore();

  // 当选中节点且 nodeDetailOpen 时自动切换到详情 tab
  useEffect(() => {
    if (nodeDetailOpen && selectedNodeId) {
      setActiveTab('detail');
      setCollapsed(false);
    }
  }, [nodeDetailOpen, selectedNodeId]);

  // 当外部调用 setChatPanelOpen(true) 时（如破茧推荐），展开面板并切换到对话 tab
  useEffect(() => {
    if (chatPanelOpen) {
      setActiveTab('chat');
      setCollapsed(false);
    }
  }, [chatPanelOpen]);

  // 拖拽期间：全局显示 col-resize 光标并禁用文本选中
  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // 加载历史对话列表（按当前画板过滤）
  const loadHistory = useCallback(async () => {
    if (!currentBoardId) {
      setHistoryList([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const convs = await getConversationsByBoard(currentBoardId);
      setHistoryList(convs);
    } finally {
      setHistoryLoading(false);
    }
  }, [currentBoardId]);

  // 切换到历史视图
  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => {
      if (!prev) {
        setActiveTab('chat');
        loadHistory();
      }
      return !prev;
    });
  }, [loadHistory]);

  // 新建对话
  const startNewConversation = useCallback(() => {
    triggerReset();
    setShowHistory(false);
    setActiveTab('chat');
  }, [triggerReset]);

  // 加载某条历史对话
  const loadConversation = useCallback((conv: Conversation) => {
    setPendingConversation(conv);
    setShowHistory(false);
    setActiveTab('chat');
  }, [setPendingConversation]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = widthRef.current;
    const maxWidth = window.innerWidth / 2;
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth - (ev.clientX - startX)));
      setWidth(newWidth);
    };
    const onUp = () => {
      setIsResizing(false);
      localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const tabs = [
    { id: 'chat' as TabId, icon: MessageSquare, label: '对话' },
    { id: 'detail' as TabId, icon: Info, label: '详情' },
  ];

  return (
    <>
      {/* 收起状态：浮在画布右边缘的展开按钮（加大 + 文字标签） */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="展开面板"
          className="fixed right-3 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:shadow-xl transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <PanelRightOpen size={18} />
          <span className="text-[10px] leading-none font-medium">对话</span>
        </button>
      )}

      {/* 面板容器：collapsed 时宽度为 0，无黑条 */}
      <div
        className={`h-full flex overflow-hidden flex-shrink-0 ${
          isResizing ? '' : 'transition-[width] duration-300 ease-in-out'
        }`}
        style={{ width: collapsed ? 0 : width }}
        suppressHydrationWarning
      >
        {/* 拖拽手柄 */}
        <div
          onMouseDown={startResize}
          className={`w-1 h-full cursor-col-resize hover:bg-[var(--accent)] active:bg-[var(--accent)] transition-colors flex-shrink-0 ${
            isResizing ? 'bg-[var(--accent)]' : ''
          }`}
        />
        {/* 面板内容 */}
        <div
          className="flex flex-col overflow-hidden flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-secondary)]"
          style={{ width: width - 4 }}
          suppressHydrationWarning
        >
          {/* Tab 栏 */}
          <div className="flex items-center border-b border-[var(--border)] px-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowHistory(false); }}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2 ${
                  activeTab === tab.id && !showHistory
                    ? 'text-[var(--accent)] border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-0.5">
              {/* 新建对话 */}
              <button
                onClick={startNewConversation}
                title="新建对话"
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Plus size={16} />
              </button>
              {/* 历史对话 */}
              <button
                onClick={toggleHistory}
                title="历史对话"
                className={`p-2 rounded-lg transition-colors ${
                  showHistory
                    ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Clock size={16} />
              </button>
              {/* 收起面板 */}
              <button
                onClick={() => setCollapsed(true)}
                title="收起面板"
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <PanelRightClose size={16} />
              </button>
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-hidden">
            {showHistory ? (
              /* 历史对话独立视图 */
              <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
                  <button
                    onClick={() => setShowHistory(false)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <ArrowLeft size={14} />
                    返回对话
                  </button>
                  <span className="text-xs text-[var(--text-muted)]">共 {historyList.length} 条</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {historyLoading ? (
                    <p className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">加载中...</p>
                  ) : historyList.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">暂无历史对话</p>
                  ) : (
                    <div className="py-1">
                      {historyList.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => loadConversation(conv)}
                          className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${modeConfig[conv.mode].color} text-white`}>
                              {modeConfig[conv.mode].label}
                            </span>
                            <span className="text-xs text-[var(--text-primary)] truncate flex-1 group-hover:text-[var(--accent)] transition-colors">
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
              </div>
            ) : (
              <>
                <div className={activeTab === 'chat' ? 'h-full flex flex-col' : 'hidden'}>
                  <ChatPanel visible={activeTab === 'chat'} onClose={() => setCollapsed(true)} />
                </div>
                {activeTab === 'detail' && <NodeDetail />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
