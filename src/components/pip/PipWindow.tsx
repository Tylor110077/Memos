'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, GripHorizontal } from 'lucide-react';

interface PipWindowProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onScrollToTop?: () => void;
  children: React.ReactNode;
}

const MIN_SIZE = 160;
const MAX_SIZE = 400;

/** 可拖拽、可调大小的画中画浮窗 */
export function PipWindow({ visible, title, onClose, onScrollToTop, children }: PipWindowProps) {
  const [pos, setPos] = useState({ x: -1, y: -1 }); // -1 表示未初始化（使用默认右下角）
  const [size, setSize] = useState({ w: 240, h: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 });
  const initialized = useRef(false);

  // 初始化位置到右下角
  useEffect(() => {
    if (visible && !initialized.current) {
      setPos({ x: window.innerWidth - 260, y: window.innerHeight - 240 });
      initialized.current = true;
    }
    if (!visible) initialized.current = false;
  }, [visible]);

  // 拖拽标题栏
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  }, [pos]);

  // 拖拽右下角调整大小
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h };
  }, [size]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.mx;
        const dy = e.clientY - dragStart.current.my;
        setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.current.mx;
        const dy = e.clientY - resizeStart.current.my;
        setSize({
          w: Math.min(MAX_SIZE, Math.max(MIN_SIZE, resizeStart.current.w + dx)),
          h: Math.min(MAX_SIZE, Math.max(MIN_SIZE, resizeStart.current.h + dy)),
        });
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isDragging ? 'grabbing' : 'nwse-resize';

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, isResizing]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-[250] rounded-xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden flex flex-col"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      {/* 标题栏：可拖拽 */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border)] cursor-grab active:cursor-grabbing shrink-0 select-none"
      >
        <GripHorizontal size={12} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-[10px] text-[var(--text-muted)] truncate flex-1">{title}</span>
        {onScrollToTop && (
          <button
            onClick={onScrollToTop}
            className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors shrink-0"
          >
            ↑
          </button>
        )}
        <button
          onClick={onClose}
          className="p-0.5 rounded text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* 内容区：可滚动 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>

      {/* 右下角 resize 手柄 */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" className="text-[var(--text-muted)] opacity-50">
          <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
