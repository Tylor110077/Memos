# Studyboard v0.0.2 实施任务清单

| 字段 | 值 |
|------|-----|
| 关联需求文档 | docs/v0.0.2/PRDS/req/PRD-requirements.md |
| 关联技术文档 | docs/v0.0.2/PRDS/tecs/PRD-technical.md |
| 版本 | v0.0.2 |
| 更新日期 | 2026-07-20 |

---

## Definition of Done（全局标准）

- [ ] `npm run build` 零错误
- [ ] 关联验收标准全部通过
- [ ] 动画流畅无掉帧（CSS transform/opacity）
- [ ] 无控制台未处理异常

---

## Phase 1：核心体验升级

### T-101：Markdown 完整渲染

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-101, FR-102, FR-103 |
| 依赖 | 无 |
| 预估 | 中 |

**实施内容：**

1. 安装依赖：`npm install remark-gfm rehype-highlight`
2. 创建 `src/components/shared/MarkdownRenderer.tsx`：
   - 使用 react-markdown + remark-gfm + rehype-highlight
   - 自定义组件：table（斑马纹+边框）、code（高亮+复制按钮）、a（新窗口打开）
   - 自定义 CSS 样式（globals.css 中添加 .markdown-body 样式）
3. 替换 MessageBubble.tsx 中的 ReactMarkdown 为 MarkdownRenderer
4. 引入 highlight.js 主题 CSS

**验收标准：**
- [ ] 表格正确渲染（表头加粗、边框、斑马纹）
- [ ] 代码块有语法高亮（至少支持 python/js/ts）
- [ ] 加粗、斜体、列表、引用均正确
- [ ] 行内代码有背景色区分

---

### T-102：节点 Obsidian 风格重构

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-110, FR-111, FR-112, FR-113 |
| 依赖 | 无 |
| 预估 | 大 |

**实施内容：**

1. 重构所有 5 个节点组件为 Obsidian 风格：
   - 圆形/圆角气泡形状（非矩形）
   - 径向渐变背景 + 外发光（box-shadow）
   - 大小按 level 和连接数变化（level 越小越大）
   - 文字在节点内部或下方
   - 颜色体系：concept=蓝紫、theme=紫、material=绿、understanding=橙、question=黄
   - unlit 状态：灰色 + 虚线 + 低透明度
2. 添加 CSS 动效：
   - hover: scale(1.1) + 光晕增强（150ms ease-out）
   - 出现动画：scale(0)→scale(1) + opacity 0→1（300ms 弹性缓动）
   - 选中状态：脉冲光环
3. 重构 KnowledgeEdge：
   - 使用 bezier 曲线（type: 'smoothstep' 或 'bezier'）
   - 默认 opacity 0.4，hover 时 opacity 1 + 加粗
   - 颜色跟随源节点

**验收标准：**
- [ ] 节点为圆形/气泡形状，有光晕效果
- [ ] hover 时节点放大 + 光晕增强 + 相邻连线高亮
- [ ] 新节点有出现动画（从小到大）
- [ ] 连线为平滑曲线，有透明度
- [ ] 不同层级节点大小有明显差异

---

### T-103：对话栏动效与模式说明

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-180, FR-181, FR-130, FR-131 |
| 依赖 | 无 |
| 预估 | 中 |

**实施内容：**

1. ChatPanel 滑入/滑出动画：
   - 使用 CSS transition: transform 300ms ease-in-out
   - 关闭时 translateX(100%)，打开时 translateX(0)
   - 组件始终渲染（不用条件 return null），通过 transform 控制
   - 收起位置=展开位置（固定在右侧）
2. ModeSelector 重构：
   - 每个模式按钮添加 tooltip 简介
   - 学习="向 AI 提问，学习新知识"
   - 费曼="向 AI 讲解你的理解，它来追问"
   - 辩论="为观点辩护，AI 来质疑"
   - 设计="用知识做设计，AI 来引导"
   - 当前模式有颜色标识（学习=蓝、费曼=绿、辩论=红、设计=紫）
   - 切换时对话栏顶部显示模式名+颜色条，有过渡动画

**验收标准：**
- [ ] 对话栏打开/关闭有平滑滑动动画（非突然出现）
- [ ] 从右侧收起就从右侧展开
- [ ] 每个模式有 tooltip 简介
- [ ] 切换模式有颜色变化 + 过渡动画
- [ ] 当前模式有明确的颜色标识

---

### T-104：单条消息生成节点

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-120 |
| 依赖 | T-101 |
| 预估 | 中 |

**实施内容：**

1. 在 MessageBubble（assistant 消息）上添加"生成节点"悬浮按钮（Sparkles 图标）
2. 点击后仅将该条消息内容发送到 /api/graph/parse
3. 解析结果应用到画布
4. 保留原有"全部对话生成节点"按钮（对话面板顶部）

**验收标准：**
- [ ] 每条 AI 回复 hover 时显示"生成节点"按钮
- [ ] 点击后仅基于该条回复生成节点
- [ ] 生成成功后按钮变为已生成状态（勾号）
- [ ] 原有"全部生成"功能不受影响

---

### T-105：材料内容抓取

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-140, FR-141, FR-142 |
| 依赖 | 无 |
| 预估 | 大 |

**实施内容：**

