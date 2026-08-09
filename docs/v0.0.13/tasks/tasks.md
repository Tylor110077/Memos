# v0.0.13 Tasks — 节点卡片化 + 多模态理解

## Phase 1：节点卡片形态

### T-001：uiStore 增加 nodeDisplayMode
- **关联**：FR-001
- **依赖**：无
- **实施**：uiStore 新增 `nodeDisplayMode: 'dot'|'card'` + setter + localStorage 持久化
- **验收**：切换后刷新保持

### T-002：NodeCard 卡片组件
- **关联**：FR-001, FR-002
- **依赖**：无
- **实施**：新建 NodeCard.tsx，展示标题/摘要(80字)/笔记数/类型标签/白板缩略图/展开按钮
- **验收**：卡片信息完整，可点开详情

### T-003：DotNode 条件渲染 + 工具栏切换开关
- **关联**：FR-001
- **依赖**：T-001, T-002
- **实施**：DotNode 按 nodeDisplayMode 渲染 dot/card；Toolbar 加切换开关
- **验收**：一键切换形态，动画平滑

## Phase 2：多模态理解

### T-004：multimodal.ts 理解模块 + 视频抽帧
- **关联**：FR-003, FR-004, FR-005
- **依赖**：无
- **实施**：图片直传 vl；文件文本送 plus；视频 canvas 抽 4 帧送 vl
- **验收**：三类内容均产出 summary

### T-005：/api/understand 路由
- **关联**：FR-003~005
- **依赖**：T-004
- **实施**：新增 route，按 type 调对应模型，返回 summary
- **验收**：接口返回摘要

### T-006：详情页"理解内容"按钮 + 摘要注入对话
- **关联**：FR-003~006
- **依赖**：T-005
- **实施**：FullScreenDetail 加按钮触发理解，写 summary；对话上下文注入 summary
- **验收**：理解后摘要参与对话

## Milestone

| # | 检查项 | 通过标准 | 状态 |
|---|--------|----------|------|
| 1 | 形态切换 | 圆点/卡片一键切换且持久化 | ☐ |
| 2 | 卡片信息 | 标题/摘要/笔记数/白板缩略图完整 | ☐ |
| 3 | 图片理解 | 图片产出 summary | ☐ |
| 4 | 文件理解 | PDF/Word 产出 summary | ☐ |
| 5 | 视频理解 | 抽帧产出 summary | ☐ |
| 6 | 摘要入对话 | summary 注入 system prompt | ☐ |
| 7 | TypeScript 零错误 | tsc --noEmit 通过 | ☐ |

## Definition of Done
- 所有 P0 task 完成并通过验收
- typecheck 零错误
- git push
