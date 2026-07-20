'use client';

import { useState, useEffect, useRef } from 'react';
import { X, FileText, Loader2, Sparkles, MessageSquare, Send } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useUIStore } from '@/stores/uiStore';
import { useGraphStore } from '@/stores/graphStore';
import { useBoardStore } from '@/stores/boardStore';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { detectFileType } from '@/lib/fileUtils';
import { createConversation, updateConversation } from '@/lib/db';
import type { ChatMessage } from '@/types';

export function FullScreenDetail() {
  const { fullScreenNodeId, closeFullScreen } = useUIStore();
  const { nodes, updateNode } = useGraphStore();
  const { boards } = useBoardStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  // ===== AI 对话侧栏状态 =====
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiConvIdRef = useRef<string | null>(null);
  const aiListRef = useRef<HTMLDivElement>(null);

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

  // 切换节点时重置 AI 对话
  useEffect(() => {
    setAiMessages([]);
    setAiInput('');
    setAiLoading(false);
    aiConvIdRef.current = null;
  }, [fullScreenNodeId]);

  // 消息列表自动滚动到底部
  useEffect(() => {
    aiListRef.current?.scrollTo({ top: aiListRef.current.scrollHeight, behavior: 'smooth' });
  }, [aiMessages, aiLoading]);

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

  // ===== AI 侧栏对话逻辑（非流式，解析 data stream 文本块）=====
  const handleAiSend = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading || !node) return;

    const userMsg: ChatMessage = { id: nanoid(), role: 'user', content: text, timestamp: new Date().toISOString() };
    const history = [...aiMessages, userMsg];
    setAiMessages(history);
    setAiInput('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          mode: 'learn',
          // 注入当前节点上下文，/api/chat 会将其拼入 system prompt
          context: { selectedNode: { title: node.title, content: node.content } },
        }),
      });
      if (!res.ok) throw new Error(`AI 请求失败: ${res.status}`);

      const raw = await res.text();
      const content = raw
        .split('\n')
        .filter(line => line.startsWith('0:'))
        .map(line => { try { return JSON.parse(line.slice(2)) as string; } catch { return ''; } })
        .join('');

      const assistantMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: content || '抱歉，我暂时无法生成回答。',
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...history, assistantMsg];
      setAiMessages(finalMessages);

      // 保存到全局对话历史（带画板来源标注）
      const now = new Date().toISOString();
      const boardName = boards.find(b => b.id === node.boardId)?.name;
      if (aiConvIdRef.current) {
        await updateConversation(aiConvIdRef.current, { messages: finalMessages, updatedAt: now });
      } else {
        const conv = await createConversation({
          nodeId: node.id,
          boardId: node.boardId,
          boardName,
          mode: 'learn',
          messages: finalMessages,
          createdAt: now,
          updatedAt: now,
        });
        aiConvIdRef.current = conv.id;
      }
    } catch (e) {
      console.error('AI sidebar chat error:', e);
      setAiMessages(prev => [...prev, {
        id: nanoid(),
        role: 'assistant',
        content: '⚠️ AI 服务暂时不可用，请稍后再试。',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (!fullScreenNodeId || !node) return null;

  const isMaterial = node.type === 'material';
  const isWebMaterial = isMaterial && node.metadata.source?.startsWith('http');
  const isMarkdownFile = isMaterial && node.metadata.source && detectFileType(node.metadata.source) === 'markdown';
  const isPdfFile = isMaterial && (node.fileData || node.metadata.materialType === 'pdf');

  return (
    <div className="fixed inset-0 z-[200] flex bg-[var(--bg-primary)]"
      style={{ animation: 'fadeIn 200ms ease-out' }}
    >
      {/* 主内容区 */}
      <div className="flex-1 min-w-0 flex flex-col bg-[var(--bg-secondary)]"
        style={{ animation: 'scaleIn 350ms ease-out' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] truncate">{node.title}</h2>
            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">{node.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiSidebarOpen(open => !open)}
              className={`p-2 rounded-lg transition-colors ${
                aiSidebarOpen
                  ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
              }`}
              title="问 AI 关于这个节点的问题"
            >
              <MessageSquare size={18} />
            </button>
            <button onClick={closeFullScreen} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
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

      {/* AI 对话 sidebar */}
      {aiSidebarOpen && (
        <div className="w-[300px] shrink-0 h-full flex flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]"
          style={{ animation: 'slideInRight 250ms ease-out' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
              <Sparkles size={14} className="text-[var(--accent)]" /> AI 助手
            </span>
            <button
              onClick={() => setAiSidebarOpen(false)}
              className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title="收起侧栏"
            >
              <X size={16} />
            </button>
          </div>

          {/* 当前节点上下文提示 */}
          <div className="px-4 py-1.5 bg-[var(--accent-soft)] border-b border-[var(--accent)]/20 flex items-center gap-2">
            <span className="shrink-0 text-[10px] text-[var(--accent)]">当前上下文</span>
            <span className="text-xs text-[var(--accent)] truncate">{node.title}</span>
          </div>

          {/* 消息列表 */}
          <div ref={aiListRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {aiMessages.length === 0 && !aiLoading && (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
                <MessageSquare size={24} className="text-[var(--text-muted)]" />
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  关于「{node.title}」，<br />有什么想问的？
                </p>
              </div>
            )}
            {aiMessages.map((msg) => (
              <div key={msg.id}
                className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}
                style={{ animation: 'msgIn 200ms ease-out' }}>
                {msg.role === 'user' ? (
                  <div className="inline-block max-w-[90%] text-left px-3 py-2 rounded-lg bg-[var(--accent)] text-white">
                    {msg.content}
                  </div>
                ) : (
                  <div className="inline-block max-w-[95%] px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                    <MarkdownRenderer content={msg.content} className="text-sm" />
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div className="text-sm" style={{ animation: 'msgIn 200ms ease-out' }}>
                <div className="inline-block px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                  <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
                </div>
              </div>
            )}
          </div>

          {/* 输入框 */}
          <div className="p-3 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAiSend(); }}
                placeholder="问关于这个节点的问题..."
                className="flex-1 min-w-0 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <button
                onClick={handleAiSend}
                disabled={aiLoading || !aiInput.trim()}
                className="shrink-0 px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
