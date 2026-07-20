'use client';
import { useState, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { themes, applyTheme, getSavedTheme } from '@/lib/themes';

export function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('abyss');

  useEffect(() => {
    const saved = getSavedTheme();
    setCurrentTheme(saved);
    applyTheme(saved);
  }, []);

  const handleSwitch = (id: string) => {
    setCurrentTheme(id);
    applyTheme(id);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        title="切换主题"
      >
        <Palette size={18} />
      </button>
      {isOpen && (
        <div className="absolute left-full ml-2 top-0 w-[160px] rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl py-1 z-50">
          {themes.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleSwitch(theme.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                currentTheme === theme.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.vars['--accent'] }} />
              {theme.name}
              {currentTheme === theme.id && <Check size={14} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
