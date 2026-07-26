# Memos v0.2.0 技术 PRD — Obsidian 兼容文件系统导出与文件树视图

## 文档元数据

| 字段 | 值 |
|------|------|
| 版本 | v0.2.0 |
| 关联需求 | PRD-requirements.md |
| 日期 | 2026-07-20 |

---

## 技术目标

| NFR | 目标 | 实现策略 |
|-----|------|----------|
| NFR-001 | 100 节点 < 2s | 批量写入 + 并行 Promise.all |
| NFR-002 | 增量检测 | 维护 lastExportedAt 时间戳，对比 updatedAt |
| NFR-003 | 文件树 < 200ms | 虚拟滚动 + 懒加载子目录 |
| NFR-004 | 不重复存储 | 导出时 base64 → Blob → 文件，DB 中保留原数据 |
| NFR-005 | Obsidian 兼容 | 标准 YAML frontmatter + `[[双链]]` + `.excalidraw` |

---

## 技术选型

### ADR-001：文件系统访问方式

**背景**：浏览器需要写入本地文件系统
**选项**：
- A) File System Access API（Chrome/Edge 原生支持）
- B) JSZip 打包下载（全浏览器兼容）
- C) 本地 HTTP 服务 + Node 写文件

**决定**：A 为主 + B 为 fallback
**后果**：Safari/Firefox 用户首次导出为 ZIP，后续无法增量更新

### ADR-002：文件树组件

**背景**：需要高性能可展开文件树
**选项**：
- A) 自研递归组件 + 虚拟滚动
- B) react-arborist
- C) rc-tree

**决定**：A（自研，保持包体积最小，且节点量可控 < 1000）
**后果**：需自行实现展开/折叠/搜索/拖拽

### ADR-003：导出触发架构

**背景**：需要支持手动 + 自动两种模式
**选项**：
- A) 独立 ExportService 类（单例）
- B) Zustand store action
- C) Web Worker

**决定**：A（ExportService 单例，持有 FileSystemDirectoryHandle）
**后果**：页面刷新后需重新授权目录

---

## 系统架构

```
┌─────────────────────────────────────────────────┐
│                   主界面                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ 文件树视图 │  │ 画布视图  │  │   对话面板     │  │
│  │ FileTree  │  │ Canvas   │  │   ChatPanel   │  │
│  └─────┬────┘  └────┬─────  └───────────────┘  │
│        │             │                            │
│  ┌─────▼─────────────▼─────┐                     │
│  │      UIStore (viewMode)  │                     │
│  └─────────────────────────┘                     │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              ExportService (单例)                 │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ HandleManager│  │    MarkdownGenerator     │  │
│  │ (目录句柄缓存)│  │ (节点→MD 转换)           │  │
│  └─────────────┘  └──────────────────────────┘  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ IncrementalTracker│  │   FileTreeBuilder   │  │
│  │ (增量检测)        │  │ (目录树数据构建)     │  │
│  └─────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│           File System Access API                 │
│  导出目录/                                        │
│  ├── Board名称/                                   │
│  │   ├── 节点标题.md                              │
│  │   ├── attachments/                            │
│  │   │   └── 论文.pdf                            │
│  │   └── canvas/                                 │
│  │       └── 节点标题.excalidraw                  │
│  └── 另一个Board/                                 │
└─────────────────────────────────────────────────┘
```

---

## 数据模型

### 导出配置（新增到 settingsStore）

```typescript
interface ExportConfig {
  /** 是否启用自动同步 */
  autoSync: boolean;
  /** 上次导出时间戳 */
  lastExportedAt: string | null;
  /** 导出目录名（用于 UI 显示） */
  dirName: string | null;
}
```

### 文件树节点（UI 用）

```typescript
interface FileTreeNode {
  id: string;           // 节点 ID 或文件夹路径
  name: string;         // 显示名称
  type: 'folder' | 'file' | 'attachment';
  nodeType?: NodeType;  // 对应节点类型（仅 file）
  nodeId?: string;      // 对应节点 ID（仅 file）
  children?: FileTreeNode[];
  expanded?: boolean;
}
```

### MD Frontmatter 格式

