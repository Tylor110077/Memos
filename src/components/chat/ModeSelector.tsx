'use client';

import { BookOpen, Mic, Swords, PenTool } from 'lucide-react';
import type { ChatMode } from '@/types';

interface ModeSelectorProps {
  currentMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

const modes: { key: ChatMode; label: string; icon: React.ReactNode; title: string; activeClass: string }[] = [
  { key: 'learn', label: '学习', icon: <BookOpen size={16} />, title: '向 AI 提问，学习新知识', activeClass: 'bg-blue-500/20 text-blue-400' },
  { key: 'feynman', label: '费曼', icon: <Mic size={16} />, title: '向 AI 讲解你的理解，它来追问', activeClass: 'bg-green-500/20 text-green-400' },
  { key: 'debate', label: '辩论', icon: <Swords size={16} />, title: '为观点辩护，AI 来质疑', activeClass: 'bg-red-500/20 text-red-400' },
  { key: 'design', label: '设计', icon: <PenTool size={16} />, title: '用知识做设计，AI 来引导', activeClass: 'bg-purple-500/20 text-purple-400' },
];

export default function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex gap-1 p-2 bg-[var(--bg-primary)] rounded-lg">
      {modes.map((mode) => (
        <button
          key={mode.key}
          onClick={() => onModeChange(mode.key)}
          title={mode.title}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
            currentMode === mode.key
              ? `${mode.activeClass} shadow-sm`
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {mode.icon}
          {mode.label}
        </button>
      ))}
    </div>
  );
}
