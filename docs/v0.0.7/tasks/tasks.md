# Memos v0.0.7 Tasks

## Phase 1：笔记系统 + 详情页按钮 + 快捷键

### T-601：笔记数据模型 + 详情页笔记区
- types/index.ts：NoteEntry + KnowledgeNode.notes
- FullScreenDetail：原内容下方新增"笔记"区
  - 手动输入笔记（输入框 + 保存，kind='manual'）
  - 笔记列表（带时间戳、kind 标签：手动/对话摘录/我的提问）
  - 持久化到 IndexedDB
- 关联：FR-601, FR-602

### T-602：对话内容加入笔记（整条 + 圈选）
- MessageBubble：每条消息（用户/AI）新增"加入笔记"按钮
  - 用户消息 → kind='question'，标注"我的提问"
  - AI 消息 → kind='chat'
  - 加入当前选中节点的笔记
- 圈选模式：
  - 对话区顶部"圈选"开关
  - 开启后 mouseup 监听 window.getSelection()
  - 选区非空且在对话区内 → 弹出确认浮层（显示选中文字）
  - 确认 → 追加到当前节点笔记（kind='chat'）
- 关联：FR-603, FR-604, FR-605

### T-603：主页面详情显示笔记 + 推荐引用
- NodeDetail（主页面详情面板）：显示节点笔记列表
- /api/recommend：currentNode 附带 notes 内容作为推荐参考
- 关联：FR-606, FR-607

### T-604：详情页分化/删除按钮
- FullScreenDetail 操作区：分化按钮（复用现有分化逻辑）+ 删除按钮（确认后删除并关闭）
- 关联：FR-620, FR-621

### T-605：快捷键系统
- settingsStore：shortcuts 映射（localStorage 持久化）
- useShortcuts hook：全局 keydown 监听（输入框内不触发）
- 默认：Cmd/Ctrl+K 聚焦对话、Cmd/Ctrl+Shift+N 新建对话、Cmd/Ctrl+F 适配视图
- SettingsModal 新增"快捷键"区：每个操作可按下新组合键重新绑定
- 关联：FR-610, FR-611, FR-612

## Phase 2：节点白板

### T-606：Excalidraw 白板集成
- 安装 @excalidraw/excalidraw
- Whiteboard 组件（懒加载 dynamic import）
- FullScreenDetail 新增"白板"Tab
- 白板 elements 序列化存入 KnowledgeNode.whiteboard
- 关联：FR-630, FR-631, FR-632

## 依赖关系
```
T-601 (笔记模型) ──→ T-602 (加入笔记) ──→ T-603 (显示+推荐)
T-604 (详情按钮)  独立
T-605 (快捷键)    独立
T-606 (白板)      独立（Phase 2）
```

## 里程碑
- M1（Phase 1）：笔记系统 + 详情按钮 + 快捷键
- M2（Phase 2）：白板
