/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
} from 'd3-force';
import type { KnowledgeNode, KnowledgeEdge } from '@/types';

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink {
  source: string;
  target: string;
}

export function useForceSimulation(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  onTick: (positions: Map<string, { x: number; y: number }>) => void,
) {
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    // 创建模拟节点（保留已有位置作为初始位置）
    const simNodes: SimNode[] = nodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));
    nodesRef.current = simNodes;

    const simLinks: SimLink[] = edges
      .filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
      }));

    // 创建力模拟
    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simLinks as any)
          .id((d: any) => d.id)
          .distance(80)
          .strength(0.6),
      )
      .force('charge', forceManyBody().strength(-100).distanceMax(300))
      .force('center', forceCenter(0, 0).strength(0.1))
      .force('collide', forceCollide(25))
      .alphaDecay(0.05) // 快速收敛，约2秒后停止
      .velocityDecay(0.5) // 阻尼
      .on('tick', () => {
        const positions = new Map<string, { x: number; y: number }>();
        for (const node of nodesRef.current) {
          positions.set(node.id, { x: node.x, y: node.y });
        }
        onTickRef.current(positions);
      });

    // 模拟收敛后自动停止（不再持续微动，避免持续重渲染）
    sim.alphaMin(0.01);

    simRef.current = sim;

    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  // 拖拽开始时固定节点并重新激活模拟
  const dragStart = useCallback((nodeId: string) => {
    const sim = simRef.current;
    if (!sim) return;
    sim.alphaTarget(0.1).restart();
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  // 拖拽结束时释放节点
  const dragEnd = useCallback((nodeId: string) => {
    const sim = simRef.current;
    if (!sim) return;
    sim.alphaTarget(0);
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  }, []);

  // 拖拽过程中更新固定位置
  const dragMove = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }, []);

  return { dragStart, dragEnd, dragMove };
}
