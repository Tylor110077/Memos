# Memos v0.0.8 技术设计规格说明书

| 字段 | 值 |
|------|-----|
| 文档版本 | v0.0.8 |
| 关联需求 | docs/v0.0.8/PRDS/req/PRD-requirements.md |

## 1. 技术选型（ADR）

### ADR-701：API Key 存储
- **背景**：当前 API Key 硬编码在 .env 中，用户无法自行配置
- **选项**：A) localStorage  B) IndexedDB  C) 系统 keychain
- **决定**：localStorage（加密存储，前端可直接读取传给 API route）
- **后果**：安全性依赖浏览器沙箱，适合个人工具场景

### ADR-702：桌面应用框架
- **背景**：需要打包为 macOS 原生应用
- **选项**：A) Electron  B) Tauri  C) Neutralino
- **决定**：Tauri v2（Rust 后端，包体小 ~10MB，原生性能，内嵌 WebView）
- **后果**：需要 Rust 工具链，但打包体积远小于 Electron

### ADR-703：文件预览方案
- **背景**：需要预览 PDF/Word/Excel/PPT/MD
- **选项**：
  - PDF：react-pdf（pdf.js 封装）
  - Word：mammoth.js（docx → HTML）
  - Excel：xlsx + handsontable
  - PPT：pptxjs 或自研解析
  - MD：已有 MarkdownRenderer
- **决定**：PDF 用 react-pdf，Word 用 mammoth.js，Excel 用 xlsx+表格渲染，PPT 暂用 iframe 预览或降级为文本提取，MD 复用现有组件
- **后果**：PPT 预览效果可能有限，后续可升级

### ADR-704：文件类型图标
- **背景**：不同文件类型需要独特图标
- **决定**：使用 SVG 内联图标组件，按 materialType 映射品牌色图标
- **后果**：无需外部图标库依赖

## 2. 数据模型变更

```typescript
// settingsStore 新增
interface MemosSettings {
  // ...existing
  apiKey: string;           // 加密存储的 API Key
  apiProvider: 'qwen';     // 当前仅支持千问
}

// KnowledgeNode.metadata 新增
interface NodeMetadata {
  // ...existing
  materialType?: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'markdown' | 'article' | 'video';
  fileName?: string;       // 原始文件名
}
```

## 3. API 契约变更

### POST /api/chat
- 变更：从 request body 中读取 `apiKey` 字段（前端从 settingsStore 传入）
- 若 apiKey 为空，返回 400 `{ error: '请先在设置中配置 API Key' }`

### POST /api/recommend / POST /api/summarize / POST /api/domain
- 同上变更

## 4. 前端组件架构

```
src/
├── components/
│   ├── settings/
│   │   └── SettingsModal.tsx    # 新增 AI 配置区
│   ├── whiteboard/              # 已有
│   ├── file-preview/            # 新增：文件预览组件
│   │   ├── PdfPreview.tsx
│   │   ├── DocxPreview.tsx
│   │   ├── XlsxPreview.tsx
│   │   ├── PptxPreview.tsx
│   │   └── MarkdownEditor.tsx
│   └── canvas/nodes/
│       └── DotNode.tsx          # 修改：文件类型图标
├── stores/
│   └── settingsStore.ts         # 新增 apiKey 字段
└── src-tauri/                   # 新增：Tauri 配置
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/main.rs
```

## 5. 圈选续写技术方案

- 在圈选浮层中新增"续写 ⊕"按钮
- 点击后获取当前节点最后一条笔记（kind='manual'），将选中文字以 `\n` 拼接追加
- 若无笔记则创建新的 manual 笔记
- 使用 graphStore.updateNode 更新 notes 数组

## 6. 持久化策略

- API Key：localStorage（key: `memos-settings` 中的 `apiKey` 字段）
- 文件数据：IndexedDB（已有 fileData 字段，base64 存储）
- Tauri 模式：数据仍存 IndexedDB（WebView 内）

## 7. 目录结构（Tauri）

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── icons/          # 应用图标
└── src/
    └── main.rs     # 启动 Next.js server + 打开窗口
```

## 8. 环境变量

- 移除 .env 中的 QWEN_API_KEY 硬编码依赖
- 改为运行时从前端 settingsStore 传入
