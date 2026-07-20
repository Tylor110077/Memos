'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore } from '@/stores/graphStore';

// Excalidraw 依赖浏览器 API，必须动态导入（ssr: false）
// 0.18+ 版本样式会自动注入，无需手动引入 CSS
const Excalidraw = dynamic(
  async () => {
    const mod = await import('@excalidraw/excalidraw');
    return mod.Excalidraw;
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center text-[var(--text-muted)] text-sm">
        白板加载中...
      </div>
    ),
  },
);

interface WhiteboardProps {
  nodeId: string;
}

/** 解析节点 whiteboard 字段（JSON 字符串）为 Excalidraw elements */
function parseElements(raw?: string): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Excalidraw 白板组件
 *
 * - 挂载时从 graphStore 读取节点 whiteboard 字段作为初始数据
 * - onChange 时 debounce 1 秒写回 graphStore（避免高频写入 IndexedDB）
 * - 需要父容器提供明确高度（Excalidraw 依赖父容器尺寸）
 */
export function Whiteboard({ nodeId }: WhiteboardProps) {
  const updateNode = useGraphStore((s) => s.updateNode);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始数据：仅在挂载（或 nodeId 变化）时读取一次，避免 写入→读取→重置画布 的循环
  const [initial, setInitial] = useState(() => {
    const node = useGraphStore.getState().nodes.find((n) => n.id === nodeId);
    return { nodeId, elements: parseElements(node?.whiteboard) };
  });

  // nodeId 变化时重新加载初始数据
  useEffect(() => {
    if (initial.nodeId !== nodeId) {
      const node = useGraphStore.getState().nodes.find((n) => n.id === nodeId);
      setInitial({ nodeId, elements: parseElements(node?.whiteboard) });
    }
  }, [nodeId, initial.nodeId]);

  const handleChange = useCallback(
    (elements: readonly any[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNode(nodeId, { whiteboard: JSON.stringify(elements) });
      }, 1000);
    },
    [nodeId, updateNode],
  );

  // 卸载时清理未完成的 debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full min-h-[300px]">
      <Excalidraw
        key={initial.nodeId}
        initialData={{ elements: initial.elements }}
        onChange={handleChange}
        theme="dark"
      />
    </div>
  );
}
