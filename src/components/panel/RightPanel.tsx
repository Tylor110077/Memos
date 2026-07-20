'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Info, Lightbulb, PanelRightClose, PanelRightOpen } from 'lucide-react';
import ChatPanel from '@/components/chat/ChatPanel';
import { NodeDetail } from '@/components/node/NodeDetail';
import { RecommendPanel } from './RecommendPanel';
import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';

type TabId = 'chat' | 'detail' | 'recommend';

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [collapsed, setCollapsed] = useState(false);
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

  const tabs = [
    { id: 'chat' as TabId, icon: MessageSquare, label: '对话' },
    { id: 'detail' as TabId, icon: Info, label: '详情' },
    { id: 'recommend' as TabId, icon: Lightbulb, label: '推荐' },
  ];

  if (collapsed) {
    return (
      <div className="w-12 h-full flex flex-col items-center py-3 border-l border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <PanelRightOpen size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[360px] h-full flex flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]">
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
  );
}
