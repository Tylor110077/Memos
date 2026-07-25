# Memos v0.0.9 Tasks

## Phase 1：Bug 修复 + 对话加入笔记 + 动效

### T-801：修复 PDF iframe 重复加载
- 关联：FR-810
- 依赖：无
- 实施：
  - FullScreenDetail 中 PDF/网页 iframe 使用 `useMemo` 缓存，key 仅依赖 `node.id`
  - 确保 notes 状态变化不触发 iframe 容器重建
- 验收：
  - [ ] 新建笔记时 PDF 不闪烁
  - [ ] typecheck 通过

### T-802：修复详情→对话切换丢失对话
- 关联：FR-811
- 依赖：无
- 实施：
  - 检查 RightPanel 中 ChatPanel 的渲染条件
  - 改为 `display: none` 隐藏而非条件卸载，或确保 useChat messages 持久化
- 验收：
  - [ ] 打开详情再关闭，主对话历史保留
  - [ ] typecheck 通过

### T-803：AI 侧栏整段对话加入笔记
- 关联：FR-830
- 依赖：无
- 实施：
  - AI 侧栏标题栏新增"📋 加入笔记"按钮
  - 点击后将 aiMessages 全部格式化为一条笔记（kind='chat'）
  - 格式：每条消息 `**用户**：xxx\n**AI**：xxx` 拼接
- 验收：
  - [ ] 点击后整段对话作为一条笔记加入
  - [ ] typecheck 通过

### T-804：全局动效过渡
- 关联：FR-840, FR-841, FR-842, FR-843, FR-844
- 依赖：无
- 实施：
  - globals.css 补充 `scaleOut`、`slideOutRight` keyframe
  - FullScreenDetail 关闭时使用 scaleOut 动画（需状态控制延迟卸载）
  - AI 侧栏合上时使用 slideOutRight
  - Tab 切换加 opacity transition
  - 下拉菜单加 scaleY origin-top transition
- 验收：
  - [ ] 详情打开/关闭有平滑动效
  - [ ] 侧栏展开/合上有滑动动效
  - [ ] typecheck 通过

## Phase 2：画中画小窗增强

### T-805：画中画小窗可拖拽+可调大小+可滚动
- 关联：FR-820, FR-822, FR-823
- 依赖：无
- 实施：
  - 抽取 PipWindow 组件，支持 props: content, title
  - 标题栏 mousedown 拖拽位置（无边界限制）
  - 右下角 resize handle 拖拽大小（160px~400px）
  - 内容区 overflow-y: auto 可滚动
  - 移除 pointer-events-none
- 验收：
  - [ ] 小窗可拖拽到任意位置
  - [ ] 小窗可调整大小
  - [ ] 小窗内容可滚动
  - [ ] typecheck 通过

### T-806：视频小窗播放控制
- 关联：FR-821
- 依赖：T-805
- 实施：
  - 视频节点小窗内嵌 video 标签
  - 底部播放/暂停按钮 + 进度条
- 验收：
  - [ ] 视频小窗可播放/暂停
  - [ ] typecheck 通过

## Phase 3：费曼认知评审同心圆

### T-807：数据模型 + 设置开关
- 关联：FR-804
- 依赖：无
- 实施：
  - types/index.ts: KnowledgeNode 新增 cognitionLevel/cognitionReason/cognitionHistory
  - settingsStore: 新增 autoCognitionEval 字段 + 设置页 UI
- 验收：
  - [ ] 设置页可见开关
  - [ ] typecheck 通过

### T-808：/api/evaluate 接口
- 关联：FR-802, FR-803
- 依赖：T-807
- 实施：
  - 新建 src/app/api/evaluate/route.ts
  - Prompt 包含 5 档判定规则
  - 返回 { level, reason, knowledgePoints }
- 验收：
  - [ ] 接口可正常调用返回评分
  - [ ] typecheck 通过

### T-809：CognitionRing 同心圆组件
- 关联：FR-801, FR-805
- 依赖：T-807
- 实施：
  - 新建 src/components/cognition/CognitionRing.tsx
  - SVG 双环：外环灰色=知识范围，内环主题色填充=理解程度（level/5 * 360°）
  - 中心显示档位数字
  - 悬停显示 reason
  - 集成到 FullScreenDetail 内容区
- 验收：
  - [ ] 同心圆正确渲染
  - [ ] 填充比例与 level 对应
  - [ ] typecheck 通过

### T-810：费曼对话自动触发评审
- 关联：FR-801, FR-804
- 依赖：T-808, T-809
- 实施：
  - FullScreenDetail AI 侧栏：当 mode='feynman' 且 autoCognitionEval=true 时
  - 对话结束后（aiLoading 从 true→false 且消息数≥4）自动调用 /api/evaluate
  - 结果写入 node.cognitionLevel + cognitionHistory
  - 手动触发按钮始终可用
- 验收：
  - [ ] 费曼对话后自动评审
  - [ ] 关闭开关后不自动评审
  - [ ] typecheck 通过

## 任务依赖图

```
T-801（独立）
T-802（独立）
T-803（独立）
T-804（独立）
T-805（独立）──→ T-806
T-807 ──→ T-808
T-807 ──→ T-809
T-808 + T-809 ──→ T-810
```

## Definition of Done

- 所有 Task 验收 checklist 全部通过
- `npm run typecheck` 零错误
- Browser Agent 端到端验证核心路径
- Git push 到 main
