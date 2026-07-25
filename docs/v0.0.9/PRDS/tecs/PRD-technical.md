# Memos v0.0.9 技术设计规格说明书

| 字段 | 值 |
|------|-----|
| 文档版本 | v0.0.9 |
| 关联需求 | docs/v0.0.9/PRDS/req/PRD-requirements.md |

## 1. 技术选型（ADR）

### ADR-801：认知评审同心圆渲染
- **背景**：需要在节点详情中展示理解程度的同心圆可视化
- **选项**：A) SVG 手绘  B) Canvas  C) CSS conic-gradient
- **决定**：SVG（精确控制弧线、动画友好、可交互）
- **后果**：需要计算 arc path，但灵活度最高

### ADR-802：认知评审 AI Prompt
- **背景**：需要 AI 对费曼对话进行 5 档制理解程度评分
- **决定**：新增 `/api/evaluate` 接口，prompt 要求 AI 返回 `{ level: 1-5, reason: string, knowledgePoints: string[] }`
- **档位规则**：
  - 1 = 未理解：无法用自己的话解释核心概念
  - 2 = 模糊：能提及关键词但逻辑混乱或有重大错误
  - 3 = 基本：能正确解释主要概念，但细节有误或遗漏
  - 4 = 清晰：能准确解释且能举例，仅有极小瑕疵
  - 5 = 精通：能深入浅出、举一反三、指出边界条件

### ADR-803：画中画小窗拖拽实现
- **背景**：小窗需要可拖拽位置和可调大小
- **决定**：纯 React state + mouse event（mousedown/mousemove/mouseup），不引入额外库
- **后果**：代码量稍多但无依赖，性能可控

### ADR-804：PDF 重复加载修复
- **背景**：新建笔记触发组件 re-render，iframe src 不变但 React 重建 DOM
- **决定**：给 iframe 容器加 `key={node.id}` 而非依赖 notes 数组变化；或使用 `useMemo` 缓存 iframe 元素
- **后果**：需确保 key 稳定

### ADR-805：对话切换不丢失
- **背景**：打开全屏详情时 ChatPanel 可能被 unmount 导致 useChat 状态丢失
- **决定**：ChatPanel 使用 `display: none` 隐藏而非条件渲染卸载；或将 messages 持久化到 chatStore
- **后果**：需检查 RightPanel 的渲染逻辑

## 2. 数据模型变更

```typescript
// KnowledgeNode 新增
interface KnowledgeNode {
  // ...existing
  cognitionLevel?: number;           // 1-5 认知档位
  cognitionReason?: string;          // AI 评审理由
  cognitionHistory?: { level: number; evaluatedAt: string; conversationLength: number }[];
}

// settingsStore 新增
interface MemosSettings {
  // ...existing
  autoCognitionEval: boolean;        // 费曼对话结束后自动触发认知评审
}
```

## 3. API 契约

### POST /api/evaluate
- **Body**: `{ conversation: {role, content}[], nodeContent: string, apiKey?: string }`
- **Response**: `{ level: number, reason: string, knowledgePoints: string[] }`
- **关联**: FR-802

## 4. 前端组件架构

```
src/components/
├── cognition/
│   └── CognitionRing.tsx        # 同心圆 SVG 组件
├── pip/
│   └── PipWindow.tsx            # 可拖拽可调大小的画中画浮窗
└── node/
    └── FullScreenDetail.tsx     # 集成同心圆 + 修复 PDF 重载
```

## 5. 动效方案

- 全屏详情：`scaleIn/scaleOut` keyframe（已有 scaleIn，需补 scaleOut）
- AI 侧栏：`slideInRight/slideOutRight`（已有 slideInRight，需补 slideOutRight）
- Tab 切换：CSS `opacity` transition 150ms
- 下拉菜单：已有 `fadeIn`，补充 `transform: scaleY` 过渡
- 主对话面板：`translateX` transition 250ms ease-out

## 6. 持久化策略

- cognitionLevel/cognitionReason/cognitionHistory → IndexedDB（随节点存储）
- autoCognitionEval → localStorage（settingsStore）