1. 安装依赖：`npm install cheerio`
2. 创建 `src/app/api/scrape/route.ts`：
   - 接收 URL，服务端 fetch 网页
   - 用 cheerio 解析：title（og:title 或 <title>）、favicon（link[rel=icon]）、正文（article/main/body 文本）
   - 超时 10s（AbortController）
   - 失败返回 { error, fallback: true }
3. 修改 ImportMaterialModal：
   - 导入后自动调用 /api/scrape
   - 显示加载状态"正在抓取内容..."
   - 成功后将 scrapedContent/scrapedTitle/scrapedFavicon 存入节点 metadata
   - 失败则降级为仅存 URL + 提示
4. 扩展 KnowledgeNode 类型（添加 scrapedContent 等字段）

**验收标准：**
- [ ] 导入 URL 后自动抓取标题和正文
- [ ] 抓取成功：节点标题为网页标题，内容含正文
- [ ] 抓取失败：降级为 URL，显示提示
- [ ] 超时 10s 后自动降级

---

## Phase 2：深度交互

### T-106：节点全屏详情页

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-160, FR-161, FR-162, FR-164, FR-165 |
| 依赖 | T-101, T-105 |
| 预估 | 大 |

**实施内容：**

1. 创建 `src/components/node/FullScreenDetail.tsx`：
   - fixed 全屏 overlay（z-[200]），80%+ 屏幕空间
   - 展开动画：scale(0.9)→scale(1) + opacity（350ms）
   - 关闭：ESC / 点击背景 / 关闭按钮，有收缩动画
2. 内容区域按节点类型切换：
   - concept/understanding/question：Markdown 编辑器（textarea + 预览切换）
   - material(网页)：iframe 嵌入原文 + 下方 AI 摘要
   - material(视频)：iframe 嵌入播放器
   - material(PDF)：iframe 嵌入 PDF
3. AI 摘要区域：
   - 底部固定区域，显示 node.summary
   - 如无摘要，显示"生成摘要"按钮 → 调用 /api/summarize
4. 创建 `src/app/api/summarize/route.ts`
5. 在 uiStore 中添加 fullScreenNodeId 状态
6. 节点双击触发全屏（替代原有的 NodeDetail 侧栏）

**验收标准：**
- [ ] 双击节点展开全屏详情（80%+ 屏幕）
- [ ] 文本节点显示 Markdown 编辑器
- [ ] 网页材料节点显示 iframe 原文
- [ ] 底部有 AI 摘要（可生成）
- [ ] ESC/关闭按钮有收缩动画回到画布
- [ ] 编辑内容实时保存到节点

---

### T-107：图谱邻居过滤

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-150, FR-151 |
| 依赖 | T-102 |
| 预估 | 中 |

**实施内容：**

1. 创建 `src/lib/graphAlgorithms.ts`：buildAdjacencyMap + getNDegreeNeighbors
2. 创建 `src/components/canvas/FocusControl.tsx`：
   - 浮动面板（选中节点时出现）
   - 度数选择：1/2/3/4 级
   - "全部显示"按钮退出聚焦模式
3. 修改 Canvas.tsx：
   - 聚焦模式下，非范围内节点 opacity 0.15
   - 非范围内边 opacity 0.05
   - 选中节点 + 邻居正常显示
4. 在 Toolbar 添加聚焦模式切换按钮（Focus 图标）
5. uiStore 添加 focusMode/focusDegree 状态

**验收标准：**
- [ ] 选中节点后可开启聚焦模式
- [ ] 可切换 1/2/3/4 度邻居
- [ ] 非范围节点半透明淡化（非隐藏）
- [ ] 切换度数响应 < 200ms
- [ ] 可退出聚焦模式恢复全部显示

---

### T-108：知识 vs 趣闻区分

| 属性 | 值 |
|------|-----|
| 关联需求 | FR-170, FR-171, FR-172 |
| 依赖 | 无 |
| 预估 | 中 |

**实施内容：**

1. KnowledgeNode 类型添加 contentCategory 字段
2. 修改破茧推荐 Prompt：混合知识类和趣闻类
   - 趣闻示例："19世纪有个胖子俱乐部"、"章鱼有三颗心脏"
   - 返回结果标记 type: 'knowledge' | 'trivia'
3. 趣闻节点视觉：✨ 图标 + 粉/金色系
4. 图谱解析时 AI 自动判断 contentCategory

**验收标准：**
- [ ] 破茧推荐混合出现知识类和趣闻类
- [ ] 趣闻节点有独特视觉标识（✨ + 特殊颜色）
- [ ] 趣闻内容有趣（历史/冷知识/奇闻）

---

## 任务依赖图

```
T-101 (Markdown) ──→ T-104 (单条生成)
                 ──→ T-106 (全屏详情)
T-102 (节点视觉) ──→ T-107 (邻居过滤)
T-103 (对话栏动效)    独立
T-105 (材料抓取) ──→ T-106 (全屏详情)
T-108 (趣闻)          独立
```

## 里程碑

| 里程碑 | 包含任务 | 交付物 |
|--------|----------|--------|
| M1: 体验升级 | T-101 ~ T-105 | Markdown + Obsidian 节点 + 动效 + 抓取 |
| M2: 深度交互 | T-106 ~ T-108 | 全屏详情 + 邻居过滤 + 趣闻 |
