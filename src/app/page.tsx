'use client';

import { useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Network, FolderTree } from 'lucide-react';
import { DomainModal } from '@/components/domain/DomainModal';
import { ImportMaterialModal } from '@/components/canvas/ImportMaterialModal';
import { FullScreenDetail } from '@/components/node/FullScreenDetail';
import { RightPanel } from '@/components/panel/RightPanel';
import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { useBoardStore } from '@/stores/boardStore';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useShortcuts } from '@/hooks/useShortcuts';
import { FileTreeView } from '@/components/filetree/FileTreeView';
import { exportService } from '@/lib/export/ExportService';

// React Flow 不支持 SSR，需要动态导入
const Canvas = dynamic(
  () => import('@/components/canvas/Canvas').then((mod) => mod.Canvas),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">画布加载中...</div> }
);

export default function Home() {
  const { initializeGraph, isInitialized } = useGraphStore();
  const { importModalOpen, closeImportModal, viewMode, setViewMode } = useUIStore();
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
      toggleChat: () => {
        window.dispatchEvent(new CustomEvent('studyboard:toggle-chat'));
      },
    }),
    [],
  );
  useShortcuts(shortcutHandlers);

  // 客户端挂载后从 localStorage 水合设置（避免 SSR hydration mismatch）
  useEffect(() => {
    useSettingsStore.getState().hydrate();
    // 尝试恢复之前授权的导出目录 Handle
    exportService.restoreHandle();
  }, []);

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

  // 自动同步 Vault：监听节点变更，debounce 2s 后增量导出
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodes = useGraphStore(s => s.nodes);
  useEffect(() => {
    const { autoSync } = useSettingsStore.getState();
    if (!autoSync || !exportService.isReady) return;
    if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    autoSyncTimerRef.current = setTimeout(async () => {
      try {
        const { nodes: allNodes, edges } = useGraphStore.getState();
        const { boards } = useBoardStore.getState();
        const changedIds = exportService.getChangedNodeIds(allNodes);
        if (changedIds.size > 0) {
          await exportService.exportIncremental(allNodes, edges, boards, changedIds);
        }
      } catch { /* ignore sync errors */ }
    }, 2000);
    return () => { if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current); };
  }, [nodes]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--bg-primary)]">
      {/* 左侧：画布/文件树区域 */}
      <div className="flex-1 relative flex flex-col">
        {/* 视图切换 Tab */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm p-1 shadow-lg">
          <button
            onClick={() => setViewMode('canvas')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'canvas' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
            title="画布视图"
          >
            <Network size={15} />
          </button>
          <button
            onClick={() => setViewMode('filetree')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'filetree' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
            title="文件树视图"
          >
            <FolderTree size={15} />
          </button>
        </div>

        {/* 视图内容 */}
        <div className="flex-1 relative">
          {viewMode === 'canvas' ? <Canvas /> : <FileTreeView />}
        </div>
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
