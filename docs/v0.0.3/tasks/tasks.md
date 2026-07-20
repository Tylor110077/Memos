# Studyboard v0.0.3 实施任务清单

| 字段 | 值 |
|------|-----|
| 版本 | v0.0.3 |
| 关联需求 | docs/v0.0.3/PRDS/req/PRD-requirements.md |
| 关联技术 | docs/v0.0.3/PRDS/tecs/PRD-technical.md |

---

## Definition of Done

- [ ] `npm run build` 零错误
- [ ] 关联验收标准全部通过
- [ ] 物理动画 60fps
- [ ] 无控制台异常

---

## Phase 1：物理交互 + 连线 + AI 上下文

### T-201：连线改为纯直线

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-204, FR-240 |
| 依赖 | 无 |

**实施：** KnowledgeEdge.tsx 中 `getSmoothStepPath` → `getStraightPath`

**验收：**
- [ ] 所有连线为纯直线，无拐角/曲线

---

### T-202：弹性物理增强 + 近距离连线

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-201, FR-202, FR-203, FR-205 |
| 依赖 | 无 |

**实施：**
1. useForceSimulation.ts：forceLink.strength 0.6, distance 80, forceCollide 半径 30, 拖拽 alphaTarget 0.3
2. Canvas.tsx onNodeDragStop：计算拖拽节点与其他节点距离，< 50px 自动 addEdge

**验收：**
- [ ] 拖拽节点时邻居被弹性拉动
- [ ] 松手后有回弹效果
- [ ] 将两节点拉近松手后自动连线
- [ ] 节点不会重叠（碰撞力）

---

### T-203：AI 上下文注入

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-210, FR-211, FR-212 |
| 依赖 | 无 |

**实施：**
1. ChatPanel.tsx：useChat body 添加 `selectedNode: { title, content }`（从 graphStore.selectedNodeId 获取）
2. /api/chat/route.ts：getSystemPrompt 中拼入选中节点上下文
3. ChatPanel 顶部显示"当前上下文：{节点标题}"提示条
4. FullScreenDetail.tsx：右侧添加迷你对话按钮，点击展开对话面板（自动关联当前节点）

**验收：**
- [ ] 选中节点后问"这个讲了什么"，AI 能正确回答
- [ ] 对话栏显示当前上下文节点名
- [ ] 全屏详情中仍可呼出 AI 对话

---

## Phase 2：多画板 + 材料重构

### T-204：多画板管理

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-220~224 |
| 依赖 | 无 |

**实施：**
1. types/index.ts：添加 Board 接口，KnowledgeNode/Edge 添加 boardId
2. lib/db.ts：添加 boards 表，nodes/edges 索引添加 boardId
3. stores/boardStore.ts：boards 列表、currentBoardId、CRUD 操作
4. components/canvas/BoardSelector.tsx：左上角下拉选择器（画板列表 + 新建按钮）
5. graphStore：查询时按 currentBoardId 过滤
6. 首次启动自动创建"默认画板"

**验收：**
- [ ] 左上角有画板选择器
- [ ] 可新建画板并切换
- [ ] 不同画板数据隔离
- [ ] 可删除/重命名画板

---

### T-205：材料导入重构

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-230~235 |
| 依赖 | 无 |

**实施：**
1. ImportMaterialModal 重构：
   - 单一输入区：URL 输入框 + 文件拖拽区
   - 自动检测：输入以 http 开头 → URL 流程；否则 → 文件流程
2. URL 流程：调用 /api/scrape → 抓取内容 → AI 生成摘要 → 节点含 summary + source
3. 文件流程：FileReader 读取 → 按扩展名(.pdf/.docx/.xlsx/.md)分类 → 存入节点 fileData
4. lib/fileUtils.ts：detectFileType(file) 工具函数
5. FullScreenDetail 中：
   - 网页节点：iframe + loading spinner（onLoad 事件）
   - MD 文件：MarkdownRenderer 渲染
   - PDF：iframe src=blobURL
6. /api/scrape 修改：抓取后调用 AI 生成 summary 字段

**验收：**
- [ ] 输入 URL 自动走抓取+摘要流程
- [ ] 拖入 .md 文件自动识别并渲染
- [ ] 网页节点打开时有 loading 状态
- [ ] 摘要为 AI 生成的真实内容总结

---

## 任务依赖图

```
T-201 (直线)     独立
T-202 (物理)     独立
T-203 (AI上下文) 独立
T-204 (多画板)   独立
T-205 (材料重构) 独立
```

所有任务互相独立，可全部并行。

## 里程碑

| 里程碑 | 包含任务 |
|--------|----------|
| M1: 交互质感 | T-201, T-202, T-203 |
| M2: 架构升级 | T-204, T-205 |
