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
}));
