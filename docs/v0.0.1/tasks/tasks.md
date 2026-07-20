# Studyboard v0.0.1 实施任务清单

| 字段 | 值 |
|------|-----|
| 关联需求文档 | docs/v0.0.1/PRDS/req/PRD-requirements.md |
| 关联技术文档 | docs/v0.0.1/PRDS/tecs/PRD-technical.md |
| 版本 | v0.0.1 |
| 更新日期 | 2026-07-20 |

---

## Definition of Done（全局标准）

每个任务完成须满足：
- [ ] 代码可编译，无 TypeScript 错误
- [ ] 关联的验收标准全部通过
- [ ] 无控制台未处理异常
- [ ] 相关组件/模块有基本注释

---

## Phase 1：MVP Core

### T-001：项目初始化

| 属性 | 值 |
|------|-----|
| 关联需求 | NFR-004 |
| 依赖 | 无 |
| 预估 | 小 |

**实施内容：**

```bash
# 创建 Next.js 项目
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 安装依赖
npm install @xyflow/react zustand dexie dexie-react-hooks ai @ai-sdk/openai nanoid date-fns lucide-react zod
```

创建目录结构（见技术文档 Section 13）。

确认 `.env` 包含：
```env
QWEN_API_KEY=<key>
QWEN_MODEL=qwen-plus-3.7
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

**验收标准：**
- [ ] `npm run dev` 启动成功，页面可访问
- [ ] `npm run build` 无报错
- [ ] 目录结构与技术文档一致

---

### T-002：类型定义与数据层

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-010, FR-011, NFR-003 |
| 依赖 | T-001 |
| 预估 | 中 |

**实施内容：**

1. 创建 `src/types/index.ts`：定义 KnowledgeNode, KnowledgeEdge, Conversation, ChatMessage, DomainGraph 等全部接口（见技术文档 Section 4.1）

2. 创建 `src/lib/db.ts`：Dexie 数据库初始化 + CRUD 操作函数

```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { KnowledgeNode, KnowledgeEdge, Conversation, DomainGraph } from '@/types';

class StudyboardDB extends Dexie {
  nodes!: EntityTable<KnowledgeNode, 'id'>;
  edges!: EntityTable<KnowledgeEdge, 'id'>;
  conversations!: EntityTable<Conversation, 'id'>;
  domains!: EntityTable<DomainGraph, 'id'>;

  constructor() {
    super('StudyboardDB');
    this.version(1).stores({
      nodes: 'id, type, level, status, parentId, metadata.createdAt, metadata.domainId',
      edges: 'id, source, target, type, [source+target]',
      conversations: 'id, nodeId, mode, createdAt',
      domains: 'id, name',
    });
  }
}

