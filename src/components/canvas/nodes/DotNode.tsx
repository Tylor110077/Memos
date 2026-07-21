/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileTypeIcon } from '@/components/shared/FileTypeIcon';

// 各节点类型对应的颜色（从 CSS 变量读取）
const TYPE_COLORS: Record<string, string> = {
  concept: 'var(--node-concept)',
  theme: 'var(--node-theme)',
  material: 'var(--node-material)',
  understanding: 'var(--node-understanding)',
  question: 'var(--node-question)',
};

/**
 * Obsidian Graph View 风格的极简圆点节点（共享基础组件）
 * 所有节点类型复用此组件，颜色由 data.type 决定
 */
export function DotNode({ data, selected }: NodeProps) {
  const node = data as Record<string, any>;
  const isDimmed: boolean = node.isDimmed ?? false;
  const isHovered: boolean = node.isHovered ?? false;
  const isMultiSelected: boolean = node.isMultiSelected ?? false;
  const isUnlit: boolean = node.status === 'unlit';
  const level: number = node.level ?? 2;
  const title: string = node.title ?? '';
  const nodeType: string = node.type ?? 'concept';
  const materialType: string | undefined = node.metadata?.materialType;
  const fileName: string | undefined = node.metadata?.source;

  // 大小：level 越低（越重要）越大
  const size = level === 0 ? 14 : level === 1 ? 11 : level === 2 ? 9 : 7;

  // unlit 节点显示为暗灰色
  const color = isUnlit ? '#4b5563' : (TYPE_COLORS[nodeType] ?? 'var(--text-muted)');

  return (
    <div
      className="relative transition-opacity duration-200"
      style={{ opacity: isDimmed ? 0.15 : 1, width: size, height: size }}
    >
      {/* Handle 精确居中于圆点（零尺寸，无偏移） */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: 'none', padding: 0, margin: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: 'none', padding: 0, margin: 0 }} />

      {/* 圆点 */}
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

      {/* 文件类型图标（材料节点且有文件类型时显示） */}
      {nodeType === 'material' && materialType && (
        <div className="absolute -top-1 -right-3">
          <FileTypeIcon type={materialType} fileName={fileName} size={14} />
        </div>
      )}

      {/* 文字标签（绝对定位，不影响节点尺寸） */}
      <span
        className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] leading-tight text-center max-w-[80px] truncate transition-colors duration-150 select-none whitespace-nowrap"
        style={{ color: isHovered || selected ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
        {title}
      </span>
    </div>
  );
}
