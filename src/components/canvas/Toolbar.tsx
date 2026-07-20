'use client';

import { useState } from 'react';
import { Globe, Link2, Maximize, ZoomIn, ZoomOut, Dices, Download } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useUIStore } from '@/stores/uiStore';
import { useGraphStore } from '@/stores/graphStore';
import { BreakthroughModal } from './BreakthroughModal';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

export function Toolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const openDomainModal = useUIStore((s) => s.openDomainModal);
  const openImportModal = useUIStore((s) => s.openImportModal);
  const [breakthroughOpen, setBreakthroughOpen] = useState(false);

  const handleExport = () => {
    const { nodes, edges } = useGraphStore.getState();
    const data = {
      version: '0.0.1',
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memos-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buttonClass =
    'p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors';

  return (
    <>
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm p-1.5 shadow-lg">
      <button
        onClick={openDomainModal}
        className={buttonClass}
        title="生成领域图谱"
      >
        <Globe size={18} />
      </button>

      <button
        onClick={openImportModal}
        className={buttonClass}
        title="导入材料"
      >
        <Link2 size={18} />
      </button>

      <button
        onClick={() => setBreakthroughOpen(true)}
        className={buttonClass}
        title="给我个惊喜"
      >
        <Dices size={18} />
      </button>

      <button
        onClick={handleExport}
        className={buttonClass}
        title="导出图谱"
      >
        <Download size={18} />
      </button>

      <div className="my-1 border-t border-[var(--border)]" />

      <button
        onClick={() => fitView({ duration: 300 })}
        className={buttonClass}
        title="适配视图"
      >
        <Maximize size={18} />
      </button>

      <button
        onClick={() => zoomIn({ duration: 200 })}
        className={buttonClass}
        title="放大"
      >
        <ZoomIn size={18} />
      </button>

      <button
        onClick={() => zoomOut({ duration: 200 })}
        className={buttonClass}
        title="缩小"
      >
        <ZoomOut size={18} />
      </button>
    
      <div className="my-1 border-t border-[var(--border)]" />
    
      <ThemeSwitcher />
    
      {/* 破茧推荐弹窗（渲染在 Toolbar 外层，以避免 fixed 定位被影响） */}
    </div>
    <BreakthroughModal visible={breakthroughOpen} onClose={() => setBreakthroughOpen(false)} />
    </>
  );
}
