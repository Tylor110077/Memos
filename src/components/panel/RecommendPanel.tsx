'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Loader2, BookOpen, RefreshCw } from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import { useBoardStore } from '@/stores/boardStore';
import { getCachedRecommendations, saveRecommendations, clearRecommendations } from '@/lib/db';
import { useSettingsStore } from '@/stores/settingsStore';
import { apiFetch } from '@/lib/directApi';

interface Recommendation {
  title: string;
  description: string;
  reason: string;
}

export function RecommendPanel() {
  const { nodes, selectedNodeId } = useGraphStore();
  const { setPendingMessage, setChatPanelOpen } = useChatStore();
  const { currentBoardId } = useBoardStore();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // 从 API 获取推荐并缓存
  const fetchFromAPI = useCallback(async (nodeId: string, skipCache = false) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (!skipCache) {
      const cached = await getCachedRecommendations(nodeId);
      if (cached && cached.length > 0) {
        setRecommendations(cached);
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await apiFetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentNode: { title: node.title, content: node.content },
          graph: { nodes: nodes.map(n => ({ title: n.title, type: n.type, level: n.level })), edges: [] },
          type: 'related',
          apiKey: useSettingsStore.getState().apiKey || undefined,
        }),
      });
      const data = res.ok ? await res.json() : { recommendations: [] };
      const results = data.recommendations || [];
      setRecommendations(results);
      // 缓存结果
      if (results.length > 0 && currentBoardId) {
        await saveRecommendations(nodeId, currentBoardId, results);
      }
    } catch {
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, [nodes, currentBoardId]);

  useEffect(() => {
    if (!selectedNode) {
      setRecommendations([]);
      return;
    }
    fetchFromAPI(selectedNode.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id]);

  // 换一批：清除缓存 → 重新调 API → 保存新结果
  const handleRefresh = useCallback(async () => {
    if (!selectedNode) return;
    await clearRecommendations(selectedNode.id);
    await fetchFromAPI(selectedNode.id, true);
  }, [selectedNode, fetchFromAPI]);

  const handleLearn = (title: string) => {
    setPendingMessage(`给我讲讲${title}`, null);
    setChatPanelOpen(true);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          {selectedNode ? `「${selectedNode.title}」的延伸` : '知识推荐'}
        </h3>
        {recommendations.length > 0 && (
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50 transition-colors"
            title="换一批推荐"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            换一批
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        {selectedNode ? '基于当前节点推荐相关知识' : '选中一个节点查看推荐'}
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
          <Lightbulb size={24} className="mb-2 opacity-50" />
          <p className="text-xs">{selectedNode ? '暂无推荐' : '请先选中一个节点'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] hover:border-[var(--accent)] transition-colors"
            >
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">{rec.title}</h4>
              <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">{rec.reason}</p>
              <button
                onClick={() => handleLearn(rec.title)}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                <BookOpen size={12} /> 开始学习
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
