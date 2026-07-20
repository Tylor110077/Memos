'use client';

import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useUIStore } from '@/stores/uiStore';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import ReactMarkdown from 'react-markdown';
import { X, Edit2, Trash2, Save, Split, Loader2, MessageSquare, Lightbulb, BookOpen, Info } from 'lucide-react';
import type { NodeType, KnowledgeNode, KnowledgeEdge } from '@/types';

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

export function NodeDetail() {
  const { nodeDetailOpen, nodeDetailId, closeNodeDetail } = useUIStore();
  const { nodes, edges, updateNode, removeNode, applyGraphChanges } = useGraphStore();
  const { setPendingMessage, setChatPanelOpen } = useChatStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitInstruction, setSplitInstruction] = useState('');
  const [relatedRecommendations, setRelatedRecommendations] = useState<{ title: string; reason: string }[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  const node = nodes.find((n) => n.id === nodeDetailId);

  // 当面板打开时自动获取相关推荐
  const fetchRelatedRecommendations = useCallback(async (targetNode: KnowledgeNode) => {
    setIsLoadingRecommendations(true);
    setRelatedRecommendations([]);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentNode: { title: targetNode.title, content: targetNode.content },
          graph: { nodes: nodes.map(n => ({ title: n.title, type: n.type, level: n.level })), edges: [] },
          type: 'related',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRelatedRecommendations((data.recommendations || []).slice(0, 3));
      }
    } catch (error) {
      console.error('获取相关推荐失败:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [nodes]);

  useEffect(() => {
    if (nodeDetailOpen && node) {
      fetchRelatedRecommendations(node);
    } else {
      setRelatedRecommendations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeDetailOpen, nodeDetailId]);

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

  const handleStartEdit = () => {
    setEditTitle(node.title);
    setEditContent(node.content);
    setIsEditing(true);
  };

  const handleSave = () => {
    updateNode(node.id, {
      title: editTitle,
      content: editContent,
      metadata: { ...node.metadata, updatedAt: new Date().toISOString() },
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('确定要删除这个节点吗？')) {
      removeNode(node.id);
      closeNodeDetail();
    }
  };

  const handleSplit = async () => {
    if (!splitInstruction.trim() || !node) return;
    setIsSplitting(true);
    try {
      const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);

      const res = await fetch('/api/node/split', {
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

      {/* 类型标签 + 创建时间 */}
      <div className="flex items-center gap-2 px-4 py-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[node.type]}`}>
          {typeLabels[node.type]}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          {new Date(node.metadata.createdAt).toLocaleString('zh-CN')}
        </span>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full min-h-[200px] border border-[var(--border-strong)] rounded-md p-3 text-sm resize-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        ) : (
          <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-invert">
            <ReactMarkdown>{node.content}</ReactMarkdown>
          </div>
        )}
        {node.metadata.conversationId && (
          <div className="mt-3 px-3 py-2 bg-[var(--accent-soft)] rounded-md text-xs text-[var(--accent)] flex items-center gap-1">
            <MessageSquare size={12} />
            该节点由 AI 对话生成
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
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-primary)]">
        <div className="flex items-center gap-1.5 mb-2">
          <Lightbulb size={13} className="text-[var(--accent)]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">相关推荐</span>
          {isLoadingRecommendations && <Loader2 size={12} className="animate-spin text-[var(--text-muted)]" />}
        </div>
        {relatedRecommendations.length > 0 ? (
          <div className="space-y-1.5">
            {relatedRecommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{rec.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{rec.reason}</p>
                </div>
                <button
                  onClick={() => handleLearnRecommendation(rec.title)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-hover)]/25 transition-colors shrink-0"
                >
                  <BookOpen size={11} />
                  学习
                </button>
              </div>
            ))}
          </div>
        ) : (
          !isLoadingRecommendations && (
            <p className="text-[11px] text-[var(--text-muted)]">暂无推荐</p>
          )
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)]">
        {isEditing ? (
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-sm rounded-md hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Save size={14} />
            保存
          </button>
        ) : (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm rounded-md hover:bg-[var(--bg-hover)]/80 transition-colors"
          >
            <Edit2 size={14} />
            编辑
          </button>
        )}
        <button
          onClick={() => setShowSplitForm((v) => !v)}
          disabled={isEditing || isSplitting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 text-green-400 text-sm rounded-md hover:bg-green-500/25 disabled:opacity-50 transition-colors"
        >
          <Split size={14} />
          分化
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 text-sm rounded-md hover:bg-red-500/15 transition-colors"
        >
          <Trash2 size={14} />
          删除
        </button>
      </div>
    </div>
  );
}
