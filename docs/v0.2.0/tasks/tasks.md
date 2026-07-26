# Memos v0.2.0 Tasks — Obsidian 兼容文件系统导出与文件树视图

## 任务依赖图

```
Phase 1: 核心导出引擎
  T-001 (文件名安全化)
  T-002 (MD 生成器) ── depends on T-001
  T-003 (ExportService) ── depends on T-001, T-002
  T-004 (导出按钮 + 目录选择) ── depends on T-003

Phase 2: 文件树视图
  T-005 (FileTreeBuilder) ── 无依赖
  T-006 (FileTreeView 组件) ── depends on T-005
  T-007 (视图切换 Tab) ── depends on T-006

Phase 3: 增量同步 + 设置
  T-008 (增量检测逻辑) ── depends on T-003
  T-009 (自动同步设置项) ── depends on T-008
  T-010 (ZIP fallback) ── depends on T-003
```

---

## Phase 1：核心导出引擎

### T-001：文件名安全化工具

- **关联**：FR-009
- **依赖**：无
- **文件**：`src/lib/export/FileNameSanitizer.ts`
- **实施内容**：
  ```typescript
  export function sanitizeFileName(title: string, fallbackId?: string): string {
    // 替换非法字符 / \ : * ? " < > |
    // 合并连续下划线
    // trim 首尾
    // 限制 200 字符
    // 空标题 fallback
  }
  ```
- **验收**：
  - [ ] 所有非法字符被替换为 `_`
  - [ ] 空字符串返回 `untitled-{id前8位}`
  - [ ] 超长标题截断到 200 字符
  - [ ] `tsc --noEmit` 零错误

### T-002：Markdown 生成器

- **关联**：FR-002, FR-003, FR-004, FR-005, FR-006, FR-010
- **依赖**：T-001
- **文件**：`src/lib/export/MarkdownGenerator.ts`
- **实施内容**：
  - `generateFrontmatter(node)` → YAML 字符串
  - `generateBody(node, edges, allNodes)` → 正文 + 笔记 + 关联
  - `generateNodeMarkdown(node, edges, allNodes)` → 完整 MD 文件内容
  - 网页节点：正文首行 `[原文链接](url)`
  - 文件节点：正文含 `![[attachments/文件名]]`
  - 笔记区：使用 Obsidian callout 语法 `> [!note]`
  - 关联区：`[[双链]]` 按类型分组
- **验收**：
  - [ ] 生成的 MD 包含完整 frontmatter
  - [ ] 笔记按时间排序，含 kind 标签
  - [ ] 双链使用 `[[title]]` 格式
  - [ ] 网页/文件节点格式正确
  - [ ] `tsc --noEmit` 零错误

### T-003：ExportService 核心服务

- **关联**：FR-001, FR-004, FR-005, FR-008
- **依赖**：T-001, T-002
- **文件**：`src/lib/export/ExportService.ts`
- **实施内容**：
  - 单例类，持有 `FileSystemDirectoryHandle`
  - `selectDirectory()` → 调用 `showDirectoryPicker()`
  - `exportAll(nodes, edges, boards)` → 全量导出
  - `exportIncremental(changedNodeIds)` → 增量导出
  - `exportNode(node)` → 单节点导出（创建/更新 MD + 附件 + 白板）
  - `deleteNodeFile(nodeId, boardId)` → 删除节点时清理文件
  - Board 文件夹创建、attachments/ canvas/ 子目录创建
  - base64 → Blob → 文件写入
  - Handle 序列化存 IndexedDB，恢复时 `requestPermission()`
- **验收**：
  - [ ] 全量导出生成正确目录结构
  - [ ] 增量导出仅写变更文件
  - [ ] PDF base64 正确解码为二进制文件
  - [ ] 白板 JSON 写入 .excalidraw 文件
  - [ ] `tsc --noEmit` 零错误

### T-004：导出按钮 + 目录选择 UI

- **关联**：FR-008
- **依赖**：T-003
- **文件**：`src/components/canvas/Toolbar.tsx`
- **实施内容**：
  - 工具栏新增「导出为 Vault」按钮（FolderOutput 图标）
  - 点击 → 调用 `ExportService.selectDirectory()` + `exportAll()`
  - 导出中显示 Loader2 动画
  - 导出完成 Toast 提示「已导出 N 个文件」
  - 已授权目录时按钮文案变为「同步到 Vault」
