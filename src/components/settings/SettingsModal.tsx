'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, X, Sparkles, RotateCcw, Check, MessageSquareText, Keyboard, Key, Eye, EyeOff } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { themes, applyTheme, getSavedTheme } from '@/lib/themes';
import { formatShortcut } from '@/hooks/useShortcuts';
import type { ResponseStyle } from '@/types';

/** 快捷键操作元信息 */
const SHORTCUT_ACTIONS: { action: string; label: string; desc: string }[] = [
  { action: 'focusChat', label: '聚焦对话', desc: '快速将光标定位到对话输入框' },
  { action: 'newChat', label: '新建对话', desc: '清空当前对话，开始新一轮' },
  { action: 'fitView', label: '适配视图', desc: '缩放画布以展示所有节点' },
];

/** 将按键事件序列化为快捷键字符串，如 'mod+shift+k'；返回 null 表示无效 */
function serializeKeyCombo(e: KeyboardEvent): string | null {
  // 单独按下修饰键时不捕获
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = e.key.toLowerCase();
  // 至少需要一个修饰键，避免捕获单个字母
  if (parts.length === 0) return null;
  parts.push(key);
  return parts.join('+');
}

const STYLE_CHOICES: { value: ResponseStyle; label: string }[] = [
  { value: 'default', label: '初始' },
  { value: 'balanced', label: '适中' },
  { value: 'concise', label: '精简' },
  { value: 'custom', label: '自定义' },
];

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

