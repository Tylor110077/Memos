'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, Loader2, BookOpen } from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';

interface Recommendation {
  title: string;
  description: string;
  reason: string;
}

export function RecommendPanel() {
  const { nodes, selectedNodeId } = useGraphStore();
  const { setPendingMessage, setChatPanelOpen } = useChatStore();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  useEffect(() => {
    if (!selectedNode) {
      setRecommendations([]);
      return;
    }
    setIsLoading(true);
    fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentNode: { title: selectedNode.title, content: selectedNode.content },
        graph: { nodes: nodes.map(n => ({ title: n.title, type: n.type, level: n.level })), edges: [] },
        type: 'related',
      }),
    })
      .then(res => res.ok ? res.json() : { recommendations: [] })
      .then(data => setRecommendations(data.recommendations || []))
      .catch(() => setRecommendations([]))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id]);

  const handleLearn = (title: string) => {
    setPendingMessage(`给我讲讲${title}`, null);
    setChatPanelOpen(true);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
        {selectedNode ? `「${selectedNode.title}」的延伸` : '知识推荐'}
      </h3>
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
