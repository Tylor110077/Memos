'use client';

import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { DomainModal } from '@/components/domain/DomainModal';
import { ImportMaterialModal } from '@/components/canvas/ImportMaterialModal';
import { FullScreenDetail } from '@/components/node/FullScreenDetail';
import { RightPanel } from '@/components/panel/RightPanel';
import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { useBoardStore } from '@/stores/boardStore';
import { useChatStore } from '@/stores/chatStore';
import { useShortcuts } from '@/hooks/useShortcuts';

// React Flow 不支持 SSR，需要动态导入
const Canvas = dynamic(
  () => import('@/components/canvas/Canvas').then((mod) => mod.Canvas),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">画布加载中...</div> }
);

export default function Home() {
  const { initializeGraph, isInitialized } = useGraphStore();
  const { importModalOpen, closeImportModal } = useUIStore();
  const { initializeBoards, isInitialized: boardsReady, currentBoardId } = useBoardStore();

  // 全局快捷键
  const shortcutHandlers = useMemo(
    () => ({
      focusChat: () => {
        useChatStore.getState().setChatPanelOpen(true);
        // 等待面板渲染后聚焦输入框
        setTimeout(() => {
          const el = document.getElementById('chat-input');
          el?.focus();
        }, 50);
      },
      newChat: () => {
        useChatStore.getState().setChatPanelOpen(true);
        useChatStore.getState().triggerReset();
      },
      fitView: () => {
        window.dispatchEvent(new CustomEvent('studyboard:fit-view'));
      },
    }),
    [],
  );
  useShortcuts(shortcutHandlers);

  // 初始化画板
  useEffect(() => {
    if (!boardsReady) initializeBoards();
  }, [boardsReady, initializeBoards]);

  // 画板切换时重新加载图谱
  useEffect(() => {
    if (boardsReady && currentBoardId) {
      initializeGraph(currentBoardId);
    }
  }, [boardsReady, currentBoardId, initializeGraph]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--bg-primary)]">
      {/* 左侧：画布区域 */}
      <div className="flex-1 relative">
        <Canvas />
      </div>

      {/* 右侧：统一面板 */}
      <RightPanel />

      {/* 领域图谱生成弹窗 */}
      <DomainModal />

      {/* 导入材料弹窗 */}
      <ImportMaterialModal visible={importModalOpen} onClose={closeImportModal} />

      {/* 节点全屏详情 */}
      <FullScreenDetail />
    </div>
  );
}
