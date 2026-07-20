import { create } from 'zustand';
import type { Board } from '@/types';
import * as dbOps from '@/lib/db';

interface BoardState {
  boards: Board[];
  currentBoardId: string | null;
  isInitialized: boolean;

  initializeBoards: () => Promise<void>;
  createBoard: (name: string) => Promise<void>;
  switchBoard: (id: string) => void;
  deleteBoard: (id: string) => Promise<void>;
  renameBoard: (id: string, name: string) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards: [],
  currentBoardId: null,
  isInitialized: false,

  initializeBoards: async () => {
    let boards = await dbOps.getAllBoards();
    if (boards.length === 0) {
      const defaultBoard = await dbOps.createBoard({ name: '默认画板', createdAt: new Date().toISOString() });
      boards = [defaultBoard];
    }
    set({ boards, currentBoardId: boards[0].id, isInitialized: true });
  },

  createBoard: async (name) => {
    const board = await dbOps.createBoard({ name, createdAt: new Date().toISOString() });
    set((state) => ({ boards: [...state.boards, board], currentBoardId: board.id }));
  },

  switchBoard: (id) => set({ currentBoardId: id }),

  deleteBoard: async (id) => {
    await dbOps.deleteBoard(id);
    const boards = get().boards.filter((b) => b.id !== id);
    set({ boards, currentBoardId: boards[0]?.id || null });
  },

  renameBoard: async (id, name) => {
    await dbOps.updateBoard(id, { name });
    set((state) => ({ boards: state.boards.map((b) => (b.id === id ? { ...b, name } : b)) }));
  },
}));
