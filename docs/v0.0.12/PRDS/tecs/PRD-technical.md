# Memos v0.0.12 技术 PRD — 对话分段折叠

## 文档元数据

| 字段 | 值 |
|------|------|
| 版本 | v0.0.12 |
| 关联需求 | PRD-requirements.md |
| 日期 | 2026-07-20 |

---

## 数据模型

### ChatSegment（新增）

```typescript
interface ChatSegment {
  id: string;              // nanoid
  name: string;            // 分段名称
  startMsgIndex: number;   // 起始消息在 messages 数组中的索引
  endMsgIndex: number;     // 结束消息索引（含）
  collapsed: boolean;      // 是否折叠
  createdAt: string;
}
```

### 存储位置

分段数据存储在 `chatStore` 中，与当前对话关联：

```typescript
// chatStore 新增
segments: ChatSegment[];
addSegment: (seg: ChatSegment) => void;
updateSegment: (id: string, updates: Partial<ChatSegment>) => void;
removeSegment: (id: string) => void;
```

持久化：随对话一起存入 IndexedDB（`Conversation` 表新增 `segments` 字段）。

---

## 前端组件架构

```
ChatPanel
├── MessageList
│   ├── SegmentHeader        # 折叠态：主题名 + 消息数 + 操作按钮
│   ├── MessageBubble        # 展开态：正常消息渲染
│   └── SegmentMarker        # 标记起始/结束的侧边按钮
└── SegmentNameModal         # 命名弹窗（含 AI 命名按钮）
```

---

## 交互流程

1. 消息悬停 → 显示 `⊞` 标记按钮
2. 点击「标记起始」→ 该消息高亮 + 后续消息显示「标记结束」按钮
3. 点击「标记结束」→ 弹出 SegmentNameModal
4. 弹窗中可手动输入 或 点击「AI 命名」
5. 确认 → 创建 ChatSegment → 消息列表重渲染（该段可折叠）

---

## AI 命名 Prompt

```
请用不超过10个字概括以下对话的主题，只输出主题名，不要其他内容：

{对话内容}
```

调用 `/api/chat` 接口，mode 不限，单轮。

---

## 渲染逻辑

MessageList 渲染时：
1. 遍历 messages，检查当前 index 是否在某 segment 范围内
2. 若在且 segment.collapsed → 渲染 SegmentHeader（跳过该段后续消息）
3. 若在且 !collapsed → 正常渲染 MessageBubble
4. 若不在任何 segment → 正常渲染

---

## 目录结构

```
src/
├── components/chat/
│   ├── ChatPanel.tsx          # 新增 segments 状态管理
│   ├── MessageList.tsx        # 渲染逻辑改造
│   ├── MessageBubble.tsx      # 新增标记按钮
│   ├── SegmentHeader.tsx      # 新组件：折叠态标题栏
│   └── SegmentNameModal.tsx   # 新组件：命名弹窗
├── stores/
│   └── chatStore.ts           # 新增 segments 相关 state
└── types/
    └── index.ts               # 新增 ChatSegment 接口
```
