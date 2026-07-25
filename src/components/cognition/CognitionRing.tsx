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
  const outerR = size / 2 - 2;
  const trackR = outerR - 3; // 进度环轨道半径
  const centerR = trackR - 4; // 中心填充圆半径
  const fillRatio = level / 5;
  const color = LEVEL_COLORS[level] || '#4b5563';

  // 进度弧线路径
  const angle = fillRatio * 360;
  const rad = (angle - 90) * (Math.PI / 180);
  const largeArc = angle > 180 ? 1 : 0;
  const endX = cx + trackR * Math.cos(rad);
  const endY = cy + trackR * Math.sin(rad);

  const arcPath = fillRatio >= 1
    ? `M ${cx} ${cy - trackR} A ${trackR} ${trackR} 0 1 1 ${cx - 0.01} ${cy - trackR}`
    : fillRatio > 0
      ? `M ${cx} ${cy - trackR} A ${trackR} ${trackR} 0 ${largeArc} 1 ${endX} ${endY}`
      : '';

  return (
    <div className="relative inline-flex items-center justify-center overflow-hidden" style={{ width: size, height: size }} title={reason || '尚未评审'}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 外环背景 */}
        <circle cx={cx} cy={cy} r={outerR} fill="var(--bg-tertiary)" stroke="var(--border-strong)" strokeWidth="1.5" opacity="0.6" />
        {/* 进度轨道 */}
        <circle cx={cx} cy={cy} r={trackR} fill="none" stroke="var(--bg-hover)" strokeWidth="3" />
        {/* 进度填充 */}
        {arcPath && (
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            style={{ transition: 'all 600ms ease-out' }}
          />
        )}
        {/* 中心填充圆 */}
        <circle cx={cx} cy={cy} r={centerR} fill={level > 0 ? color : 'var(--bg-hover)'} opacity={level > 0 ? 0.2 : 0.3} style={{ transition: 'all 400ms ease-out' }} />
        {/* 中心档位数字 */}
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={level > 0 ? color : 'var(--text-muted)'}
          fontSize={size * 0.32}
          fontWeight="bold"
          fontFamily="system-ui"
        >
          {level > 0 ? level : '—'}
        </text>
      </svg>
    </div>
  );
}
