import { create } from 'zustand';

export type SelectionTool = 'none' | 'box' | 'click';
export type ViewMode = 'canvas' | 'filetree';
export type NodeDisplayMode = 'dot' | 'card';

const DISPLAY_MODE_KEY = 'memos-node-display-mode';
function loadDisplayMode(): NodeDisplayMode {
  if (typeof window === 'undefined') return 'dot';
  const v = localStorage.getItem(DISPLAY_MODE_KEY);
  return v === 'card' ? 'card' : 'dot';
}

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
  /** 节点展示形态：圆点 / 卡片 */
  nodeDisplayMode: NodeDisplayMode;

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
  setNodeDisplayMode: (m: NodeDisplayMode) => void;
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
  nodeDisplayMode: loadDisplayMode(),

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
  setNodeDisplayMode: (m) => {
    if (typeof window !== 'undefined') localStorage.setItem(DISPLAY_MODE_KEY, m);
    set({ nodeDisplayMode: m });
  },
}));
