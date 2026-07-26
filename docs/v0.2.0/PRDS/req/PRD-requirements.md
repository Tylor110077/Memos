# Memos v0.2.0 需求 PRD — Obsidian 兼容文件系统导出与文件树视图

## 文档元数据

| 字段 | 值 |
|------|------|
| 版本 | v0.2.0 |
| 状态 | Draft |
| 日期 | 2026-07-20 |
| 作者 | Tylor |

---

## 概述

将 Memos 的知识图谱数据以 Obsidian 兼容的 Markdown 文件系统形式持久化到本地磁盘，每个 Board 映射为文件夹、每个节点映射为 `.md` 文件，同时在主界面提供文件树视图，让用户以目录结构浏览所有知识资产，为未来作为 Obsidian 插件奠定基础。

---

## 问题陈述

| # | 痛点 | 影响 |
|---|------|------|
| 1 | 数据仅存于 IndexedDB，无法跨工具使用 | 知识孤岛，无法与 Obsidian 等 PKM 工具互通 |
| 2 | 无文件系统视图，节点关系不直观 | 用户难以全局浏览知识结构 |
| 3 | 文件类材料（PDF 等）以 base64 存于 DB | 体积膨胀、不可外部访问 |
| 4 | 白板数据嵌于节点 JSON 中 | 无法独立查看/编辑白板 |

---

## 设计原则

- **DP-1**：Obsidian Vault 兼容 — 导出的目录结构可直接作为 Obsidian Vault 打开
- **DP-2**：单向导出为主、双向同步为辅 — 首期实现 Memos → 文件系统导出，后续迭代双向同步
- **DP-3**：增量更新 — 仅导出变更的节点，避免全量重写
- **DP-4**：文件树即导航 — 主界面文件树与画布双向联动
- **DP-5**：人类可读 — MD 文件格式清晰、frontmatter 规范、Obsidian 插件可直接解析

---

## 用户画像

### Persona 1：知识管理者小林
- 使用 Memos 构建课程知识图谱
- 希望导出后用 Obsidian 做进一步笔记链接和日记关联
- 需求：一键导出为 Obsidian Vault

### Persona 2：研究者小王
- 导入大量 PDF 论文到 Memos
- 希望文件以真实文件形式存在于磁盘，方便用其他工具打开
- 需求：PDF 文件独立存储，MD 中用链接引用

### Persona 3：开发者小张
- 想把 Memos 作为 Obsidian 插件使用
- 需求：数据格式与 Obsidian 完全兼容

---

## 功能需求

### FR-001：Board → 文件夹映射 [P0]

**Given** 用户有一个名为「机器学习」的 Board
**When** 系统执行导出
**Then** 在导出根目录下生成 `机器学习/` 文件夹

验收标准：
- [ ] 文件夹名 = Board 名称（非法字符替换为 `_`）
- [ ] 每个 Board 对应唯一文件夹
- [ ] Board 重命名时文件夹同步重命名

### FR-002：节点 → MD 文件 [P0]

**Given** 一个 concept 类型节点，标题为「梯度下降」，内容为「...」，有 2 条笔记
**When** 系统执行导出
**Then** 生成 `梯度下降.md`，包含 frontmatter + H1 标题 + 正文 + 笔记区

验收标准：
- [ ] 文件名 = 节点标题 + `.md`（非法字符替换）
- [ ] 文件头部含 YAML frontmatter（id, type, level, status, createdAt, updatedAt, tags）
- [ ] H1 = 节点标题
- [ ] 正文 = 节点 content（Markdown 格式）
- [ ] `## 笔记` 区域列出所有 NoteEntry（含时间戳和 kind 标签）
- [ ] 同名节点自动加后缀 `_2`, `_3`...

### FR-003：网页材料节点 → MD + URL [P0]

**Given** 一个 material 类型节点，metadata.source = `https://example.com/article`
**When** 系统执行导出
**Then** 生成 MD 文件，正文包含 `[原文链接](https://example.com/article)` + 抓取内容

验收标准：
- [ ] MD 正文首行为原文链接（Markdown 链接格式）
- [ ] 后续为抓取的正文内容
- [ ] 笔记区同 FR-002

### FR-004：文件材料节点 → MD + 实际文件 [P0]

**Given** 一个 material 类型节点，materialType = `pdf`，fileData 为 base64
**When** 系统执行导出
**Then** 实际文件保存到 `Board文件夹/attachments/` 子目录，MD 中用相对路径链接引用

验收标准：
- [ ] 实际文件保存为 `attachments/原始文件名.pdf`
- [ ] MD 正文包含 `![[attachments/原始文件名.pdf]]`（Obsidian 嵌入语法）或 `[文件名](attachments/原始文件名.pdf)`
- [ ] MD 中其余内容（笔记、AI 摘要等）正常写入
- [ ] base64 数据解码为二进制文件

### FR-005：白板数据 → 独立文件 [P0]

**Given** 一个节点有 whiteboard 字段（Excalidraw JSON）
**When** 系统执行导出
**Then** 白板 JSON 保存为 `Board文件夹/canvas/节点标题.excalidraw`

