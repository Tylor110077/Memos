# Memos v0.0.6 Tasks

## Phase 1：推荐完善 + 对话面板精简

### T-501：推荐卡片展开完整内容（FR-501）
- NodeDetail 推荐卡片点击后展开显示完整 description + reason
- 展开态有视觉区分（边框高亮）
- 再次点击收起

### T-502：推荐缓存修复（FR-502/503）
- 排查 NodeDetail 推荐加载逻辑，确保先查 IndexedDB 缓存
- 缓存命中则立即显示（不发 API 请求）
- "换一批"按钮：clearRecommendations → 重新请求 → 保存

### T-550：对话面板精简（FR-550/551/552/553）
- 移除 ChatPanel 的"AI 对话"标题栏
- Plus（新建）+ Clock（历史）按钮移到 RightPanel Tab 栏右侧（收起按钮旁）
- 历史对话改为独立视图：点击 Clock 后整个内容区切换为历史列表（非顶部下拉），带"返回对话"按钮
- 收起后的展开按钮加大：w-8→w-12, h-8→h-12，加文字标签"对话"

## Phase 2：模式重构 + 全屏详情 + 拖拽

### T-520：外层移除模式切换（FR-520）
- ChatPanel 移除 ModeSelector 组件
- 硬编码 mode='learn'

### T-521：AI 助手侧栏模式切换（FR-521/522）
- FullScreenDetail AI sidebar 顶部添加模式下拉（学习/费曼/辩论/设计）
- 样式类似模型切换器（小圆点+文字+下拉箭头）
- 切换后 handleAiSend 传入对应 mode，影响 system prompt

### T-530：全屏详情居中留缝（FR-530/531）
- FullScreenDetail 从 `fixed inset-0` 改为居中卡片：`fixed inset-6 md:inset-10`
- 遮罩添加 `backdrop-blur-md`
- 卡片圆角 + 阴影
- 标题和内容区域居中（max-w-3xl mx-auto）

### T-540：AI 侧栏可拖拽（FR-540）
- FullScreenDetail AI sidebar 左边缘加拖拽手柄
- 宽度范围 280px ~ 50vw
- 拖拽逻辑同 RightPanel

### T-541：主面板限宽 50%（FR-541）
- RightPanel MAX_WIDTH 改为 `window.innerWidth / 2`
- 拖拽时动态计算

### T-510：手动归纳可见性（FR-510/511）
- 工具栏"归纳选中"按钮常驻显示（未选中时置灰+tooltip提示"Shift+点击选择节点"）
- 选中≥2时高亮+显示数量
