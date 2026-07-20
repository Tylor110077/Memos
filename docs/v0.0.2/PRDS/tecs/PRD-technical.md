# Studyboard v0.0.2 技术设计规格说明书

| 字段 | 值 |
|------|-----|
| 文档版本 | v0.0.2 |
| 状态 | Draft |
| 创建日期 | 2026-07-20 |
| 关联需求文档 | docs/v0.0.2/PRDS/req/PRD-requirements.md |
| 基线 | v0.0.1 技术架构（Next.js 15 + React Flow + Zustand + Dexie） |

---

## 1. 技术目标

| 对应需求 | 技术指标 | 实现策略 |
|----------|----------|----------|
| NFR-101 | 动画 60fps | CSS transform/opacity 动画，避免 layout thrashing |
| NFR-102 | 全屏展开 < 400ms | CSS transition + scale/opacity，无重渲染 |
| NFR-103 | 抓取超时 < 10s | AbortController + 服务端 fetch 超时 |
| NFR-104 | 邻居过滤 < 200ms | 预计算邻接表，前端过滤非网络请求 |

## 2. 技术选型（增量 ADR）

### ADR-201：Markdown 渲染增强

- **背景**：react-markdown 默认不支持 GFM 表格和代码高亮
- **选项**：react-markdown + remark-gfm + rehype-highlight / marked.js / MDX
- **决定**：react-markdown + remark-gfm + rehype-highlight + 自定义组件
- **后果**：保持现有 react-markdown 基础，增量添加插件

### ADR-202：节点动效方案

- **背景**：需要 Obsidian 风格光晕、呼吸、悬停放大效果
- **选项**：CSS animation / Framer Motion / React Spring
- **决定**：CSS animation + transition（轻量，无额外依赖）
- **后果**：性能最优，但复杂弹性动画受限

### ADR-203：网页内容抓取

- **背景**：需服务端抓取网页标题、favicon、正文
- **选项**：cheerio / readability + jsdom / 第三方 API (mercury)
- **决定**：Next.js API Route + cheerio（轻量 HTML 解析）
- **后果**：无外部依赖，但复杂 JS 渲染页面无法抓取

### ADR-204：全屏详情页

- **背景**：节点展开为全屏沉浸式页面
- **选项**：新路由页面 / 全屏 overlay 组件 / Portal
- **决定**：全屏 overlay 组件（fixed 定位 + z-index + 动画）
- **后果**：无需路由切换，保持画布状态不丢失

## 3. 新增/修改 API

### 3.1 POST /api/scrape（新增）

- **关联需求**：FR-140, FR-141, FR-142

```typescript
// Request
{ url: string }

// Response 200
{
  title: string;
  favicon: string;       // favicon URL
  content: string;       // 正文纯文本/Markdown
  excerpt: string;       // 前 200 字摘要
}

// Response 422 (抓取失败)
{ error: string; fallback: true }
```

### 3.2 POST /api/summarize（新增）

- **关联需求**：FR-164

```typescript
// Request
{ content: string; title: string }

// Response 200
{ summary: string }  // AI 生成的摘要
```

## 4. 数据模型变更

### KnowledgeNode 扩展字段

```typescript
interface KnowledgeNode {
  // ... 现有字段
  contentCategory?: 'knowledge' | 'trivia';  // 知识 vs 趣闻（FR-170）
  scrapedContent?: string;                    // 抓取的原文（FR-140）
  scrapedTitle?: string;                      // 抓取的标题
  scrapedFavicon?: string;                    // favicon URL
  summary?: string;                           // AI 摘要（FR-164）
}
```

### UI Store 扩展

```typescript
interface UIState {
  // ... 现有字段
  // 全屏详情（FR-160）
  fullScreenNodeId: string | null;
  openFullScreen: (nodeId: string) => void;
  closeFullScreen: () => void;

  // 邻居过滤（FR-150/151）
  focusMode: boolean;
  focusDegree: number;  // 1-4
  setFocusMode: (enabled: boolean) => void;
  setFocusDegree: (degree: number) => void;
}
```

