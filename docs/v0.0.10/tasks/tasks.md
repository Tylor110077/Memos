# Memos v0.0.10 Tasks

## Phase 1：消息操作 + 对话栏快捷键 + UI 修复

### T-901：AI 消息复制按钮
- 关联：FR-901, FR-903
- 实施：MessageBubble 和 FullScreenDetail AI 消息加 Copy 按钮（悬停显示）
- 验收：[ ] 复制按钮可见 [ ] 点击后剪贴板有内容 [ ] typecheck 通过

### T-902：用户消息重新编辑
- 关联：FR-902, FR-903
- 实施：用户消息悬停显示编辑按钮，点击后可编辑内容并重新发送
- 验收：[ ] 编辑按钮可见 [ ] 编辑后重新发送 [ ] typecheck 通过

### T-903：对话栏展开/关闭快捷键
- 关联：FR-950, FR-951, FR-952
- 实施：settingsStore 加 toggleChat 快捷键（默认 mod+j），useShortcuts 注册，设置页显示
- 验收：[ ] 快捷键可切换 [ ] 设置可配 [ ] 两处均可用 [ ] typecheck 通过

### T-904：认知环 UI 修复
- 关联：FR-940, FR-941
- 实施：CognitionRing 组件调整 SVG 尺寸比例，内圆半径增大，外层加 overflow-hidden
- 验收：[ ] 不溢出 [ ] 圆心填满 [ ] typecheck 通过

### T-905：按钮尺寸统一
- 关联：FR-942
- 实施：主内容区 header 按钮和侧栏 header 按钮统一为 p-2 rounded-lg
- 验收：[ ] 两侧按钮视觉一致 [ ] typecheck 通过

## Phase 2：节点颜色配置 + 圈选解释 + 续写选择

### T-906：节点颜色可配置
- 关联：FR-910, FR-911, FR-912
- 实施：settingsStore 加 nodeColors 字段，设置页加颜色配置区+图例，DotNode 读取配置
- 验收：[ ] 设置页可见 [ ] 修改后画布更新 [ ] 刷新保留 [ ] typecheck 通过

### T-907：圈选 AI 解释
- 关联：FR-920, FR-921
- 实施：SelectionPopup 加"解释"按钮，调用 /api/explain 接口，结果在浮层内展示
- 验收：[ ] 解释按钮可见 [ ] AI 返回格式化解析 [ ] typecheck 通过

### T-908：续写指定笔记
- 关联：FR-930, FR-931
- 实施：续写按钮点击后，若笔记>1 条弹出选择列表，否则直接续写
- 验收：[ ] 多条时弹出选择 [ ] 单条直接续写 [ ] typecheck 通过

## 任务依赖图

```
T-901（独立）
T-902（独立）
T-903（独立）
T-904（独立）
T-905（独立）
T-906（独立）
T-907（独立）
T-908（独立）
```

## Definition of Done
- 所有 Task 验收 checklist 全部通过
- `npm run typecheck` 零错误
- Git push 到 main
