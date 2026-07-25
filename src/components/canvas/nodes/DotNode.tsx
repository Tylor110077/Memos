/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileTypeIcon } from '@/components/shared/FileTypeIcon';
import { useSettingsStore } from '@/stores/settingsStore';

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

  // 大小：level 越低（越重要）越大
  const size = level === 0 ? 14 : level === 1 ? 11 : level === 2 ? 9 : 7;

  // unlit 节点显示为暗灰色，否则从配置读取颜色
  const color = isUnlit ? '#4b5563' : (nodeColors[nodeType] || TYPE_COLORS[nodeType] || 'var(--text-muted)');

  // 文件类型节点：用文件图标替代圆点
  const isFileNode = nodeType === 'material' && !!materialType;
  const fileIconSize = level === 0 ? 28 : level === 1 ? 24 : level === 2 ? 20 : 16;

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
