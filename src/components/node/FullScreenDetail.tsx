'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useGraphStore } from '@/stores/graphStore';
import { useChatStore } from '@/stores/chatStore';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { detectFileType } from '@/lib/fileUtils';

export function FullScreenDetail() {
  const { fullScreenNodeId, closeFullScreen } = useUIStore();
  const { nodes, updateNode } = useGraphStore();
  const { setChatPanelOpen } = useChatStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const node = nodes.find(n => n.id === fullScreenNodeId);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFullScreen(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeFullScreen]);

  // 初始化编辑内容和摘要
  useEffect(() => {
    if (node) {
      setEditContent(node.content);
      setSummary(node.summary || null);
      setIsEditing(false);
      setIframeLoading(true);
    }
  }, [node]);

  const handleSave = () => {
    if (node) updateNode(node.id, { content: editContent });
    setIsEditing(false);
  };

  const handleSummarize = async () => {
    if (!node) return;
    setIsSummarizing(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: node.content, title: node.title }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        updateNode(node.id, { summary: data.summary });
      }
    } catch (e) { console.error(e); }
    finally { setIsSummarizing(false); }
  };

  if (!fullScreenNodeId || !node) return null;

  const isMaterial = node.type === 'material';
  const isWebMaterial = isMaterial && node.metadata.source?.startsWith('http');
  const isMarkdownFile = isMaterial && node.metadata.source && detectFileType(node.metadata.source) === 'markdown';
  const isPdfFile = isMaterial && (node.fileData || node.metadata.materialType === 'pdf');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{ animation: 'fadeIn 200ms ease-out' }}
      onClick={(e) => { if (e.target === e.currentTarget) closeFullScreen(); }}
    >
      <div className="w-[85vw] h-[85vh] bg-[var(--bg-secondary)] rounded-2xl shadow-2xl shadow-black/30 flex flex-col overflow-hidden"
        style={{ animation: 'scaleIn 350ms ease-out' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{node.title}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">{node.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChatPanelOpen(true)}
              className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              title="问 AI 关于这个节点的问题"
            >
              <MessageSquare size={18} />
            </button>
            <button onClick={closeFullScreen} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isPdfFile && node.fileData ? (
            /* PDF 文件节点：使用 dataURL 渲染 */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 relative border-b border-[var(--border)]">
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-tertiary)] z-10">
                    <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
                    <span className="ml-2 text-sm text-[var(--text-muted)]">加载中...</span>
                  </div>
                )}
                <iframe
                  src={node.fileData}
                  className="w-full h-full border-0"
                  title={node.title}
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            </div>
          ) : isMarkdownFile ? (
            /* Markdown 文件节点：使用 MarkdownRenderer 渲染 */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <MarkdownRenderer content={node.content || '（无内容）'} />
              </div>
            </div>
          ) : isWebMaterial ? (
            /* 网页材料节点：iframe 嵌入原文 */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 relative border-b border-[var(--border)]">
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-tertiary)] z-10">
                    <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
                    <span className="ml-2 text-sm text-[var(--text-muted)]">加载中...</span>
                  </div>
                )}
                <iframe
                  src={node.metadata.source}
                  className="w-full h-full border-0"
                  title={node.title}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
              {/* 抓取的内容/摘要 */}
              {node.content && (
                <div className="h-[200px] overflow-y-auto px-6 py-4 bg-[var(--bg-primary)]">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1">
                    <FileText size={14} /> 内容摘要
                  </h3>
                  <MarkdownRenderer content={summary || node.content.slice(0, 500)} className="text-sm" />
                </div>
              )}
            </div>
          ) : (
            /* 文本节点：编辑器/预览 */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full min-h-[300px] p-4 border border-[var(--border-strong)] rounded-lg font-mono text-sm resize-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="输入 Markdown 内容..."
                  />
                ) : (
                  <div onDoubleClick={() => setIsEditing(true)}>
                    <MarkdownRenderer content={node.content || '（双击编辑内容）'} />
                  </div>
                )}
              </div>
              {/* 编辑/保存按钮 */}
              <div className="px-6 py-2 border-t border-[var(--border)] flex gap-2">
                {isEditing ? (
                  <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)]">保存</button>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 text-sm bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)]/80">编辑</button>
                )}
              </div>
            </div>
          )}

          {/* AI 摘要区域 */}
          <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                <Sparkles size={12} /> AI 摘要
              </h3>
              {!summary && (
                <button onClick={handleSummarize} disabled={isSummarizing}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1">
                  {isSummarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {isSummarizing ? '生成中...' : '生成摘要'}
                </button>
              )}
            </div>
            {summary && <p className="mt-1 text-sm text-[var(--text-primary)]">{summary}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
