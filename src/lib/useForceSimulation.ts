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

/** 边界约束力：当节点超出半径时 gentle 拉回，防止无限向外扩散 */
function forceContain(radius: number, strength: number) {
  let containedNodes: SimNode[] = [];
  function force(alpha: number) {
    for (const node of containedNodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const dist = Math.sqrt(x * x + y * y);
      if (dist > radius && dist > 0) {
        const pull = ((dist - radius) / dist) * strength * alpha;
        node.vx = (node.vx ?? 0) - x * pull;
        node.vy = (node.vy ?? 0) - y * pull;
      }
    }
  }
  force.initialize = (n: SimNode[]) => {
    containedNodes = n;
  };
  return force;
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
      .force('charge', forceManyBody().strength(-80).distanceMax(260))
      .force('center', forceCenter(0, 0).strength(0.08))
      .force('collide', forceCollide(25))
      .force('contain', forceContain(900, 0.35)) // 边界约束：超出 900 半径拉回，防止无限扩散
      .alphaDecay(0.025) // 较慢衰减，让回弹振荡更充分持久
      .velocityDecay(0.4) // 较低阻尼，保留弹性振荡感
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

  // 拖拽开始时固定节点并温和重新激活模拟（低能量，避免其他节点被持续推飞）
  const dragStart = useCallback((nodeId: string) => {
    const sim = simRef.current;
    if (!sim) return;
    sim.alphaTarget(0.04).restart();
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  // 拖拽结束时释放节点，并重新加热模拟，让被拉远的节点充分回弹
  const dragEnd = useCallback((nodeId: string) => {
    const sim = simRef.current;
    if (!sim) return;
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    // 重新加热到较高能量，使弹簧力有足够能量回弹；随后自然衰减至稳定
    sim.alphaTarget(0).alpha(0.6).restart();
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