export const db = new StudyboardDB();
```

3. 实现 CRUD 函数：createNode, updateNode, deleteNode（级联删边）, createEdge, deleteEdge, getEdgesByNode, getEdgeBetween 等

**验收标准：**
- [ ] 所有类型定义完整，无 any
- [ ] db 实例可正常创建
- [ ] CRUD 函数可正确读写 IndexedDB（通过浏览器 DevTools 验证）
- [ ] deleteNode 同时删除关联边

---

### T-003：状态管理 Store

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-003, FR-004, FR-005, FR-007, FR-013 |
| 依赖 | T-002 |
| 预估 | 中 |

**实施内容：**

1. `src/stores/graphStore.ts`：
   - nodes/edges 数组状态
   - selectedNodeId/selectedEdgeId
   - initializeGraph（从 IndexedDB 加载）
   - addNode/updateNode/removeNode/addEdge/removeEdge
   - applyGraphChanges（批量操作）
   - 每个写操作同步写穿 IndexedDB

2. `src/stores/chatStore.ts`：
   - currentConversation, currentMode, isStreaming
   - startConversation, setMode, endConversation

3. `src/stores/uiStore.ts`：
   - chatPanelOpen, nodeDetailOpen, domainModalOpen
   - toggle 方法

**验收标准：**
- [ ] graphStore 初始化后从 IndexedDB 正确加载数据
- [ ] addNode 后 Store 和 IndexedDB 同时更新
- [ ] removeNode 后关联边同步删除
- [ ] applyGraphChanges 可批量添加节点和边

---

### T-004：无限画布实现

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-001, FR-002, FR-003, FR-004, FR-005, FR-007, FR-010 |
| 依赖 | T-003 |
| 预估 | 大 |

**实施内容：**

1. `src/components/canvas/Canvas.tsx`：
   - ReactFlow 组件，绑定 graphStore
   - 自定义 nodeTypes 映射 5 种节点组件
   - 自定义 edgeTypes 映射 KnowledgeEdge
   - onNodesChange → 同步位置到 Store
   - onConnect → 创建边
   - onPaneDoubleClick → 创建新节点
   - Background dots + Controls + MiniMap

2. 自定义节点组件（`src/components/canvas/nodes/`）：
   - ConceptNode：蓝色圆角矩形
   - ThemeNode：紫色大容器
   - MaterialNode：绿色带链接图标
   - UnderstandingNode：橙色带引号
   - QuestionNode：黄色虚线边框
   - unlit 状态：灰色 + 虚线 + 半透明
   - 所有节点含 Handle (source/target)

3. 自定义边组件（`src/components/canvas/edges/KnowledgeEdge.tsx`）：
   - hierarchy: 实线粗 (#94a3b8, 2px)
   - association: 蓝色虚线 (#60a5fa, 1.5px, dash 5,5)
   - reference: 绿色点线 (#34d399, 1px, dash 2,2)

4. `src/components/canvas/Toolbar.tsx`：
   - 缩放控制、打开对话、生成领域图谱、搜索

**验收标准：**
- [ ] 画布可无限平移和缩放
- [ ] 5 种节点类型有明确视觉区分
- [ ] 节点可拖拽，位置保存
- [ ] 可从节点拖出连线
- [ ] 可选中并删除连线
- [ ] 双击空白处创建新节点
- [ ] 3 种边类型有视觉区分

---

### T-005：AI 对话模块

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-030, FR-031, FR-036, FR-037 |
| 依赖 | T-001 |
| 预估 | 大 |

**实施内容：**

1. `src/lib/ai.ts`：Qwen 客户端封装
```typescript
import { createOpenAI } from '@ai-sdk/openai';