```yaml
---
id: node-abc123
type: concept
level: 2
status: lit
boardId: board-xyz
createdAt: 2026-07-20T10:00:00Z
updatedAt: 2026-07-20T12:00:00Z
tags:
  - concept
  - knowledge
source: https://example.com    # 可选
materialType: pdf              # 可选
cognitionLevel: 3              # 可选
whiteboard: canvas/标题.excalidraw  # 可选
---
```

### MD 正文模板

```markdown
# {节点标题}

{节点内容（Markdown）}

## 笔记

> [!note] 手动笔记 · 2026-07-20 10:30
> 笔记内容...

> [!quote] 对话摘录 · 2026-07-20 11:00
> 摘录内容...

## 关联

### 层级
- [[父节点标题]]

### 相关
- [[关联节点标题]]
```

---

## API 契约

本功能为纯前端实现，不涉及后端 API。ExportService 直接操作 File System Access API。

---

## 前端组件架构

```
src/
├── components/
│   ├── filetree/
│   │   ├── FileTreeView.tsx       # 文件树主容器
│   │   ├── FileTreeItem.tsx       # 单个树节点（递归）
│   │   └── FileTreeSearch.tsx     # 搜索过滤
│   └── canvas/
│       └── Toolbar.tsx            # 新增「导出」按钮
├── lib/
│   ├── export/
│   │   ├── ExportService.ts       # 核心导出服务（单例）
│   │   ├── MarkdownGenerator.ts   # 节点 → MD 字符串
│   │   ├── FileNameSanitizer.ts   # 文件名安全化
│   │   ├── FileTreeBuilder.ts     # 从 store 数据构建文件树
│   │   └── ZipFallback.ts         # JSZip fallback
│   └── ...
└── stores/
    ├── settingsStore.ts           # 新增 exportConfig
    └── uiStore.ts                 # 新增 viewMode: 'canvas' | 'filetree'
```

---

## 状态管理设计

### uiStore 新增

```typescript
viewMode: 'canvas' | 'filetree';  // 主视图模式
setViewMode: (mode: 'canvas' | 'filetree') => void;
```

### settingsStore 新增

```typescript
exportConfig: ExportConfig;
setAutoSync: (enabled: boolean) => void;
```

---

## 持久化策略

| 数据 | 存储位置 | 说明 |
|------|----------|------|
| 导出目录 Handle | IndexedDB（序列化） | 页面刷新后可恢复（需用户重新授权） |
| lastExportedAt | localStorage（settingsStore） | 增量检测基准 |
| 文件树展开状态 | 内存（不持久化） | 每次打开重新构建 |

---

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 用户拒绝目录授权 | 提示并 fallback 为 ZIP 下载 |
| 写入失败（磁盘满等） | Toast 错误提示，不中断其他文件 |
| 文件名冲突 | 自动加后缀 `_2`, `_3` |
| Handle 失效（目录被移动） | 检测后提示重新选择目录 |

---

## 性能预算

| 操作 | 预算 |
|------|------|
| 全量导出 100 节点 | < 2s |
| 增量导出 1 节点 | < 100ms |
| 文件树构建 500 节点 | < 50ms |
| 文件树首屏渲染 | < 200ms |

---

## 安全考量

- File System Access API 需用户主动授权，无法静默访问
- 不上传任何数据到服务器
- 文件名安全化防止路径遍历攻击

---

## 目录结构（导出产物）

```
导出根目录/
├── 机器学习/                          # Board 文件夹
│   ├── 梯度下降.md                    # 节点 MD
│   ├── 反向传播.md
│   ├── 神经网络概述.md
│   ├── attachments/                  # 文件材料
│   │   ├── attention-is-all-you-need.pdf
│   │   └── lecture-notes.docx
│   └── canvas/                       # 白板数据
│       └── 神经网络概述.excalidraw
├── 自然语言处理/
│   ├── Transformer.md
│   ├── BERT.md
│   ├── attachments/
│   └── canvas/
└── .memos/                           # Memos 元数据（可选）
    └── edges.json                    # 边关系备份
```

---

## 环境变量

无新增环境变量。本功能纯前端实现。