/** 自定义开关 */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-hover)] border border-[var(--border-strong)]'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        }`}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { autoRecommend, setAutoRecommend, resetSettings, responseStyle, setResponseStyle, shortcuts, setShortcut, apiKey, setApiKey } = useSettingsStore();
  const [currentTheme, setCurrentTheme] = useState('abyss');
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  /** 正在捕获快捷键的操作名，null 表示未在捕获 */
  const [capturingAction, setCapturingAction] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCurrentTheme(getSavedTheme());
      setApiKeyDraft(apiKey);
    }
  }, [visible, apiKey]);

  // 捕获快捷键：监听下一次按键组合
  const handleCaptureKey = useCallback(
    (e: KeyboardEvent) => {
      if (!capturingAction) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setCapturingAction(null);
        return;
      }

      const combo = serializeKeyCombo(e);
      if (combo) {
        setShortcut(capturingAction, combo);
        setCapturingAction(null);
      }
    },
    [capturingAction, setShortcut],
  );

  useEffect(() => {
    if (!capturingAction) return;
    window.addEventListener('keydown', handleCaptureKey, { capture: true });
    return () => window.removeEventListener('keydown', handleCaptureKey, { capture: true });
  }, [capturingAction, handleCaptureKey]);

  // 关闭弹窗时退出捕获状态
  useEffect(() => {
    if (!visible) setCapturingAction(null);
  }, [visible]);

  if (!visible) return null;

  const handleSwitchTheme = (id: string) => {
    setCurrentTheme(id);
    applyTheme(id);
  };

  const handleReset = () => {
    resetSettings();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} style={{ animation: 'fadeIn 150ms ease-out' }} />

      {/* 弹窗 */}
      <div
        className="relative w-[520px] max-h-[82vh] bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border-strong)] flex flex-col overflow-hidden"
        style={{ animation: 'scaleIn 200ms ease-out' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
              <Settings size={17} className="text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight">设置</h2>
              <p className="text-[11px] text-[var(--text-muted)]">调整 Memos 的行为与外观</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {/* AI 配置 */}
          <section>
            <h3 className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase mb-3">AI 配置</h3>
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center shrink-0 mt-0.5">
                  <Key size={15} className="text-[var(--accent)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">阿里千问 Qwen API Key</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    用于 AI 对话、推荐、摘要等功能。Key 仅存储在本地浏览器中。
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyDraft}
                    onChange={(e) => setApiKeyDraft(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-9 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
                  />
                  <button
                    onClick={() => setShowApiKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    title={showApiKey ? '隐藏' : '显示'}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => setApiKey(apiKeyDraft.trim())}
                  disabled={apiKeyDraft.trim() === apiKey}
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  保存
                </button>
              </div>
              {apiKey && (
                <p className="text-[11px] text-green-400 mt-2 flex items-center gap-1">
                  <Check size={11} /> 已配置
                </p>
              )}
            </div>
          </section>

          {/* 学习行为 */}
          <section>
            <h3 className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase mb-3">学习行为</h3>
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={15} className="text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">自动生成相关推荐</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    开启后，打开节点详情会自动生成延伸推荐；关闭则需手动点击&quot;换一换&quot;生成，更节省资源。
                  </p>
                </div>
              </div>
              <Toggle checked={autoRecommend} onChange={setAutoRecommend} />
            </div>

            {/* 回答风格 */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] mt-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquareText size={15} className="text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">回答风格</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    AI 回答的语气与详略，主对话与 AI 助手通用。
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] shrink-0">
                {STYLE_CHOICES.map(choice => (
                  <button
                    key={choice.value}
                    onClick={() => setResponseStyle(choice.value)}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                      responseStyle === choice.value
                        ? 'bg-[var(--accent)] text-white font-medium'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 快捷键 */}
          <section>
            <h3 className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase mb-3">快捷键</h3>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] divide-y divide-[var(--border)]">
              {SHORTCUT_ACTIONS.map(({ action, label, desc }) => {
                const isCapturing = capturingAction === action;
                return (
                  <div key={action} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                        <Keyboard size={15} className="text-[var(--accent)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCapturing ? (
                        <span className="px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--accent)] rounded-md animate-pulse">
                          按下新快捷键…
                        </span>
                      ) : (
                        <kbd className="px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-strong)] rounded-md shadow-sm">
                          {formatShortcut(shortcuts[action] || '')}
                        </kbd>
                      )}
                      <button
                        onClick={() => setCapturingAction(isCapturing ? null : action)}
                        className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                          isCapturing
                            ? 'text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-hover)]'
                            : 'text-[var(--accent)] border-[var(--accent)]/40 hover:bg-[var(--accent-soft)]'
                        }`}
                      >
                        {isCapturing ? '取消' : '修改'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-2">捕获时按 Esc 可取消修改</p>
          </section>

          {/* 外观 */}
          <section>
            <h3 className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase mb-3">外观</h3>
            <div className="grid grid-cols-3 gap-3">
              {themes.map((theme) => {
                const active = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleSwitchTheme(theme.id)}
                    className={`relative p-3 rounded-xl border text-left transition-all duration-150 group ${
                      active
                        ? 'border-[var(--accent)] shadow-md'
                        : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm'
                    }`}
                    style={{ backgroundColor: theme.vars['--bg-primary'] }}
                  >
                    {/* 主题色板预览 */}
                    <div className="flex gap-1.5 mb-2.5">
                      <span className="w-5 h-5 rounded-md" style={{ backgroundColor: theme.vars['--accent'] }} />
                      <span className="w-5 h-5 rounded-md" style={{ backgroundColor: theme.vars['--node-concept'] }} />
                      <span className="w-5 h-5 rounded-md" style={{ backgroundColor: theme.vars['--node-material'] }} />
                    </div>
                    <p className="text-xs font-medium" style={{ color: theme.vars['--text-primary'] }}>
                      {theme.name}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: theme.vars['--text-muted'] }}>
                      {theme.id === 'abyss' ? '极简克制' : theme.id === 'aurora' ? '科技冷光' : '温暖复古'}
                    </p>
                    {active && (
                      <span className="absolute top-2 right-2 w-4.5 h-4.5 rounded-full bg-[var(--accent)] flex items-center justify-center" style={{ width: 18, height: 18 }}>
                        <Check size={11} className="text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-primary)]">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-hover)] transition-colors"
          >
            <RotateCcw size={13} />
            恢复默认
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