## 5. 前端组件变更

### 新增组件

| 组件 | 路径 | 职责 |
|------|------|------|
| FullScreenDetail | components/node/FullScreenDetail.tsx | 全屏节点详情（编辑器/iframe/播放器） |
| MarkdownRenderer | components/shared/MarkdownRenderer.tsx | 统一 GFM 渲染组件 |
| FocusControl | components/canvas/FocusControl.tsx | 邻居过滤控制面板 |

### 修改组件

| 组件 | 变更内容 |
|------|----------|
| MessageBubble.tsx | 替换为 MarkdownRenderer + 单条生成节点按钮 |
| ModeSelector.tsx | 添加模式简介 tooltip + 切换动画 + 颜色标识 |
| ChatPanel.tsx | 添加滑入/滑出动画（CSS transition） |
| 所有节点组件 | Obsidian 风格重构（圆形/光晕/动效） |
| KnowledgeEdge.tsx | 曲线 + 透明度 + hover 高亮 |
| Canvas.tsx | 邻居过滤逻辑 + 节点出现动画 |
| Toolbar.tsx | 添加聚焦模式切换按钮 |
| ImportMaterialModal.tsx | 导入后调用 /api/scrape 抓取内容 |

## 6. 动效规格

| 动效 | 属性 | 时长 | 缓动 |
|------|------|------|------|
| 对话栏滑入/出 | transform: translateX | 300ms | ease-in-out |
| 节点 hover 放大 | transform: scale(1.1) | 150ms | ease-out |
| 节点出现 | scale(0)→scale(1) + opacity | 300ms | cubic-bezier(0.34,1.56,0.64,1) |
| 全屏展开 | scale + opacity + border-radius | 350ms | ease-out |
| 全屏关闭 | 反向 | 250ms | ease-in |
| 模式切换 | 背景色过渡 + 文字切换 | 200ms | ease |

## 7. 邻居过滤算法

```typescript
// 预计算邻接表
function buildAdjacencyMap(edges: KnowledgeEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, new Set());
    if (!map.has(edge.target)) map.set(edge.target, new Set());
    map.get(edge.source)!.add(edge.target);
    map.get(edge.target)!.add(edge.source);
  }
  return map;
}

// BFS 获取 N 度邻居
function getNDegreeNeighbors(nodeId: string, degree: number, adj: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>([nodeId]);
  let frontier = [nodeId];
  for (let d = 0; d < degree; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adj.get(id) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return visited;
}
```

非范围内节点：opacity 0.15，连线 opacity 0.05（半透明淡化，非隐藏）。

## 8. 目录结构变更

```
src/
├── components/
│   ├── shared/
│   │   └── MarkdownRenderer.tsx    # 新增
│   ├── node/
│   │   ├── FullScreenDetail.tsx    # 新增
│   │   └── NodeDetail.tsx          # 保留（轻量预览）
│   ├── canvas/
│   │   ├── FocusControl.tsx        # 新增
│   │   └── nodes/                  # 全部重构为 Obsidian 风格
│   └── chat/
│       ├── MessageBubble.tsx       # 重构（GFM + 单条生成）
│       └── ModeSelector.tsx        # 重构（简介 + 动画）
├── app/api/
│   ├── scrape/route.ts             # 新增
│   └── summarize/route.ts          # 新增
└── lib/
    └── graphAlgorithms.ts          # 新增（邻居过滤算法）
```

## 9. 新增依赖

```bash
npm install remark-gfm rehype-highlight cheerio
```

| 包 | 用途 |
|-----|------|
| remark-gfm | GFM 表格/删除线/任务列表支持 |
| rehype-highlight | 代码块语法高亮 |
| cheerio | 服务端 HTML 解析（网页抓取） |