- **验收**：
  - [ ] 按钮可见且可点击
  - [ ] 点击弹出目录选择器
  - [ ] 导出过程有 loading 状态
  - [ ] 完成后有成功提示
  - [ ] `tsc --noEmit` 零错误

---

## Phase 2：文件树视图

### T-005：FileTreeBuilder 数据构建

- **关联**：FR-007
- **依赖**：无
- **文件**：`src/lib/export/FileTreeBuilder.ts`
- **实施内容**：
  - `buildFileTree(nodes, edges, currentBoard)` → `FileTreeNode[]`
  - 按节点类型分组（可选）或平铺
  - 包含 attachments/ 和 canvas/ 虚拟文件夹
  - 支持搜索过滤（标题模糊匹配）
- **验收**：
  - [ ] 正确构建当前 Board 的树结构
  - [ ] 搜索过滤生效
  - [ ] `tsc --noEmit` 零错误

### T-006：FileTreeView 组件

- **关联**：FR-007
- **依赖**：T-005
- **文件**：`src/components/filetree/FileTreeView.tsx`, `FileTreeItem.tsx`
- **实施内容**：
  - 递归树组件，支持展开/折叠
  - 文件图标按 nodeType 区分颜色
  - 点击文件 → `openFullScreen(nodeId)`
  - 搜索框在顶部
  - 样式与现有深色主题一致
- **验收**：
  - [ ] 树正确渲染所有节点
  - [ ] 展开/折叠动画流畅
  - [ ] 点击文件打开详情
  - [ ] 搜索实时过滤
  - [ ] `tsc --noEmit` 零错误

### T-007：视图切换 Tab

- **关联**：FR-007
- **依赖**：T-006
- **文件**：`src/app/page.tsx`, `src/stores/uiStore.ts`
- **实施内容**：
  - uiStore 新增 `viewMode: 'canvas' | 'filetree'`
  - 主界面顶部或左侧添加切换 Tab/按钮
  - 画布视图和文件树视图条件渲染
- **验收**：
  - [ ] 切换按钮可见
  - [ ] 切换后视图正确切换
  - [ ] 状态不丢失
  - [ ] `tsc --noEmit` 零错误

---

## Phase 3：增量同步 + 设置 + Fallback

### T-008：增量检测逻辑

- **关联**：FR-008, NFR-002
- **依赖**：T-003
- **文件**：`src/lib/export/ExportService.ts`（扩展）
- **实施内容**：
  - 维护 `lastExportedAt` 时间戳
  - `getChangedNodeIds()` → 对比 `updatedAt > lastExportedAt`
  - 节点删除时记录待删除列表
  - 导出完成后更新 `lastExportedAt`
- **验收**：
  - [ ] 仅变更节点被写入
  - [ ] 删除节点对应文件被清理
  - [ ] `tsc --noEmit` 零错误

### T-009：自动同步设置项

- **关联**：FR-008
- **依赖**：T-008
- **文件**：`src/components/settings/SettingsModal.tsx`, `src/stores/settingsStore.ts`
- **实施内容**：
  - 设置页新增「自动同步到 Vault」开关
  - 开启后，节点变更 debounce 2s 自动调用增量导出
  - 显示上次同步时间
  - 未授权目录时开关 disabled + 提示
- **验收**：
  - [ ] 开关可切换
  - [ ] 开启后自动同步生效
  - [ ] 设置持久化
  - [ ] `tsc --noEmit` 零错误

### T-010：ZIP Fallback

- **关联**：FR-008, NFR-005
- **依赖**：T-003
- **文件**：`src/lib/export/ZipFallback.ts`
- **实施内容**：
  - 检测 `showDirectoryPicker` 是否可用
  - 不可用时使用 JSZip 打包所有文件
  - 触发浏览器下载 `.zip`
  - 安装 `jszip` 依赖
- **验收**：
  - [ ] 不支持 File System Access API 时自动 fallback
  - [ ] ZIP 内容结构正确
  - [ ] `tsc --noEmit` 零错误

---

## Definition of Done

- [ ] 所有 Task 验收 checklist 通过
- [ ] `tsc --noEmit` 零错误
- [ ] 导出目录可直接用 Obsidian 打开
- [ ] 文件树视图可正常浏览和导航
- [ ] 增量同步不丢失数据
- [ ] Git push 到 main
