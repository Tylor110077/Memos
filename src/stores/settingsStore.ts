'use client';

import { create } from 'zustand';
import type { ResponseStyle } from '@/types';

/** 默认快捷键映射（'mod' 代表 Mac 的 Cmd / Windows 的 Ctrl） */
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  focusChat: 'mod+k',        // 聚焦对话输入框
  newChat: 'mod+shift+n',    // 新建对话
  fitView: 'mod+f',          // 适配视图
  toggleChat: 'mod+j',       // 展开/关闭对话栏
};

export interface MemosSettings {
  /** 打开节点详情时自动生成相关推荐（关闭则需手动点击生成） */
  autoRecommend: boolean;
  /** 回答风格（全局，主对话与 AI 助手共享） */
  responseStyle: ResponseStyle;
  /** 自定义回答风格描述 */
  customStyle: string;
  /** 操作名 → 快捷键 映射 */
  shortcuts: Record<string, string>;
  /** AI API Key（阿里千问 Qwen） */
  apiKey: string;
  /** 费曼对话结束后自动触发认知评审 */
  autoCognitionEval: boolean;
  /** 节点类型颜色配置 */
  nodeColors: Record<string, string>;
}

const STORAGE_KEY = 'memos-settings';

export const DEFAULT_NODE_COLORS: Record<string, string> = {
  concept: '#8b5cf6',
  theme: '#a78bfa',
  material: '#22d3ee',
  understanding: '#60a5fa',
  question: '#c084fc',
};

const DEFAULT_SETTINGS: MemosSettings = {
  autoRecommend: false,
  responseStyle: 'balanced',
  customStyle: '',
  shortcuts: { ...DEFAULT_SHORTCUTS },
  apiKey: '',
  autoCognitionEval: true,
  nodeColors: { ...DEFAULT_NODE_COLORS },
};

function loadSettings(): MemosSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // 合并快捷键：保留用户自定义，补齐新增的默认项
      shortcuts: { ...DEFAULT_SHORTCUTS, ...(parsed.shortcuts || {}) },
      // 合并节点颜色：保留用户自定义，补齐新增的默认项
      nodeColors: { ...DEFAULT_NODE_COLORS, ...(parsed.nodeColors || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persist(next: MemosSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      autoRecommend: next.autoRecommend,
      responseStyle: next.responseStyle,
      customStyle: next.customStyle,
      shortcuts: next.shortcuts,
      apiKey: next.apiKey,
      autoCognitionEval: next.autoCognitionEval,
      nodeColors: next.nodeColors,
    }));
  } catch {
    /* ignore */
  }
}

interface SettingsState extends MemosSettings {
  /** 是否已从 localStorage 水合（防止 SSR hydration mismatch） */
  _hydrated: boolean;
  setAutoRecommend: (value: boolean) => void;
  setResponseStyle: (value: ResponseStyle) => void;
  setCustomStyle: (value: string) => void;
  setShortcut: (action: string, key: string) => void;
  setApiKey: (key: string) => void;
  setAutoCognitionEval: (value: boolean) => void;
  setNodeColor: (type: string, color: string) => void;
  resetSettings: () => void;
  /** 客户端挂载后调用，从 localStorage 加载用户设置 */
  hydrate: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // 始终用默认值初始化，避免 SSR/CSR 不一致
  ...DEFAULT_SETTINGS,
  _hydrated: false,

  hydrate: () => {
    const saved = loadSettings();
    set({ ...saved, _hydrated: true });
  },

  setAutoRecommend: (value) =>
    set((state) => {
      const next = { ...state, autoRecommend: value };
      persist(next);
      return { autoRecommend: value };
    }),

  setResponseStyle: (value) =>
    set((state) => {
      const next = { ...state, responseStyle: value };
      persist(next);
      return { responseStyle: value };
    }),

  setCustomStyle: (value) =>
    set((state) => {
      const next = { ...state, customStyle: value };
      persist(next);
      return { customStyle: value };
    }),

  setShortcut: (action, key) =>
    set((state) => {
      const shortcuts = { ...state.shortcuts, [action]: key };
      const next = { ...state, shortcuts };
      persist(next);
      return { shortcuts };
    }),

  setApiKey: (key) =>
    set((state) => {
      const next = { ...state, apiKey: key };
      persist(next);
      return { apiKey: key };
    }),

  setAutoCognitionEval: (value) =>
    set((state) => {
      const next = { ...state, autoCognitionEval: value };
      persist(next);
      return { autoCognitionEval: value };
    }),

  setNodeColor: (type, color) =>
    set((state) => {
      const nodeColors = { ...state.nodeColors, [type]: color };
      const next = { ...state, nodeColors };
      persist(next);
      return { nodeColors };
    }),

  resetSettings: () =>
    set(() => {
      persist(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }),
}));
