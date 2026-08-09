'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { apiFetch } from '@/lib/directApi';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import { X, Trash2, Split, Loader2, MessageSquare, Lightbulb, BookOpen, Info, RefreshCw, Sparkles, StickyNote, PenTool, Download } from 'lucide-react';
import { getCachedRecommendations, saveRecommendations, clearRecommendations } from '@/lib/db';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { CognitionRing } from '@/components/cognition/CognitionRing';
import type { NodeType, KnowledgeNode, KnowledgeEdge, NoteEntry } from '@/types';

interface RelatedRecommendation {
  title: string;
  description: string;
  reason: string;
}

const typeLabels: Record<NodeType, string> = {
  concept: '概念',
  theme: '主题',
  material: '材料',
  understanding: '理解',
  question: '问题',
};

const typeColors: Record<NodeType, string> = {
  concept: 'bg-blue-500/20 text-blue-400',
  theme: 'bg-purple-500/20 text-purple-400',
  material: 'bg-green-500/20 text-green-400',
  understanding: 'bg-amber-500/20 text-amber-400',
  question: 'bg-red-500/20 text-red-400',
};

const noteKindLabels: Record<NoteEntry['kind'], string> = {
  manual: '手动',
  chat: '对话摘录',
  question: '我的提问',
};

const noteKindColors: Record<NoteEntry['kind'], string> = {
  manual: 'bg-blue-500/20 text-blue-400',
  chat: 'bg-purple-500/20 text-purple-400',
  question: 'bg-amber-500/20 text-amber-400',
};

