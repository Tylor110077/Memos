/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

export function KnowledgeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const edgeData = data as Record<string, any> | undefined;
  const isDimmed: boolean = edgeData?.isDimmed ?? false;
  const isHighlighted: boolean = edgeData?.isHighlighted ?? false;
  const isSelected: boolean = edgeData?.isSelected ?? false;

  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: isSelected ? 'var(--accent)' : isHighlighted ? 'var(--text-secondary)' : 'var(--text-muted)',
        strokeWidth: isSelected ? 2.5 : isHighlighted ? 1.5 : 1,
        opacity: isDimmed && !isSelected ? 0.05 : isSelected ? 1 : isHighlighted ? 0.8 : 0.35,
        transition: 'opacity 200ms, stroke 200ms, stroke-width 200ms',
      }}
      interactionWidth={15}
    />
  );
}
