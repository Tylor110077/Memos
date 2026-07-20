# Memos v0.0.4 实施任务清单

## Phase 1：功能修复与增强

### T-301：移除聚焦模式 + 双击创建
- 删除 FocusControl 组件引用和渲染
- 删除 Canvas 中 onDoubleClick 创建节点逻辑
- 删除 uiStore 中 focusMode/focusDegree 相关状态
- 保留力模拟拖拽物理效果不变

### T-302：节点生成增强（多选+按钮）
- MessageBubble 每条 AI 回复下方添加 checkbox + "生成节点"按钮
- ChatPanel 顶部添加"生成选中节点"批量按钮
- 勾选多条后点击批量生成，调用 /api/graph/parse

### T-303：推荐功能（基于当前节点）
- 选中节点后在对话面板/节点详情中显示"相关推荐"区
- 调用 /api/recommend (type='related') 获取推荐
- 点击推荐项自动发送"给我讲讲{标题}"

### T-304：画板修复（hover + 居中）
- BoardSelector 列表项 hover 时显示编辑/删除（group-hover 覆盖整行）
- 切换画板后调用 reactFlowInstance.fitView()

### T-305：历史对话 + 滚动条
- conversations 表持久化对话（已有），ChatPanel 加载历史
- 添加对话历史列表 UI（可切换查看不同对话）
- 自定义滚动条 CSS（深色，细窄）

### T-306：更名为 Memos
- layout.tsx title 改为 "Memos"
- 对话面板/工具栏中所有 "Studyboard" 文字改为 "Memos"

## Phase 2：主题系统

### T-307：多主题切换
- 创建 ThemeProvider + CSS 变量方案
- 3 套主题：默认暗色 / 科技蓝紫 / 暖棕复古
- 设置入口（工具栏齿轮图标）
- 主题持久化到 localStorage

## 依赖关系
T-301~T-306 全部独立，可并行
T-307 独立（Phase 2）