export const qwen = createOpenAI({
  baseURL: process.env.QWEN_BASE_URL,
  apiKey: process.env.QWEN_API_KEY,
});
```

2. `src/prompts/`：4 个模式的 System Prompt（见技术文档 Section 7）

3. `src/app/api/chat/route.ts`：
   - 接收 messages + mode + context
   - 根据 mode 选择 system prompt
   - streamText 流式输出
   - 错误处理（400/429/500）

4. `src/components/chat/ChatPanel.tsx`：
   - 右侧 400px 面板，可收起
   - 使用 `useChat` hook (ai/react)
   - body 携带 mode + context

5. `src/components/chat/ModeSelector.tsx`：学习/费曼/辩论/设计 Tab 切换

6. `src/components/chat/MessageList.tsx` + `MessageBubble.tsx`：
   - Markdown 渲染（react-markdown）
   - 流式输出动画

7. `src/components/chat/ChatInput.tsx`：输入框 + 发送按钮 + Enter 发送

**验收标准：**
- [ ] 学习模式：提问后 AI 流式回复，首 token < 3s
- [ ] 费曼模式：AI 以求知者姿态追问，不否定
- [ ] 对话面板可收起/展开
- [ ] 消息支持 Markdown 渲染
- [ ] 模式切换正常
- [ ] API 错误时有友好提示

---

### T-006：图谱解析模块

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-032, FR-033 |
| 依赖 | T-005, T-004 |
| 预估 | 大 |

**实施内容：**

1. `src/schemas/index.ts`：Zod schemas（graphParseSchema 等，见技术文档 7.6）

2. `src/app/api/graph/parse/route.ts`：
   - 接收 conversation + existingNodes
   - generateObject + graphParseSchema
   - 返回 newNodes / updatedNodes / newEdges

3. `src/lib/graphUtils.ts`：
   - `parseConversationToGraph(messages)`：调用解析 API → 计算位置 → applyGraphChanges
   - `calculatePositions(newNodes, existingNodes)`：基于关联节点局部布局
   - `resolveEdgeIds(edges, nodes)`：title → id 映射
   - `checkAndLightNodes(newTitles)`：匹配未点亮节点并点亮

4. 在 ChatPanel 的 `onFinish` 中调用 `parseConversationToGraph`

**验收标准：**
- [ ] 学习对话结束后，画布自动生成知识节点
- [ ] 新节点位置在关联节点附近，不重叠
- [ ] 新节点间有自动连线
- [ ] 追问可补充已有节点内容
- [ ] 追问可产生新节点
- [ ] 不重复创建已有同名节点

---

### T-007：节点详情与编辑

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-011, FR-012, FR-013 |
| 依赖 | T-004 |
| 预估 | 中 |

**实施内容：**

1. `src/components/node/NodeDetail.tsx`：
   - 点击节点时右侧/弹窗显示
   - 展示：标题、类型、内容（Markdown）、关联对话、创建时间
   - 操作按钮：编辑、删除、分化（P1）

2. `src/components/node/NodeEditor.tsx`：
   - 编辑标题（input）
   - 编辑内容（textarea / Markdown editor）
   - 保存/取消

3. 右键菜单（画布上）：编辑、删除

**验收标准：**
- [ ] 点击节点打开详情面板
- [ ] 可编辑标题和内容并保存
- [ ] 可删除节点（含关联边）
- [ ] 双击节点进入编辑模式

---

### T-008：主页面组装与持久化验证

| 属性 | 值 |
|------|-----|
| 关联需求 | NFR-003, NFR-001 |
| 依赖 | T-004, T-005, T-006, T-007 |
| 预估 | 中 |

**实施内容：**

1. `src/app/page.tsx`：组装 Canvas + ChatPanel + NodeDetail + Toolbar
2. `src/app/layout.tsx`：全局布局、字体
3. `src/app/globals.css`：全局样式（画布全屏、面板浮层）
4. 验证 IndexedDB 写穿：刷新页面数据不丢失
5. 应用启动时调用 `initializeGraph()`

**验收标准：**
- [ ] 页面布局正确：画布全屏 + 右侧对话面板 + 工具栏
- [ ] 刷新页面后节点和连线不丢失
- [ ] 对话→节点生成→画布更新完整闭环可运行
- [ ] 500 节点时画布操作流畅

---

## Phase 2：Smart Graph

### T-009：多层级主题自动生成

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-020, FR-021, FR-022, FR-023 |
| 依赖 | T-006 |
| 预估 | 大 |

**实施内容：**

1. 新增 API 或在 graph/parse 中增加主题归纳逻辑
2. 当某层级节点数 >= 3 且语义相关时，自动生成 theme 节点
3. 主题节点作为父节点，通过 hierarchy 边连接子节点
4. 缩放层级过滤逻辑（Canvas 中根据 zoom 过滤 level）

**验收标准：**
- [ ] 3+ 相关知识点自动生成主题节点
- [ ] 主题节点视觉为紫色大容器
- [ ] 缩放至 <0.3x 仅显示领域级
- [ ] 跨层级连线正常工作

---

### T-010：相关性推荐

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-040, FR-043 |
| 依赖 | T-006 |
| 预估 | 中 |

**实施内容：**

1. `src/app/api/recommend/route.ts`：type='related' 分支
2. 对话结束后 AI 自然延伸推荐（嵌入 learn prompt）
3. 工具栏"给我个惊喜"按钮触发推荐
4. 推荐结果展示为画布上的虚线"幽灵节点"或对话中的建议列表

**验收标准：**
- [ ] 学习对话后出现相关延伸推荐
- [ ] 推荐内容不包含已学知识
- [ ] 点击推荐可直接开始学习该主题

---

### T-011：材料节点导入

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-017, FR-034 |
| 依赖 | T-004 |
| 预估 | 中 |

**实施内容：**

1. 对话中 AI 推荐材料时，用户可点击"加入画布"
2. 工具栏支持手动粘贴 URL 导入
3. 创建 material 类型节点，metadata.source 记录 URL
4. 材料节点视觉：绿色 + 链接图标 + 来源域名显示

**验收标准：**
- [ ] 可通过 URL 创建材料节点
- [ ] 材料节点显示来源链接
- [ ] 材料节点可连线到概念节点
- [ ] 点击材料节点可打开原始链接

---

### T-012：领域图谱生成

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-050, FR-051, FR-052, FR-054 |
| 依赖 | T-006 |
| 预估 | 大 |

**实施内容：**

1. `src/app/api/domain/route.ts`：generateObject + domainGraphSchema
2. `src/components/domain/DomainModal.tsx`：输入领域名 → 生成
3. 生成节点全部 status='unlit'，视觉为灰色虚线半透明
4. 树形布局算法（dagre 或简单递归布局）
5. 点亮逻辑：对话解析后 checkAndLightNodes 匹配

**验收标准：**
- [ ] 输入"机器学习"可生成多层级灰色图谱
- [ ] 未点亮节点有明确视觉区分
- [ ] 学习匹配知识后节点自动点亮
- [ ] 可在图谱外自由扩展新节点
- [ ] 与已有自由探索节点共存

---

## Phase 3：Advanced

### T-013：节点分化与合并

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-015, FR-016, FR-035 |
| 依赖 | T-006, T-007 |
| 预估 | 中 |

**实施内容：**

1. `src/app/api/node/split/route.ts`：generateObject + nodeSplitSchema
2. NodeDetail 中"分化"按钮 → 输入指示 → 调用 API → 替换原节点
3. 对话中识别分化/合并意图 → 执行操作
4. 合并：选中两节点 → 右键"合并" → AI 整合内容

**验收标准：**
- [ ] 可将一个节点拆分为多个子节点
- [ ] 分化后连线正确重新分配
- [ ] 可通过对话指令触发分化
- [ ] 可合并两个节点

---

### T-014：辩论与设计模式

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-060, FR-061, FR-062 |
| 依赖 | T-005 |
| 预估 | 中 |

**实施内容：**

1. 完善 debate.ts 和 design.ts 的 System Prompt
2. ModeSelector 中启用辩论/设计选项
3. 辩论模式：关联当前选中节点作为讨论主题
4. 设计模式：引导用户做设计决策

**验收标准：**
- [ ] 辩论模式：AI 提出有深度的质疑
- [ ] 设计模式：AI 引导决策而非给答案
- [ ] 两种模式均不判对错
- [ ] 对话可关联到具体节点

---

### T-015：破茧推荐

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-041, FR-042 |
| 依赖 | T-010 |
| 预估 | 中 |

**实施内容：**

1. recommend API 的 type='breakthrough' 分支
2. 画布"漫游区"UI 组件（角落卡片）
3. 比例控制：每 5 条相关推荐混入 1 条破茧
4. 不预设连接，用户可自主将破茧内容加入画布

**验收标准：**
- [ ] 漫游区显示与已有知识无关的推荐
- [ ] 推荐不弹窗不打断
- [ ] 可点击破茧推荐开始学习
- [ ] 推荐内容与用户图谱无关联

---

### T-016：体验优化

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-006, FR-014, FR-053, NFR-005, NFR-006 |
| 依赖 | T-008 ~ T-015 |
| 预估 | 大 |

**实施内容：**

1. 缩放层级视图平滑过渡
2. 节点详情中显示关联对话记录
3. 未点亮节点悬停预览
4. 大量节点性能优化（视口裁剪、节点 LOD）
5. 首屏加载优化（代码分割、画布懒加载）
6. 数据导出功能（JSON）

**验收标准：**
- [ ] 缩放切换层级无闪烁
- [ ] 节点详情可回溯产生对话
- [ ] 悬停未点亮节点显示描述
- [ ] 1000 节点时 > 30fps
- [ ] 首屏加载 < 3s
- [ ] 可导出图谱为 JSON

---

## 任务依赖图

```
T-001 (初始化)
├── T-002 (数据层) → T-003 (Store) → T-004 (画布)
│                                         ├── T-007 (节点详情)
│                                         ├── T-011 (材料导入)
│                                         └── T-008 (页面组装) ← T-005, T-006
├── T-005 (AI对话) → T-006 (图谱解析)
│                        ├── T-009 (主题生成)
│                        ├── T-010 (推荐) → T-015 (破茧)
│                        ├── T-012 (领域图谱)
│                        └── T-013 (分化/合并)
└── T-014 (辩论/设计) ← T-005

T-016 (体验优化) ← 所有前置任务
```

---

## 里程碑

| 里程碑 | 包含任务 | 交付物 |
|--------|----------|--------|
| M1: MVP 可用 | T-001 ~ T-008 | 画布 + 对话 + 节点生成闭环 |
| M2: 智能图谱 | T-009 ~ T-012 | 主题生成 + 推荐 + 领域图谱 |
| M3: 完整体验 | T-013 ~ T-016 | 分化/辩论/破茧/性能优化 |
