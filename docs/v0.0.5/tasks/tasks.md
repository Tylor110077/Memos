# Memos v0.0.5 Tasks

## Phase 1：数据隔离 + Sidebar 重构

### T-401：画板数据隔离
- 对话按 boardId 过滤（conversations 表查询加 boardId 条件）
- 切换画板时清空当前对话、重新加载该画板的对话历史
- 推荐面板按当前画板节点请求

### T-402：推荐结果缓存
- 在 IndexedDB 新增 recommendations 表（nodeId, results, createdAt）
- RecommendPanel 先查缓存，有则直接显示
- 添加"换一批"按钮强制刷新

### T-403：对话历史标注画板来源
- 保存对话时记录 boardName
- 历史列表标题格式：【画板名】第一条消息摘要

### T-410：移除推荐 Tab + 生成节点按钮
- RightPanel tabs 从 3 个改为 2 个（对话/详情）
- ChatPanel 移除顶部"生成节点"和"归纳主题"按钮

### T-411：历史对话融入 sidebar
- 对话 Tab 内顶部添加历史对话下拉（Clock 图标）
- 点击展开历史列表（在 sidebar 内，非全屏）
- 移除独立的全屏历史面板

### T-412：Sidebar 可拖拽调整宽度
- 右边缘添加拖拽手柄（4px 宽，hover 变色）
- 拖拽改变宽度（min 280px, max 600px）
- 宽度存入 localStorage 持久化

### T-413：收起无黑条
- collapsed 状态：宽度 0，展开按钮浮在画布右边缘
- 按钮样式：半透明圆形，与背景融合
- 展开动画：width transition 300ms

## Phase 2：归纳改造 + 全屏详情 + 连线

### T-420：自动归纳（工具栏）
- 工具栏添加"归纳"按钮（FolderTree 图标）
- 点击后调用 /api/graph/themes，基于当前画板所有节点
- 结果生成 theme 节点 + hierarchy 边

### T-421：手动归纳
- 用户按住 Shift 点击多个节点选中
- 选中后工具栏出现"归纳选中"按钮
- 调用 API 仅基于选中节点归纳

### T-430：全屏详情 AI 侧栏
- FullScreenDetail 右侧添加可展开的 AI 对话 sidebar（300px）
- 右上角按钮改为"问 AI"（展开/收起 sidebar）
- sidebar 内嵌简化版 ChatPanel（自动注入当前节点上下文）
- 对话保存到全局历史（带画板来源）

### T-441：断开连线
- 点击边选中（高亮）
- 选中后按 Delete/Backspace 删除
- 或右键边弹出"断开连接"菜单

### T-415：Memos 品牌空状态
- 对话空状态显示 "memos" 艺术字（手写体/渐变）
- 下方点缀动画（如浮动的知识图标）
- 副标题："开始一段探索"

### T-440：连线流动虚线预览
- 拖拽节点进入 80px 范围时，显示流动虚线（CSS animation dash）
- 松手后虚线变为实线（正式连线）
