'use client';

import { useState } from 'react';
import { ChevronDown, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useBoardStore } from '@/stores/boardStore';

export function BoardSelector() {
  const { boards, currentBoardId, createBoard, switchBoard, deleteBoard, renameBoard } = useBoardStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const currentBoard = boards.find(b => b.id === currentBoardId);

  const handleCreate = async () => {
    if (newName.trim()) {
      await createBoard(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  const handleRename = async () => {
    if (editingId && editName.trim()) {
      await renameBoard(editingId, editName.trim());
      setEditingId(null);
    }
  };

  return (
    <div className="absolute bottom-4 left-4 z-20">
      {/* 当前画板按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)]/80 border border-[var(--border)] text-[var(--text-primary)] text-sm hover:bg-[var(--bg-hover)]/80 transition-colors"
      >
        <span className="truncate max-w-[120px]">{currentBoard?.name || '选择画板'}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉列表 */}
      {isOpen && (
        <div className="mt-1 w-[200px] rounded-lg bg-[var(--bg-secondary)]/95 border border-[var(--border)] shadow-xl py-1 px-1.5 backdrop-blur-sm">
          {boards.map(board => (
            <div key={board.id} className={`group flex items-center px-1 rounded-md transition-colors ${board.id === currentBoardId ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--bg-hover)]'}`}>
              {editingId === board.id ? (
                <div className="flex items-center gap-1 flex-1 py-1 px-1">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)] px-2 py-1 rounded border border-[var(--border-strong)] focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleRename()}
                    autoFocus
                  />
                  <button onClick={handleRename} className="text-green-400"><Check size={12} /></button>
                  <button onClick={() => setEditingId(null)} className="text-[var(--text-muted)]"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => { switchBoard(board.id); setIsOpen(false); }}
                    className={`flex-1 text-left px-2 py-1.5 text-sm rounded ${board.id === currentBoardId ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
                  >
                    {board.name}
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingId(board.id); setEditName(board.name); }} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
                      <Pencil size={11} />
                    </button>
                    {boards.length > 1 && (
                      <button onClick={() => deleteBoard(board.id)} className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)]">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {/* 新建 */}
          <div className="border-t border-[var(--border)] mt-1 pt-1 px-2">
            {isCreating ? (
              <div className="flex items-center gap-1 py-1">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="flex-1 bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)] px-2 py-1 rounded border border-[var(--border-strong)] focus:outline-none"
                  placeholder="画板名称"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
                <button onClick={handleCreate} className="text-green-400"><Check size={12} /></button>
              </div>
            ) : (
              <button onClick={() => setIsCreating(true)} className="flex items-center gap-1 px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] w-full">
                <Plus size={14} /> 新建画板
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
