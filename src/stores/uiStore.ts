import { create } from 'zustand';

export type SelectionTool = 'none' | 'box' | 'click';
export type ViewMode = 'canvas' | 'filetree';

interface UIState {
  nodeDetailOpen: boolean;
  nodeDetailId: string | null;
  domainModalOpen: boolean;
  importModalOpen: boolean;
  fullScreenNodeId: string | null;
  focusMode: boolean;
  focusDegree: number;
  /** 当前激活的圈选工具 */
  selectionTool: SelectionTool;
  /** 主视图模式：画布 / 文件树 */
  viewMode: ViewMode;
  /** 以卡片形态展示的节点 ID 集合 */
  cardNodeIds: string[];

  openNodeDetail: (nodeId: string) => void;
  closeNodeDetail: () => void;
  openDomainModal: () => void;
  closeDomainModal: () => void;
  openImportModal: () => void;
  closeImportModal: () => void;
  openFullScreen: (nodeId: string) => void;
  closeFullScreen: () => void;
  setFocusMode: (enabled: boolean) => void;
  setFocusDegree: (degree: number) => void;
  setSelectionTool: (tool: SelectionTool) => void;
  setViewMode: (mode: ViewMode) => void;
  /** 切换指定节点的卡片形态：若全部已是卡片则收起，否则展开 */
  toggleCardDisplay: (ids: string[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  nodeDetailOpen: false,
  nodeDetailId: null,
  domainModalOpen: false,
  importModalOpen: false,
  fullScreenNodeId: null,
  focusMode: false,
  focusDegree: 2,
  selectionTool: 'none',
  viewMode: 'canvas',
  cardNodeIds: [],

  openNodeDetail: (nodeId) => set({ nodeDetailOpen: true, nodeDetailId: nodeId }),
  closeNodeDetail: () => set({ nodeDetailOpen: false, nodeDetailId: null }),
  openDomainModal: () => set({ domainModalOpen: true }),
  closeDomainModal: () => set({ domainModalOpen: false }),
  openImportModal: () => set({ importModalOpen: true }),
  closeImportModal: () => set({ importModalOpen: false }),
  openFullScreen: (nodeId) => set({ fullScreenNodeId: nodeId }),
  closeFullScreen: () => set({ fullScreenNodeId: null }),
  setFocusMode: (enabled) => set({ focusMode: enabled }),
  setFocusDegree: (degree) => set({ focusDegree: degree }),
  setSelectionTool: (tool) => set((state) => ({ selectionTool: state.selectionTool === tool ? 'none' : tool })),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleCardDisplay: (ids) => {
    if (ids.length === 0) return;
    set((state) => {
      const cur = new Set(state.cardNodeIds);
      const allIn = ids.every((id) => cur.has(id));
      if (allIn) ids.forEach((id) => cur.delete(id));
      else ids.forEach((id) => cur.add(id));
      return { cardNodeIds: Array.from(cur) };
    });
  },
}));
