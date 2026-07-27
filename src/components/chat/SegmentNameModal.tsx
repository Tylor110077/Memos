'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface SegmentNameModalProps {
  visible: boolean;
  messages: { role: string; content: string }[];
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function SegmentNameModal({ visible, messages, onConfirm, onCancel }: SegmentNameModalProps) {
  const [name, setName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  if (!visible) return null;

  const handleAiName = async () => {
    setAiLoading(true);
    try {
      const conversationText = messages.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n').slice(0, 2000);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `请用不超过10个字概括以下对话的主题，只输出主题名，不要其他内容：\n\n${conversationText}` }],
          mode: 'learn',
          style: 'concise',
        }),
      });
      if (!res.ok) throw new Error('failed');
      // 读取流式响应
      const reader = res.body?.getReader();
      if (!reader) throw new Error('no body');
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // 解析 data stream 格式
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try { result += JSON.parse(line.slice(2)); } catch { /* skip */ }
          }
        }
      }
      setName(result.trim().replace(/[""]/g, '').slice(0, 20));
    } catch {
      setName('未命名分段');
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirm = () => {
    const trimmed = name.trim() || '未命名分段';
    onConfirm(trimmed);
    setName('');
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-2xl p-5 w-[320px]" style={{ animation: 'fadeIn 150ms ease-out' }}>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">为这段对话命名</h3>
        <input
          autoFocus
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
          placeholder="输入主题名..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onCancel(); }}
        />
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={handleAiName}
            disabled={aiLoading || messages.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50 transition-colors"
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI 命名
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
              取消
            </button>
            <button onClick={handleConfirm} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
