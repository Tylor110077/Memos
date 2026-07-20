# Memos v0.0.7 技术设计规格说明书

| 字段 | 值 |
|------|-----|
| 文档版本 | v0.0.7 |
| 关联需求 | docs/v0.0.7/PRDS/req/PRD-requirements.md |

## 1. 技术选型（ADR）

### ADR-601：笔记数据模型
- **决定**：在 KnowledgeNode 增加 `notes: NoteEntry[]` 字段
- `NoteEntry = { id, content, kind: 'manual'|'chat'|'question', createdAt }`
- 理由：笔记与原内容分离，可区分来源，便于展示与推荐引用

### ADR-602：圈选文字
- **决定**：用 `window.getSelection()` 监听对话区文本选择，mouseup 时若选区非空且在对话区内，弹出确认浮层
- 理由：原生选区 API，无需额外依赖

### ADR-603：快捷键系统
- **决定**：全局 keydown 监听 + settingsStore 存储快捷键映射（localStorage 持久化）
- 默认：Cmd/Ctrl+K 聚焦对话、Cmd/Ctrl+Shift+N 新建对话、Cmd/Ctrl+F 适配视图
- 输入框/文本域聚焦时不触发（检查 e.target）
- 理由：行业惯例组合键，可自定义

### ADR-604：白板方案
- **决定**：集成 Excalidraw（@excalidraw/excalidraw），懒加载
- 白板数据（elements）序列化存入 KnowledgeNode.whiteboard 字段
- 理由：成熟开源白板，支持手绘/图形/箭头/文字，React 组件

## 2. 数据模型变更

```typescript
export interface NoteEntry {
  id: string;
  content: string;
  kind: 'manual' | 'chat' | 'question';  // 手动/对话摘录/我的提问
  createdAt: string;
}

interface KnowledgeNode {
  // ... 现有字段
  notes?: NoteEntry[];
  whiteboard?: string;  // Excalidraw elements JSON
}
```

## 3. API 变更

### /api/recommend
- currentNode 传入时附带 notes 内容，作为推荐参考（FR-607）

## 4. 组件变更

| 组件 | 变更 |
|------|------|
| FullScreenDetail | 新增笔记区（原内容下方）+ 分化/删除按钮 + 白板 Tab |
| MessageBubble | 新增"加入笔记"按钮（用户/AI 消息均可）+ 圈选模式 |
| NodeDetail（主页面） | 显示节点笔记 |
| SettingsModal | 新增"快捷键"区（可自定义绑定） |
| Whiteboard | 新组件，Excalidraw 懒加载 |
| useShortcuts | 新 hook，全局快捷键监听 |

## 5. 持久化
- notes / whiteboard 随 KnowledgeNode 存入 IndexedDB（现有 nodes 表）
