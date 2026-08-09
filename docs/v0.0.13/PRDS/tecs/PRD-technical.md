# Memos v0.0.13 技术 PRD — 节点卡片化 + 多模态理解

## 文档元数据

| 字段 | 值 |
|------|------|
| 版本 | v0.0.13 |
| 关联需求 | PRD-requirements.md |
| 日期 | 2026-07-20 |

---

## 技术目标

| NFR | 目标 | 实现策略 |
|-----|------|----------|
| NFR-001 | 卡片渲染 < 300ms | 卡片为纯 React 组件，摘要截断展示 |
| NFR-002 | 多模态响应 | 图片直传 vl 模型；视频抽帧限 4 帧 |
| NFR-003 | 摘要持久化 | 复用 updateNode 写 IndexedDB |

---

## 技术选型

### ADR-001：卡片形态渲染

**背景**：节点需圆点/卡片双形态
**选项**：A) 新增独立 CardNode 组件注册为新 nodeType；B) 在 DotNode 内根据 displayMode 条件渲染
**决定**：B — 在 DotNode 内条件渲染，共用同一 nodeType，避免数据迁移
**后果**：DotNode 变复杂，但形态切换无需改数据

### ADR-002：多模态模型调用

**背景**：需理解图片/视频
**选项**：A) ai SDK 多模态 message（image part）；B) 直接 fetch DashScope chat/completions 传 image_url
**决定**：B — 直接 fetch，灵活控制 image_url/video_url part
**后果**：绕过 ai SDK 类型限制，需手动解析响应

### ADR-003：视频抽帧

**背景**：视频模型不一定可用，需降级
**选项**：A) 后端 ffmpeg；B) 前端 `<video>`+`<canvas>` 抽帧
**决定**：B — 前端抽帧，无后端依赖
**后果**：需用户浏览器解码视频，限抽 4 帧控制成本

---

## 数据模型

### KnowledgeNode 扩展（复用现有字段）

```typescript
// 已存在字段，无需新增：
// fileData?: string        // base64/dataURL（图片/文件）
// summary?: string         // AI 摘要
// whiteboardThumbnail?: string
// metadata.materialType?: 'pdf'|'docx'|'image'|'video'|...
```

新增 metadata 字段：
```typescript
metadata.understood?: boolean;      // 是否已完成多模态理解
metadata.understoodAt?: string;
```

### 展示形态（全局）

```typescript
// uiStore 新增
nodeDisplayMode: 'dot' | 'card';
setNodeDisplayMode: (m: 'dot' | 'card') => void;
```

---

## API 契约

### POST /api/understand（新增）

请求：
```json
{ "nodeId": "x", "type": "image|file|video", "dataUrl": "data:...", "text": "...", "apiKey": "..." }
```
响应：
```json
{ "summary": "..." }
```

- image：dataUrl 直传 qwen-vl-plus
- file：前端已提取 text，送 qwen-plus
- video：前端抽帧得 dataUrl[]，多图送 qwen-vl-plus

---

## 前端组件架构

```
DotNode.tsx            # 条件渲染 dot / card
└── NodeCard.tsx       # 新组件：卡片形态（标题/摘要/笔记数/白板缩略图/操作）
Toolbar.tsx            # 新增形态切换开关 + 理解内容入口
FullScreenDetail.tsx   # 新增"理解内容"按钮（多模态）
src/lib/multimodal.ts  # 新模块：图片/视频/文件理解 + 视频抽帧
```

---

## AI Prompt 工程

多模态理解 prompt：
```
你是一个知识整理助手。请理解用户提供的{图片|文档|视频}内容，
产出一段 100-200 字的中文摘要，提炼核心知识点。
只输出摘要，不要其他内容。
```

---

## 状态管理

- uiStore.nodeDisplayMode：全局形态
- graphStore.updateNode：写入 summary/metadata.understood

---

## 持久化

- summary/metadata 通过 updateNode 写 IndexedDB（已有链路）
- nodeDisplayMode 存 localStorage（uiStore 持久化）

---

## 错误处理

- 多模态理解失败 → Toast 提示，不阻塞
- 视频抽帧失败 → 降级为仅标题理解

---

## 性能预算

- 卡片首屏 < 300ms（摘要截断 80 字）
- 视频抽帧 4 帧，每帧 JPEG 0.7 质量

---

## 安全考量

- dataUrl 仅本地处理，不上传第三方
- 理解请求仅发往 DashScope

---

## 目录结构

```
src/
├── components/canvas/nodes/NodeCard.tsx   # 新
├── lib/multimodal.ts                      # 新
└── app/api/understand/route.ts            # 新
```

---

## 环境变量

- QWEN_VL_MODEL（默认 qwen-vl-plus）
