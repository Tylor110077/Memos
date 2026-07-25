'use client';

interface CognitionRingProps {
  /** 1-5 认知档位，0 或 undefined 表示未评审 */
  level?: number;
  /** AI 评审理由 */
  reason?: string;
  size?: number;
}

const LEVEL_LABELS = ['', '未理解', '模糊', '基本', '清晰', '精通'];
const LEVEL_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#8b5cf6'];

/** 费曼认知评审同心圆 SVG 组件 */
export function CognitionRing({ level = 0, reason, size = 80 }: CognitionRingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR - 10;
  const fillRatio = level / 5;
  const color = LEVEL_COLORS[level] || '#4b5563';

  // 内环弧线路径
  const angle = fillRatio * 360;
  const rad = (angle - 90) * (Math.PI / 180);
  const largeArc = angle > 180 ? 1 : 0;
  const endX = cx + innerR * Math.cos(rad);
  const endY = cy + innerR * Math.sin(rad);

  const arcPath = fillRatio >= 1
    ? `M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 1 ${cx - 0.01} ${cy - innerR}`
    : fillRatio > 0
      ? `M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 ${largeArc} 1 ${endX} ${endY}`
      : '';

  return (
    <div className="relative inline-flex items-center justify-center" title={reason || '尚未评审'}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 外环：知识范围（灰色底环） */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--border-strong)" strokeWidth="3" opacity="0.4" />
        {/* 内环底色 */}
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="var(--bg-hover)" strokeWidth="6" />
        {/* 内环填充：理解程度 */}
        {arcPath && (
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            style={{ transition: 'all 600ms ease-out' }}
          />
        )}
        {/* 中心档位数字 */}
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={level > 0 ? color : 'var(--text-muted)'}
          fontSize={size * 0.28}
          fontWeight="bold"
          fontFamily="system-ui"
        >
          {level > 0 ? level : '—'}
        </text>
      </svg>
      {/* 档位文字标签 */}
      {level > 0 && (
        <span
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap font-medium"
          style={{ color }}
        >
          {LEVEL_LABELS[level]}
        </span>
      )}
    </div>
  );
}
