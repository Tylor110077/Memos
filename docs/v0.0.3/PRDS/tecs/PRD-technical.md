# Studyboard v0.0.3 技术设计规格说明书

| 字段 | 值 |
|------|-----|
| 文档版本 | v0.0.3 |
| 状态 | Draft |
| 关联需求 | docs/v0.0.3/PRDS/req/PRD-requirements.md |

---

## 1. 技术选型（增量 ADR）

### ADR-301：连线改为纯直线

- **决定**：`getSmoothStepPath` → `getStraightPath`（@xyflow/react 内置）
- **后果**：零额外依赖，直接替换

### ADR-302：弹性物理增强

- **决定**：调整 d3-force 参数（forceLink.strength 提高到 0.6，distance 缩短到 80），拖拽时 alphaTarget 提高到 0.3
- **后果**：邻居被明显拉动，松手后弹性回弹

### ADR-303：近距离自动连线

- **决定**：onNodeDragStop 时计算与其他节点距离，< 50px 自动 addEdge
- **后果**：无需 React Flow 原生连线交互

### ADR-304：多画板数据模型

- **决定**：新增 `boards` 表（id, name, createdAt），nodes/edges 表添加 `boardId` 字段
- **后果**：查询时按 boardId 过滤

### ADR-305：AI 上下文注入

- **决定**：ChatPanel 的 useChat body 中传入 selectedNode 的 title + content，API 将其拼入 system prompt
- **后果**：AI 自动感知用户当前关注的节点

### ADR-306：文件导入

- **决定**：前端 FileReader 读取文件 → 按扩展名路由 → 存入 IndexedDB（Blob）→ 全屏详情中渲染
- **后果**：无需后端文件存储

## 2. 数据模型变更

```typescript
// 新增 Board 表
interface Board {
  id: string;
  name: string;
  createdAt: string;
}

// KnowledgeNode 添加
interface KnowledgeNode {
  boardId: string;  // 所属画板
  fileData?: string; // 文件内容（base64 或文本）
  fileName?: string;
  fileType?: 'pdf' | 'word' | 'excel' | 'markdown' | 'unknown';
}

// KnowledgeEdge 添加
interface KnowledgeEdge {
  boardId: string;
}
```

## 3. API 变更

### POST /api/chat 修改

system prompt 中追加选中节点上下文：
```
如果 context.selectedNode 存在，追加：
"用户当前正在查看的知识节点是：「{title}」，内容如下：{content}。请基于此上下文回答。"
```

### POST /api/scrape 修改

抓取成功后自动调用 AI 生成摘要，返回 `{ title, favicon, content, summary }`。

## 4. 组件变更

| 组件 | 变更 |
|------|------|
| KnowledgeEdge.tsx | getStraightPath 替换 getSmoothStepPath |
| useForceSimulation.ts | 增强弹性参数 + 碰撞力 |
| Canvas.tsx | onNodeDragStop 添加近距离连线检测 |
| ChatPanel.tsx | body 中传入 selectedNode 上下文 |
| FullScreenDetail.tsx | 右侧保留迷你对话入口 + iframe loading |
| ImportMaterialModal.tsx | 重构为自动路由（URL/文件） |
| 新增 BoardSelector.tsx | 画板库选择器（左上角下拉） |
| 新增 boardStore.ts | 画板状态管理 |

## 5. 目录结构变更

```
src/
├── stores/
│   └── boardStore.ts         # 新增
├── components/
│   ├── canvas/
│   │   └── BoardSelector.tsx # 新增
│   └── node/
│       └── FullScreenDetail.tsx  # 重构（+迷你对话+loading）
└── lib/
    └── fileUtils.ts          # 新增（文件类型检测+读取）
```
