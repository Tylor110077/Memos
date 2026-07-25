'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, StickyNote, Plus, GripHorizontal, Lightbulb, Loader2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';

interface SelectionPopupProps {
  text: string;
  initialX: number;
  initialY: number;
  onClose: () => void;
  onAddToNote?: () => void;
  onAppendToNote?: (noteId?: string) => void;
  onCreateNode?: () => void;
  /** 当前节点的笔记列表，用于续写时选择目标 */
  notes?: { id: string; content: string }[];
  /** 是否禁用笔记操作（无选中节点时） */
  noteDisabled?: boolean;
  noteDisabledHint?: string;
}

const MIN_W = 200;
const MIN_H = 100;
const MAX_W = 450;
const MAX_H = 400;

/** 可拖拽、可调大小、可滚动的圈选操作浮层 */
export function SelectionPopup({
  text,
  initialX,
  initialY,
  onClose,
  onAddToNote,
  onAppendToNote,
  onCreateNode,
  notes = [],
  noteDisabled = false,
  noteDisabledHint = '先选中一个节点',
}: SelectionPopupProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ w: 280, h: 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 });
  const popupRef = useRef<HTMLDivElement>(null);
  const { apiKey } = useSettingsStore();

  // 点击浮层外部自动关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 延迟绑定，避免触发圈选的 mouseup 立即关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // 初始化位置（确保不超出视口）
  useEffect(() => {
    setPos({
      x: Math.min(initialX, window.innerWidth - 280),
      y: Math.min(initialY + 8, window.innerHeight - 160),
    });
  }, [initialX, initialY]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  }, [pos]);

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
        setPos({
          x: dragStart.current.px + e.clientX - dragStart.current.mx,
          y: dragStart.current.py + e.clientY - dragStart.current.my,
        });
      }
      if (isResizing) {
        setSize({
          w: Math.min(MAX_W, Math.max(MIN_W, resizeStart.current.w + e.clientX - resizeStart.current.mx)),
          h: Math.min(MAX_H, Math.max(MIN_H, resizeStart.current.h + e.clientY - resizeStart.current.my)),
        });
      }
    };
    const handleUp = () => { setIsDragging(false); setIsResizing(false); };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, isResizing]);

  const handleExplain = async () => {
    setIsExplaining(true);
    setExplanation(null);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, apiKey: apiKey || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setExplanation(data.explanation);
        // 自动扩大窗口以展示解释内容
        setSize(s => ({ ...s, h: Math.max(s.h, 300), w: Math.max(s.w, 320) }));
      }
    } catch { /* ignore */ }
    finally { setIsExplaining(false); }
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-[999] rounded-xl border border-[var(--border-strong)] bg-[var(--bg-primary)] shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, animation: 'fadeIn 120ms ease-out' }}
    >
      {/* 拖拽标题栏 */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border)] cursor-grab active:cursor-grabbing shrink-0 select-none"
      >
        <GripHorizontal size={11} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-[10px] text-[var(--text-muted)] truncate flex-1">圈选内容</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {explanation ? (
          <div className="text-xs text-[var(--text-primary)] leading-relaxed">
            <MarkdownRenderer content={explanation} className="text-xs" />
          </div>
        ) : (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">“{text}”</p>
        )}
      </div>
      
      {/* 操作按钮栏 */}
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] shrink-0 flex-wrap">
        <button
          onClick={handleExplain}
          disabled={isExplaining}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
          title="AI 简要解释"
        >
          {isExplaining ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={10} />}
          {isExplaining ? '解析中' : '解释'}
        </button>
        {onCreateNode && (
          <button
            onClick={onCreateNode}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
            title="基于圈选内容生成知识节点"
          >
            <Plus size={10} />
            生成节点
          </button>
        )}
        {onAddToNote && (
          <button
            onClick={onAddToNote}
            disabled={noteDisabled}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-hover)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={noteDisabled ? noteDisabledHint : '加入笔记'}
          >
            <StickyNote size={10} />
            加入笔记
          </button>
        )}
        {onAppendToNote && (
          <div className="relative">
            <button
              onClick={() => {
                if (notes.length <= 1) {
                  onAppendToNote(notes[0]?.id);
                } else {
                  setShowNotePicker(v => !v);
                }
              }}
              disabled={noteDisabled}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={noteDisabled ? noteDisabledHint : '续写到笔记'}
            >
              续写 ⊕
            </button>
            {showNotePicker && notes.length > 1 && (
              <div className="absolute bottom-full left-0 mb-1 w-48 max-h-[150px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl py-1 z-10">
                <p className="px-2 py-1 text-[9px] text-[var(--text-muted)]">选择续写目标：</p>
                {notes.map((note, i) => (
                  <button
                    key={note.id}
                    onClick={() => { onAppendToNote(note.id); setShowNotePicker(false); }}
                    className="w-full text-left px-2 py-1.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] truncate transition-colors"
                  >
                    笔记 {i + 1}：{note.content.slice(0, 20) || '空'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
