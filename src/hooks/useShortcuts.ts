'use client';

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * 解析快捷键字符串为结构化描述
 * 'mod+shift+n' → { mod: true, shift: true, alt: false, key: 'n' }
 */
export function parseShortcut(shortcut: string) {
  const parts = shortcut.toLowerCase().split('+').map((p) => p.trim());
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter((p) => !['mod', 'shift', 'alt', 'ctrl', 'meta'].includes(p)).pop() || '',
  };
}

/** 判断事件是否匹配快捷键定义 */
function matchShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const { mod, shift, alt, key } = parseShortcut(shortcut);
  if (!key) return false;

  const modPressed = e.metaKey || e.ctrlKey;
  if (mod !== modPressed) return false;
  if (shift !== e.shiftKey) return false;
  if (alt !== e.altKey) return false;

  // e.key 可能是 'K'（shift 时大写），统一转小写比较
  const pressedKey = e.key.toLowerCase();
  return pressedKey === key;
}

/** 判断事件目标是否为输入类元素（输入框/文本域/可编辑区域） */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * 全局快捷键 hook
 *
 * 用法：
 *   useShortcuts({
 *     focusChat: () => { ... },
 *     newChat: () => { ... },
 *     fitView: () => { ... },
 *   });
 *
 * 快捷键映射从 settingsStore.shortcuts 读取（操作名 → 快捷键字符串）。
 * 输入框/文本域聚焦时不触发。
 */
export function useShortcuts(handlers: Record<string, () => void>) {
  // 用 ref 持有最新 handlers，避免频繁重绑监听器
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const shortcuts = useSettingsStore((s) => s.shortcuts);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 输入类元素聚焦时跳过（但允许带 mod 修饰键的组合，如 Cmd+K 在输入框中也有意义）
      if (isEditableTarget(e.target) && !e.metaKey && !e.ctrlKey) return;

      for (const [action, shortcut] of Object.entries(shortcuts)) {
        if (matchShortcut(e, shortcut)) {
          const handler = handlersRef.current[action];
          if (handler) {
            e.preventDefault();
            e.stopPropagation();
            handler();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [shortcuts]);
}

/**
 * 格式化快捷键用于显示
 * 'mod+k' → '⌘K'（Mac）或 'Ctrl+K'（其他平台）
 */
export function formatShortcut(shortcut: string): string {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform || '');

  const { mod, shift, alt, key } = parseShortcut(shortcut);
  const displayKey = key.length === 1 ? key.toUpperCase() : key;

  if (isMac) {
    return `${mod ? '⌘' : ''}${shift ? '⇧' : ''}${alt ? '⌥' : ''}${displayKey}`;
  }
  const parts: string[] = [];
  if (mod) parts.push('Ctrl');
  if (shift) parts.push('Shift');
  if (alt) parts.push('Alt');
  parts.push(displayKey);
  return parts.join('+');
}
