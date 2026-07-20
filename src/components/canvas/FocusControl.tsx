'use client';

import { useUIStore } from '@/stores/uiStore';
import { useGraphStore } from '@/stores/graphStore';
import { Eye, EyeOff } from 'lucide-react';

export function FocusControl() {
  const { focusMode, focusDegree, setFocusMode, setFocusDegree } = useUIStore();
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);

  // 仅在有选中节点或聚焦模式开启时显示
  if (!selectedNodeId && !focusMode) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-white/10">
      <button
        onClick={() => setFocusMode(!focusMode)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${
          focusMode ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-white/10'
        }`}
      >
        {focusMode ? <Eye size={16} /> : <EyeOff size={16} />}
        <span>{focusMode ? '退出聚焦' : '聚焦模式'}</span>
      </button>
      {focusMode && (
        <div className="flex items-center gap-1 border-l border-white/10 pl-2">
          {[1, 2, 3, 4].map(d => (
            <button
              key={d}
              onClick={() => setFocusDegree(d)}
              className={`w-6 h-6 rounded-full text-xs transition-colors ${
                focusDegree === d ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              {d}
            </button>
          ))}
          <span className="text-xs text-gray-500 ml-1">度</span>
        </div>
      )}
    </div>
  );
}
