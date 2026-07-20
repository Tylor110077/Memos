'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Dices, BookOpen, Loader2, ChevronDown } from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';

interface BreakthroughRecommendation {
  title: string;
  description: string;
  reason: string;
  category?: 'knowledge' | 'trivia';
}

interface BreakthroughModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BreakthroughModal({ visible, onClose }: BreakthroughModalProps) {
  const { nodes } = useGraphStore();
  const { setChatPanelOpen, setPendingMessage } = useChatStore();
  const [recommendations, setRecommendations] = useState<BreakthroughRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null); // 点击展开完整内容

  const fetchBreakthrough = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph: {
            nodes: nodes.map((n) => ({ title: n.title, type: n.type, level: n.level })),
            edges: [],
          },
          type: 'breakthrough',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        setExpandedIdx(null);
      }
    } catch (e) {
      console.error('破茧推荐获取失败:', e);
    } finally {
      setIsLoading(false);
    }
  }, [nodes]);

  // visible 时自动加载
  useEffect(() => {
    if (visible) {
      fetchBreakthrough();
    }
  }, [visible, fetchBreakthrough]);

  const handleStartLearning = (title: string, category?: 'knowledge' | 'trivia') => {
    onClose();
    setChatPanelOpen(true);
    setPendingMessage(`给我讲讲${title}`, category || null);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 弹窗内容 */}
      <div className="relative w-[480px] max-h-[80vh] bg-[var(--bg-secondary)] rounded-2xl shadow-2xl shadow-black/30 border border-[var(--border)] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Dices size={20} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">随机推荐</h2>
            <span className="text-xs text-[var(--text-muted)]">跳出知识舒适区</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
              <Loader2 size={28} className="animate-spin mb-3" />
              <p className="text-sm">正在寻找意想不到的知识...</p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
              <Dices size={28} className="mb-3" />
              <p className="text-sm">暂无推荐，试试换一个？</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, idx) => {
                const isExpanded = expandedIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      rec.category === 'trivia'
                        ? 'border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-amber-500/10'
                        : 'border-[var(--border)] bg-gradient-to-br from-[var(--accent-soft)] to-transparent'
                    } ${isExpanded ? (rec.category === 'trivia' ? 'border-pink-500/50 shadow-md' : 'border-[var(--accent)] shadow-md') : 'hover:shadow-md'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] flex-1">{rec.title}</h3>
                      {rec.category === 'trivia' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-pink-500/20 text-pink-400">
                          ✨ 趣闻
                        </span>
                      )}
                      <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    <p className={`text-xs text-[var(--text-secondary)] mb-2 ${isExpanded ? 'whitespace-normal leading-relaxed' : 'line-clamp-2'}`}>{rec.description}</p>
                    <p className={`text-xs mb-3 ${rec.category === 'trivia' ? 'text-pink-400' : 'text-[var(--accent)]'}`}>
                      <span className="font-medium">为什么有趣：</span>
                      {rec.reason}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartLearning(rec.title, rec.category); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs rounded-md transition-colors ${
                        rec.category === 'trivia'
                          ? 'bg-pink-500 hover:bg-pink-600'
                          : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                      }`}
                    >
                      <BookOpen size={13} />
                      开始学习
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
          <button
            onClick={fetchBreakthrough}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--accent)] rounded-md hover:bg-[var(--accent-soft)] disabled:opacity-50 transition-colors"
          >
            <Dices size={15} />
            换一个
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-hover)] transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
