'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Info, Lightbulb, PanelRightClose, PanelRightOpen } from 'lucide-react';
import ChatPanel from '@/components/chat/ChatPanel';
import { NodeDetail } from '@/components/node/NodeDetail';
import { RecommendPanel } from './RecommendPanel';
import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';

type TabId = 'chat' | 'detail' | 'recommend';

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 360;
const STORAGE_KEY = 'memos-sidebar-width';

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [collapsed, setCollapsed] = useState(false);
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
  const { chatPanelOpen, setChatPanelOpen } = useChatStore();

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

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = widthRef.current;
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth - (ev.clientX - startX)));
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
    { id: 'recommend' as TabId, icon: Lightbulb, label: '推荐' },
  ];

  return (
    <>
      {/* 收起状态：浮在画布右边缘的展开按钮 */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="展开面板"
          className="fixed right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-[var(--bg-secondary)]/60 backdrop-blur-sm border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center"
        >
          <PanelRightOpen size={16} />
        </button>
      )}

      {/* 面板容器：collapsed 时宽度为 0，无黑条 */}
      <div
        className={`h-full flex overflow-hidden flex-shrink-0 ${
          isResizing ? '' : 'transition-[width] duration-300 ease-in-out'
        }`}
        style={{ width: collapsed ? 0 : width }}
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
        >
          {/* Tab 栏 */}
          <div className="flex items-center border-b border-[var(--border)] px-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-[var(--accent)] border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => setCollapsed(true)}
              title="收起面板"
              className="ml-auto p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <PanelRightClose size={16} />
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && <ChatPanel visible={true} onClose={() => setCollapsed(true)} />}
            {activeTab === 'detail' && <NodeDetail />}
            {activeTab === 'recommend' && <RecommendPanel />}
          </div>
        </div>
      </div>
    </>
  );
}