export function NodeDetail() {
  const { nodeDetailOpen, nodeDetailId, closeNodeDetail } = useUIStore();
  const { autoRecommend, apiKey } = useSettingsStore();
  const { nodes, edges, updateNode, removeNode, applyGraphChanges } = useGraphStore();
  const { setPendingMessage, setChatPanelOpen } = useChatStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitInstruction, setSplitInstruction] = useState('');
  const [relatedRecommendations, setRelatedRecommendations] = useState<RelatedRecommendation[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<string | null>(null);
  const inFlightNodeRef = useRef<string | null>(null); // 防止同一节点重复并发请求

  const node = nodes.find((n) => n.id === nodeDetailId);

  // 调用推荐 API（带重试，不处理缓存与 loading 状态）
  const requestRecommendations = useCallback(async (targetNode: KnowledgeNode): Promise<RelatedRecommendation[]> => {
    const doFetch = async (): Promise<RelatedRecommendation[]> => {
      const res = await apiFetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentNode: { title: targetNode.title, content: targetNode.content, notes: (targetNode.notes || []).map(n => n.content) },
          graph: { nodes: nodes.map(n => ({ title: n.title, type: n.type, level: n.level })), edges: [] },
          type: 'related',
          apiKey: apiKey || undefined,
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.recommendations || []).slice(0, 3);
    };
    // 首次失败/为空时重试一次，减少"暂无推荐"的误报
    let recs = await doFetch();
    if (recs.length === 0) {
      recs = await doFetch();
    }
    return recs;
  }, [nodes]);

  // 加载推荐（优先缓存，未命中则请求 API 并写入缓存），带防重复并发
  const loadRecommendations = useCallback(async (targetNode: KnowledgeNode, cancelledRef: { current: boolean }) => {
    // 1. 先查缓存
    try {
      const cached = await getCachedRecommendations(targetNode.id);
      if (cached && cached.length > 0) {
        if (!cancelledRef.current) setRelatedRecommendations(cached as RelatedRecommendation[]);
        return;
      }
    } catch (error) {
      console.error('读取推荐缓存失败:', error);
    }
    // 2. 缓存未命中 → 请求 API 并写入缓存
    if (cancelledRef.current) return;
    if (inFlightNodeRef.current === targetNode.id) return;
    inFlightNodeRef.current = targetNode.id;
    setIsLoadingRecommendations(true);
    try {
      const recs = await requestRecommendations(targetNode);
      if (cancelledRef.current) return;
      setRelatedRecommendations(recs);
      if (recs.length > 0) {
        await saveRecommendations(targetNode.id, targetNode.boardId, recs);
      }
    } catch (error) {
      console.error('获取相关推荐失败:', error);
    } finally {
      if (inFlightNodeRef.current === targetNode.id) inFlightNodeRef.current = null;
      if (!cancelledRef.current) setIsLoadingRecommendations(false);
    }
  }, [requestRecommendations]);

  // 当面板打开时：根据设置决定是否自动加载推荐
  useEffect(() => {
    setExpandedIdx(null);
    if (!nodeDetailOpen || !node) {
      setRelatedRecommendations([]);
      setIsLoadingRecommendations(false);
      return;
    }
    // 关闭自动推荐时：仍然先查缓存，有缓存直接显示，只是不自动发 API 请求
    if (!autoRecommend) {
      setRelatedRecommendations([]);
      setIsLoadingRecommendations(false);
      // 异步查缓存，命中则直接展示
      getCachedRecommendations(node.id).then(cached => {
        if (cached && cached.length > 0) {
          setRelatedRecommendations(cached as RelatedRecommendation[]);
        }
      }).catch(() => {});
      return;
    }
    const cancelledRef = { current: false };
    loadRecommendations(node, cancelledRef);
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeDetailOpen, nodeDetailId, autoRecommend]);

  // 手动生成相关推荐（点击按钮触发）
  const handleGenerateRecommendations = useCallback(() => {
    if (!node || isLoadingRecommendations) return;
    const cancelledRef = { current: false };
    loadRecommendations(node, cancelledRef);
  }, [node, isLoadingRecommendations, loadRecommendations]);

  // 换一批：清除缓存 → 重新请求 → 保存缓存 → 更新显示
  const handleRefreshRecommendations = useCallback(async () => {
    if (!node || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await clearRecommendations(node.id);
      const recs = await requestRecommendations(node);
      setRelatedRecommendations(recs);
      setExpandedIdx(null);
      if (recs.length > 0) {
        await saveRecommendations(node.id, node.boardId, recs);
      }
    } catch (error) {
      console.error('刷新推荐失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [node, isRefreshing, requestRecommendations]);

  const handleLearnRecommendation = (title: string) => {
    closeNodeDetail();
    setChatPanelOpen(true);
    setPendingMessage(`给我讲讲${title}`);
  };

  if (!nodeDetailOpen || !nodeDetailId || !node) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-[var(--text-muted)]">
        <Info size={24} className="mb-2 opacity-50" />
        <p className="text-xs">点击画布中的节点查看详情</p>
      </div>
    );
  }

  const handleSplit = async () => {
    if (!splitInstruction.trim() || !node) return;
    setIsSplitting(true);
    try {
      const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);

      const res = await apiFetch('/api/node/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: { id: node.id, title: node.title, content: node.content },
          instruction: splitInstruction,
          connectedEdges: connectedEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            relation: e.relation,
          })),
          apiKey: apiKey || undefined,
        }),
      });

      if (!res.ok) throw new Error('分化失败');
      const data = await res.json();

      // 删除原节点
      removeNode(node.id);

      // 创建新节点（在原节点位置附近）
      const newNodes: KnowledgeNode[] = (data.newNodes || []).map(
        (n: { type: NodeType; title: string; content: string; level: number }, i: number) => ({
          id: nanoid(),
          type: n.type,
          title: n.title,
          content: n.content,
          level: n.level,
          status: 'lit' as const,
          position: { x: node.position.x + (i - 1) * 200, y: node.position.y + 100 },
          metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        })
      );

      // 创建新节点间的边
      const titleToId = new Map(newNodes.map((n) => [n.title, n.id]));
      const newEdges: KnowledgeEdge[] = (data.newEdges || [])
        .filter(
          (e: { sourceTitle: string; targetTitle: string }) =>
            titleToId.has(e.sourceTitle) && titleToId.has(e.targetTitle)
        )
        .map((e: { sourceTitle: string; targetTitle: string; relation: string; type: KnowledgeEdge['type'] }) => ({
          id: nanoid(),
          source: titleToId.get(e.sourceTitle)!,
          target: titleToId.get(e.targetTitle)!,
          relation: e.relation,
          type: e.type,
          autoGenerated: true,
        }));

      applyGraphChanges({ newNodes, updatedNodes: [], newEdges });
      setShowSplitForm(false);
      setSplitInstruction('');
      closeNodeDetail();
    } catch (error) {
      console.error('节点分化失败:', error);
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-secondary)]">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 text-lg font-semibold border border-[var(--border-strong)] rounded-md px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        ) : (
          <h2 className="text-lg font-semibold text-[var(--text-primary)] truncate">{node.title}</h2>
        )}
        <button
          onClick={closeNodeDetail}
          className="ml-2 p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* 类型标签 + 创建时间 + 认知环 */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[node.type]}`}>
          {typeLabels[node.type]}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {new Date(node.metadata.createdAt).toLocaleString('zh-CN')}
        </span>
        {node.cognitionLevel !== undefined && node.cognitionLevel > 0 && (
          <div className="ml-auto">
            <CognitionRing level={node.cognitionLevel} reason={node.cognitionReason} size={28} />
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={() => { updateNode(node.id, { content: editContent }); setIsEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setIsEditing(false); } }}
            autoFocus
            className="w-full h-full min-h-[200px] border border-[var(--border-strong)] rounded-lg p-3 text-sm resize-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        ) : (
          <div
            onClick={() => { setEditContent(node.content); setIsEditing(true); }}
            className="cursor-text rounded-lg p-1 -m-1 hover:bg-[var(--bg-hover)]/30 transition-colors min-h-[80px]"
            title="点击编辑内容"
          >
            <MarkdownRenderer content={node.content || '*点击编辑…*'} className="text-sm" />
          </div>
        )}
        {node.metadata.conversationId && (
          <div className="mt-3 px-3 py-2 bg-[var(--accent-soft)] rounded-md text-xs text-[var(--accent)] flex items-center gap-1">
            <MessageSquare size={12} />
            该节点由 AI 对话生成
          </div>
        )}

        {/* 笔记区 */}
        <div className="mt-5 pt-4 border-t border-[var(--border)]/50">
          <div className="flex items-center gap-1.5 mb-2">
            <StickyNote size={13} className="text-[var(--accent)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">笔记</span>
          </div>
          {(node.notes && node.notes.length > 0) ? (
            <div className="space-y-2">
              {node.notes.map((note) => (
                <div key={note.id} className="px-2.5 py-2 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${noteKindColors[note.kind]}`}>
                      {noteKindLabels[note.kind]}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(note.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    <MarkdownRenderer content={note.content} className="text-xs" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)]">暂无笔记</p>
          )}
        </div>

        {/* 白板缩略图 */}
        {node.whiteboardThumbnail && (
          <div className="mt-5 pt-4 border-t border-[var(--border)]/50">
            <div className="flex items-center gap-1.5 mb-2">
              <PenTool size={13} className="text-[var(--accent)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">白板</span>
            </div>
            <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-white">
              <img
                src={node.whiteboardThumbnail}
                alt="白板缩略图"
                className="w-full h-auto max-h-[180px] object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* 分化表单 */}
      {showSplitForm && (
        <div className="px-4 py-3 border-t border-[var(--border)] bg-green-500/10">
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
            分化指示
          </label>
          <textarea
            value={splitInstruction}
            onChange={(e) => setSplitInstruction(e.target.value)}
            placeholder="例如：按概念维度拆分为三个子节点"
            disabled={isSplitting}
            className="w-full h-20 border border-[var(--border-strong)] rounded-md p-2 text-sm resize-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSplit}
              disabled={isSplitting || !splitInstruction.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSplitting ? <Loader2 size={14} className="animate-spin" /> : <Split size={14} />}
              {isSplitting ? '分化中...' : '确认分化'}
            </button>
            <button
              onClick={() => {
                setShowSplitForm(false);
                setSplitInstruction('');
              }}
              disabled={isSplitting}
              className="px-3 py-1.5 text-[var(--text-primary)] text-sm rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 相关推荐 */}
      <div className="px-4 py-3 border-t border-[var(--border)]/50">
        <div className="flex items-center gap-1.5 mb-2">
          <Lightbulb size={13} className="text-[var(--accent)]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">相关推荐</span>
          {isLoadingRecommendations && <Loader2 size={12} className="animate-spin text-[var(--text-muted)]" />}
          <span className="flex-1" />
          <button
            onClick={handleRefreshRecommendations}
            disabled={isRefreshing || isLoadingRecommendations}
            title="换一批推荐"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
            换一换
          </button>
        </div>
        {relatedRecommendations.length > 0 ? (
          <div className="space-y-1.5">
            {relatedRecommendations.map((rec, idx) => {
              const key = String(idx);
              const isExpanded = expandedIdx === key;
              return (
                <div
                  key={idx}
                  onClick={() => setExpandedIdx(isExpanded ? null : key)}
                  className={`cursor-pointer px-2.5 py-1.5 rounded-md bg-[var(--bg-secondary)] border transition-colors ${
                    isExpanded
                      ? 'border-[var(--accent)]'
                      : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">{rec.title}</p>
                      <p className={`text-[11px] text-[var(--text-muted)] mt-0.5 ${isExpanded ? 'whitespace-normal' : 'truncate'}`}>
                        {rec.reason}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLearnRecommendation(rec.title);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-hover)]/25 transition-colors shrink-0"
                    >
                      <BookOpen size={11} />
                      学习
                    </button>
                  </div>
                  {isExpanded && rec.description && (
                    <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] mt-1.5 pt-1.5 border-t border-[var(--border)]">
                      {rec.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          !isLoadingRecommendations && (
            autoRecommend ? (
              <p className="text-[11px] text-[var(--text-muted)]">暂无推荐，点右上角“换一换”试试</p>
            ) : (
              <button
                onClick={handleGenerateRecommendations}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-[var(--border-strong)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
              >
                <Sparkles size={12} />
                生成相关推荐
              </button>
            )
          )
        )}
      </div>

      {/* 底部操作栏：仅保留破坏性操作，编辑已移入内容区点击触发 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[var(--border)]/50">
        <button
          onClick={() => setShowSplitForm((v) => !v)}
          disabled={isEditing || isSplitting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition-colors"
        >
          <Split size={13} />
          分化
        </button>
        <button
          onClick={() => {
            const { generateNodeMarkdown } = require('@/lib/export/MarkdownGenerator');
            const { sanitizeFileName } = require('@/lib/export/FileNameSanitizer');
            const { nodes: allNodes, edges } = useGraphStore.getState();
            const md = generateNodeMarkdown(node, edges, allNodes);
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${sanitizeFileName(node.title, node.id)}.md`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Download size={13} />
          下载
        </button>
        <button
          onClick={() => {
            if (window.confirm(`确定删除节点「${node.title}」吗？\n此操作不可撤销。`)) {
              removeNode(node.id);
              closeNodeDetail();
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={13} />
          删除
        </button>
      </div>
    </div>
  );
}
