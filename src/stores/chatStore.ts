import { create } from 'zustand';
import type { ChatMode, Conversation } from '@/types';

interface ChatState {
  currentConversation: Conversation | null;
  currentMode: ChatMode;
  isStreaming: boolean;
  chatPanelOpen: boolean;
  pendingMessage: string | null;
  pendingContentCategory: 'knowledge' | 'trivia' | null;
  /** 重置信号：每次 +1，ChatPanel 监听后清空消息开始新对话 */
  resetSignal: number;
  /** 待加载的历史对话，ChatPanel 消费后置空 */
  pendingConversation: Conversation | null;

  setMode: (mode: ChatMode) => void;
  setConversation: (conv: Conversation | null) => void;
  setStreaming: (streaming: boolean) => void;
  toggleChatPanel: () => void;
  setChatPanelOpen: (open: boolean) => void;
  setPendingMessage: (msg: string | null, category?: 'knowledge' | 'trivia' | null) => void;
  triggerReset: () => void;
  setPendingConversation: (conv: Conversation | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  currentConversation: null,
  currentMode: 'learn',
  isStreaming: false,
  chatPanelOpen: true,
  pendingMessage: null,
  pendingContentCategory: null,
  resetSignal: 0,
  pendingConversation: null,

  setMode: (mode) => set({ currentMode: mode }),
  setConversation: (conv) => set({ currentConversation: conv }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  toggleChatPanel: () => set((state) => ({ chatPanelOpen: !state.chatPanelOpen })),
  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
  setPendingMessage: (msg, category = null) => set({ pendingMessage: msg, pendingContentCategory: category }),
  triggerReset: () => set((state) => ({ resetSignal: state.resetSignal + 1 })),
  setPendingConversation: (conv) => set({ pendingConversation: conv }),
}));
