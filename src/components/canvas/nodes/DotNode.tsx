/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect } from 'react';
import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react';
import { FileTypeIcon } from '@/components/shared/FileTypeIcon';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { NodeCard } from './NodeCard';
import type { KnowledgeNode } from '@/types';

// 各节点类型对应的颜色（从 CSS 变量读取）
const TYPE_COLORS: Record<string, string> = {
  concept: 'var(--node-concept)',
  theme: 'var(--node-theme)',
  material: 'var(--node-material)',
  understanding: 'var(--node-understanding)',
  question: 'var(--node-question)',
};

// 认知档位颜色
const COGNITION_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#8b5cf6',
};

/**
 * Obsidian Graph View 风格的极简圆点节点（共享基础组件）
 * 所有节点类型复用此组件，颜色由 data.type 决定
 */
export function DotNode({ data, selected }: NodeProps) {
  const node = data as Record<string, any>;
  const nodeColors = useSettingsStore((s) => s.nodeColors);
  const isEvaluating = useGraphStore((s) => s.evaluatingNodeIds.has(node.id as string));
  const { zoom } = useViewport();

  // 缩放感知：zoom 越大文字越清晰，越小越模糊/透明（模仿 Obsidian）
  // 模糊更慢：zoom >= 0.8 完全清晰；0.5~0.8 逐渐加模糊；< 0.35 隐藏
  const labelOpacity = zoom < 0.35 ? 0 : zoom < 0.6 ? Math.min(1, (zoom - 0.35) / 0.25) : 1;
  const labelBlur = zoom >= 0.8 ? 0 : zoom >= 0.5 ? ((0.8 - zoom) / 0.3) * 2 : 2;
  const isDimmed: boolean = node.isDimmed ?? false;
  const isHovered: boolean = node.isHovered ?? false;
  const isMultiSelected: boolean = node.isMultiSelected ?? false;
  const isUnlit: boolean = node.status === 'unlit';
  const level: number = node.level ?? 2;
  const title: string = node.title ?? '';
  const nodeType: string = node.type ?? 'concept';
  const materialType: string | undefined = node.metadata?.materialType;
  const fileName: string | undefined = node.metadata?.source;
  const cognitionLevel: number | undefined = node.cognitionLevel;

  // 内联编辑标题：仅在节点刚创建时（2秒内）自动进入编辑模式
  const isJustCreated = (() => {
    const createdAt = node.metadata?.createdAt;
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() < 2000;
  })();
  const [isEditingTitle, setIsEditingTitle] = useState(isJustCreated && title === '新节点');
  const [editTitle, setEditTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  // 点击 input 外部时自动提交编辑（使用 capture 阶段，绕过 React Flow 事件拦截）
  useEffect(() => {
    if (!isEditingTitle) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        commitTitle();
      }
    };
    // 延迟绑定，避免创建时的 mousedown 事件立即触发
    const timer = setTimeout(() => document.addEventListener('mousedown', handleMouseDown, true), 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleMouseDown, true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingTitle, editTitle]);

  const commitTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== title) {
      useGraphStore.getState().updateNode(node.id as string, { title: trimmed });
    } else if (!trimmed) {
      setEditTitle(title); // 空标题回退
    }
    setIsEditingTitle(false);
  };

  // 大小：level 越低（越重要）越大
  const size = level === 0 ? 14 : level === 1 ? 11 : level === 2 ? 9 : 7;

  // unlit 节点显示为暗灰色，否则从配置读取颜色
  const color = isUnlit ? '#4b5563' : (nodeColors[nodeType] || TYPE_COLORS[nodeType] || 'var(--text-muted)');

  // 文件类型节点：用文件图标替代圆点
  const isFileNode = nodeType === 'material' && !!materialType;
  const fileIconSize = level === 0 ? 28 : level === 1 ? 24 : level === 2 ? 20 : 16;

  // 卡片形态：该节点在卡片集合中时渲染 NodeCard（含 Handles 以保留连线）
  const isCard = useUIStore((s) => s.cardNodeIds.includes(node.id as string));
  const openFullScreen = useUIStore((s) => s.openFullScreen);
  if (isCard) {
    return (
      <div className="relative" style={{ opacity: isDimmed ? 0.15 : 1 }}>
        {/* 卡片形态：手柄放在左右边缘，可抓取连线 */}
        <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 10, height: 24, minWidth: 0, border: 'none', background: 'transparent', cursor: 'crosshair' }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 10, height: 24, minWidth: 0, border: 'none', background: 'transparent', cursor: 'crosshair' }} />
        <NodeCard node={node as unknown as KnowledgeNode} selected={selected} onOpenDetail={() => openFullScreen(node.id as string)} />
      </div>
    );
  }

  return (
    <div
      className="relative transition-opacity duration-200 flex items-center justify-center"
      style={{ opacity: isDimmed ? 0.15 : 1, width: isFileNode ? fileIconSize : size, height: isFileNode ? fileIconSize : size }}
    >
      {/* Handle 精确居中于节点（零尺寸，无偏移） */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: 'none', padding: 0, margin: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: 'none', padding: 0, margin: 0 }} />

      {isFileNode ? (
        /* 文件类型节点：直接用文件图标 */
        <div
          className="transition-transform duration-150"
          style={{
            transform: isHovered ? 'scale(1.2)' : 'scale(1)',
            filter: isMultiSelected
              ? 'drop-shadow(0 0 3px var(--accent))'
              : isHovered || selected ? 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' : 'none',
          }}
        >
          <FileTypeIcon type={materialType} fileName={fileName} size={fileIconSize} />
        </div>
      ) : (
        /* 普通节点：圆点 + 认知环 */
        <>
          {/* 认知环：有评审结果时显示外圈 */}
          {cognitionLevel && cognitionLevel > 0 && (
            <svg
              className="absolute"
              width={size + 8}
              height={size + 8}
              viewBox={`0 0 ${size + 8} ${size + 8}`}
              style={{ top: -4, left: -4 }}
            >
              <circle
                cx={(size + 8) / 2}
                cy={(size + 8) / 2}
                r={(size + 6) / 2}
                fill="none"
                stroke={COGNITION_COLORS[cognitionLevel]}
                strokeWidth="1.5"
                strokeDasharray={`${(cognitionLevel / 5) * Math.PI * (size + 6)} ${Math.PI * (size + 6)}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${(size + 8) / 2} ${(size + 8) / 2})`}
                opacity="0.8"
              />
            </svg>
          )}
          <div
            className="w-full h-full rounded-full transition-transform duration-150"
            style={{
              backgroundColor: color,
              boxShadow: isMultiSelected
                ? `0 0 0 2px var(--bg-primary), 0 0 0 3.5px var(--accent)`
                : isHovered || selected ? `0 0 8px ${color}` : 'none',
              transform: isHovered ? 'scale(1.4)' : 'scale(1)',
            }}
          />
        </>
      )}

      {/* 文字标签（绝对定位，不影响节点尺寸，缩放感知模糊） */}
      {isEditingTitle ? (
        <input
          ref={inputRef}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] leading-tight text-center w-[80px] bg-[var(--bg-primary)] border border-[var(--accent)] rounded px-1 py-0.5 text-[var(--text-primary)] outline-none z-20"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
            if (e.key === 'Escape') { setEditTitle(title); setIsEditingTitle(false); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] leading-tight text-center max-w-[80px] truncate select-none whitespace-nowrap cursor-text"
          style={{
            color: isHovered || selected ? 'var(--text-primary)' : 'var(--text-muted)',
            opacity: labelOpacity,
            filter: labelBlur > 0 ? `blur(${labelBlur}px)` : 'none',
            transition: 'opacity 0.2s, filter 0.2s',
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditTitle(title);
            setIsEditingTitle(true);
          }}
        >
          {title}
        </span>
      )}

      {/* 认知评审等待动画：围绕节点旋转的圆环 */}
      {isEvaluating && (
        <svg
          className="absolute animate-spin"
          width={size + 14}
          height={size + 14}
          viewBox={`0 0 ${size + 14} ${size + 14}`}
          style={{ top: -(size + 14) / 2 + size / 2, left: -(size + 14) / 2 + size / 2, animationDuration: '1.2s' }}
        >
          <circle
            cx={(size + 14) / 2}
            cy={(size + 14) / 2}
            r={(size + 12) / 2}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeDasharray={`${Math.PI * (size + 12) * 0.3} ${Math.PI * (size + 12) * 0.7}`}
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      )}
    </div>
  );
}