验收标准：
- [ ] 文件路径：`{board}/canvas/{sanitized_title}.excalidraw`
- [ ] 文件内容为 Excalidraw JSON 格式
- [ ] 对应节点 MD 的 frontmatter 中记录 `whiteboard: canvas/节点标题.excalidraw`

### FR-006：边关系 → MD 双链 [P1]

**Given** 节点 A 和节点 B 之间有一条 association 边
**When** 系统执行导出
**Then** 在 A 的 MD 文件末尾 `## 关联` 区域添加 `[[B标题]]`，反之亦然

验收标准：
- [ ] 使用 Obsidian 双链语法 `[[title]]`
- [ ] 按边类型分组（层级 / 关联 / 引用）
- [ ] 双向写入

### FR-007：主界面文件树视图 [P0]

**Given** 用户打开 Memos 主界面
**When** 用户切换到文件树视图
**Then** 左侧面板显示当前 Board 的目录树结构

验收标准：
- [ ] 文件树以 Board 文件夹为根
- [ ] 节点显示为 `.md` 文件图标 + 标题
- [ ] 文件夹节点（attachments/ canvas/）可展开/折叠
- [ ] 点击 MD 文件 → 打开对应节点的全屏详情
- [ ] 文件树与画布视图可切换（Tab 或按钮）
- [ ] 文件树支持搜索过滤

### FR-008：导出触发方式 [P0]

**Given** 用户想要导出数据
**When** 用户点击工具栏「导出为 Vault」按钮 或 设置中开启「自动同步」
**Then** 系统执行增量导出

验收标准：
- [ ] 手动导出：工具栏按钮触发，弹出目录选择器（File System Access API）
- [ ] 自动同步：设置中可开启，每次节点变更后 debounce 2s 自动写入
- [ ] 首次导出为全量，后续为增量
- [ ] 导出进度提示

### FR-009：文件名安全化 [P0]

**Given** 节点标题包含 `/ \ : * ? " < > |` 等非法字符
**When** 系统生成文件名
**Then** 非法字符替换为 `_`，连续下划线合并，首尾 trim

验收标准：
- [ ] 所有非法字符被替换
- [ ] 文件名长度不超过 200 字符
- [ ] 空标题 fallback 为 `untitled-{id前8位}`

### FR-010：Frontmatter 规范 [P0]

**Given** 任意节点导出为 MD
**When** 查看文件头部
**Then** 包含标准 YAML frontmatter

验收标准：
- [ ] 必含字段：id, type, level, status, boardId, createdAt, updatedAt
- [ ] 可选字段：source, materialType, cognitionLevel, whiteboard, tags
- [ ] tags 数组包含节点 type + contentCategory
- [ ] 格式符合 Obsidian Properties 规范

---

## 非功能需求

| ID | 需求 | 指标 |
|----|------|------|
| NFR-001 | 导出性能 | 100 节点全量导出 < 2s |
| NFR-002 | 增量检测 | 基于 updatedAt 时间戳，仅写变更文件 |
| NFR-003 | 文件树渲染 | 500 节点文件树首屏 < 200ms |
| NFR-004 | 磁盘空间 | 不重复存储 base64，文件以二进制形式独立存储 |
| NFR-005 | Obsidian 兼容 | 导出目录可直接作为 Vault 打开，双链可跳转 |

---

## 用户旅程

### 旅程 1：首次导出
1. 用户在工具栏点击「导出为 Vault」
2. 浏览器弹出目录选择器
3. 用户选择一个空文件夹
4. 系统全量导出，显示进度
5. 导出完成，提示「已导出 N 个文件到 xxx」

### 旅程 2：文件树浏览
1. 用户切换到文件树视图
2. 看到 Board 文件夹结构
3. 展开文件夹，看到各节点 MD 文件
4. 点击某 MD 文件 → 打开节点详情

### 旅程 3：Obsidian 打开
1. 用户打开 Obsidian
2. 选择「打开文件夹作为 Vault」
3. 选择之前导出的目录
4. 所有 MD 文件可见，双链可跳转，PDF 可预览

---

## MVP 范围

| 优先级 | FR 编号 |
|--------|---------|
| P0 | FR-001 ~ FR-005, FR-007 ~ FR-010 |
| P1 | FR-006 |
| P2 | （后续迭代：双向同步、Obsidian 插件壳） |

---

## 约束与假设

- 浏览器环境使用 File System Access API（Chrome/Edge 支持），Safari/Firefox fallback 为 ZIP 下载
- 首期不实现从文件系统导入回 Memos（单向导出）
- Excalidraw 文件格式保持 `.excalidraw` 扩展名（Obsidian Excalidraw 插件可识别）
- 文件树视图与画布视图共存，通过 Tab 切换

---

## 开放问题

| # | 问题 | 暂定方案 |
|---|------|----------|
| 1 | Safari 不支持 File System Access API | Fallback 为 JSZip 打包下载 |
| 2 | 大量文件时 File System Access API 性能 | 增量写入 + 批量 handle 缓存 |
| 3 | 节点标题修改后文件名同步 | 删除旧文件 + 创建新文件 |
