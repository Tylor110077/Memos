# Memos v0.0.8 Tasks

## Phase 1：API Key 设置 + 圈选续写 + 材料笔记修复

### T-701：settingsStore 新增 apiKey 字段
- 关联：FR-701, FR-702
- 依赖：无
- 实施：
  - settingsStore.ts 新增 `apiKey: string` 和 `apiProvider: 'qwen'`
  - 新增 `setApiKey(key: string)` 方法
  - persist/loadSettings 包含 apiKey
  - DEFAULT_SETTINGS 中 apiKey 为空字符串
- 验收：
  - [ ] setApiKey 后刷新页面 key 保留
  - [ ] typecheck 通过

### T-702：设置页 UI 新增 AI 配置区
- 关联：FR-701, FR-704
- 依赖：T-701
- 实施：
  - SettingsModal.tsx 新增"AI 配置"section
  - 密码输入框（type=password）+ 显示/隐藏切换
  - 保存按钮 + 已配置状态指示
  - 标注"阿里千问 Qwen"
- 验收：
  - [ ] 设置页可见 AI 配置区
  - [ ] 输入 key 保存后刷新仍保留
  - [ ] typecheck 通过

### T-703：API routes 读取前端传入的 apiKey
- 关联：FR-702, FR-703
- 依赖：T-701
- 实施：
  - /api/chat、/api/recommend、/api/summarize、/api/domain 从 body 读取 apiKey
  - 若 apiKey 为空，fallback 到 process.env.QWEN_API_KEY
  - 若两者都为空，返回 400 提示配置
  - 前端调用时从 settingsStore 读取 apiKey 传入 body
- 验收：
  - [ ] 设置 key 后 AI 对话正常
  - [ ] 未设置 key 时提示配置
  - [ ] typecheck 通过

### T-704：圈选续写功能
- 关联：FR-720, FR-721, FR-722, FR-723, FR-724
- 依赖：无
- 实施：
  - ChatPanel.tsx 圈选浮层新增"续写 ⊕"按钮
  - FullScreenDetail.tsx AI 侧栏圈选浮层同步新增
  - 续写逻辑：获取当前节点最后一条 manual 笔记，追加 `\n` + 选中文字
  - 无笔记时创建新 manual 笔记
  - 续写后关闭浮层、清除选区
- 验收：
  - [ ] 圈选后浮层显示"加入笔记"和"续写 ⊕"两个按钮
  - [ ] 续写追加到最后一条笔记末尾
  - [ ] 无笔记时续写创建新笔记
  - [ ] 多次续写累加
  - [ ] typecheck 通过

### T-705：材料节点笔记区修复
- 关联：FR-730, FR-731
- 依赖：无
- 实施：
  - FullScreenDetail.tsx：材料节点（PDF/Web/MD）的内容区下方也显示笔记区
  - 当前笔记区仅在文本节点分支内，需提取到所有节点类型共享的位置
  - NodeDetail.tsx 已支持所有类型（无需改动）
- 验收：
  - [ ] 材料节点全屏详情可见笔记区
  - [ ] 可新建/编辑/删除笔记
  - [ ] typecheck 通过

## Phase 2：文件预览与图标

### T-706：文件类型图标组件
- 关联：FR-745
- 依赖：无
- 实施：
  - 创建 src/components/shared/FileTypeIcon.tsx
  - 按 materialType 渲染对应 SVG 图标（PDF=红、Word=蓝、Excel=绿、PPT=橙、MD=灰）
  - DotNode.tsx 中材料节点使用 FileTypeIcon 替代通用图标
- 验收：
  - [ ] 画布上不同文件类型显示不同图标
  - [ ] typecheck 通过

### T-707：PDF 预览组件
- 关联：FR-740
- 依赖：无
- 实施：
  - 安装 react-pdf
  - 创建 src/components/file-preview/PdfPreview.tsx
  - FullScreenDetail 中 PDF 节点使用 PdfPreview 替代 iframe
- 验收：
  - [ ] 导入 PDF 后双击可预览
  - [ ] typecheck 通过

### T-708：Word 预览组件
- 关联：FR-741
- 依赖：无
- 实施：
  - 安装 mammoth
  - 创建 src/components/file-preview/DocxPreview.tsx
  - 将 docx base64 转为 HTML 渲染
- 验收：
  - [ ] 导入 docx 后双击可预览
  - [ ] typecheck 通过

### T-709：Excel 预览组件
- 关联：FR-742
- 依赖：无
- 实施：
  - 安装 xlsx
  - 创建 src/components/file-preview/XlsxPreview.tsx
  - 解析 xlsx 为表格 HTML 渲染
- 验收：
  - [ ] 导入 xlsx 后双击可预览表格
  - [ ] typecheck 通过

### T-710：PPT 预览组件
- 关联：FR-743
- 依赖：无
- 实施：
  - 使用 pptxjs 或 jszip 解析 pptx 提取文本/图片
  - 创建 src/components/file-preview/PptxPreview.tsx
  - 降级方案：提取文本按页展示
- 验收：
  - [ ] 导入 pptx 后双击可预览
  - [ ] typecheck 通过

### T-711：Markdown 编辑器
- 关联：FR-744
- 依赖：无
- 实施：
  - 创建 src/components/file-preview/MarkdownEditor.tsx
  - 左右分栏：左侧编辑、右侧实时预览
  - 复用 MarkdownRenderer
- 验收：
  - [ ] 导入 md 后可编辑并实时预览
  - [ ] typecheck 通过

## Phase 3：macOS 桌面应用打包

### T-712：Tauri 项目初始化
- 关联：FR-710, FR-711, FR-712, FR-713
- 依赖：Phase 1 + Phase 2 完成
- 实施：
  - 安装 Tauri CLI
  - 初始化 src-tauri 目录
  - 配置 tauri.conf.json（窗口标题 Memos、尺寸 1280x800）
  - main.rs 中启动 Next.js standalone server 并打开 WebView
  - package.json 新增 `tauri:dev` 和 `tauri:build` 脚本
- 验收：
  - [ ] `npm run tauri:dev` 可启动桌面窗口
  - [ ] `npm run tauri:build` 生成 .app
  - [ ] 双击 .app 可正常运行

## 任务依赖图

```
T-701 ──→ T-702
T-701 ──→ T-703
T-704（独立）
T-705（独立）
T-706（独立）
T-707（独立）
T-708（独立）
T-709（独立）
T-710（独立）
T-711（独立）
Phase 1 + Phase 2 ──→ T-712
```

## Definition of Done

- 所有 Task 验收 checklist 全部通过
- `npm run typecheck` 零错误
- Browser Agent 端到端验证核心路径
- Git push 到 main
