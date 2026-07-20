---
name: dev-workflow
description: 标准开发工作流程：先写PRD和tasks再开发，分Phase实施，每Phase完成后强制验收测试，通过后才进入下一阶段。当用户要求开始新功能开发、启动新阶段、或提到"按流程来"、"先写PRD"、"开始开发"、"验收"时触发。
---

# 标准开发工作流程

## 工作流总览

```
需求讨论 → 编写 PRD → 编写 Tasks → 编写 Milestone → 分 Phase 实现 → 验收测试 → Git Push → 下一 Phase
```

严格按以下顺序执行，不可跳步。

---

## Step 1：编写标准化 PRD

在 `docs/vX.X.X/PRDS/` 下创建两份文档：

### 需求 PRD (`PRDS/req/PRD-requirements.md`)

必含章节：
1. 文档元数据（版本、状态、日期、作者）
2. 概述（一段话描述产品）
3. 问题陈述（痛点表格）
4. 设计原则（编号 DP-x）
5. 用户画像（2-3 个 Persona）
6. 功能需求（编号 FR-xxx，含优先级 P0/P1/P2 + Given/When/Then 验收标准）
7. 非功能需求（编号 NFR-xxx，含具体指标）
8. 用户旅程
9. MVP 范围（按 P0/P1/P2 列出 FR 编号）
10. 约束与假设
11. 开放问题

### 技术 PRD (`PRDS/tecs/PRD-technical.md`)

必含章节：
1. 文档元数据（关联需求文档）
2. 技术目标（对应 NFR）
3. 技术选型（ADR 格式：背景/选项/决定/后果）
4. 系统架构（架构图 + 组件职责）
5. 数据模型（TypeScript 接口 + 字段说明 + 索引策略）
6. API 契约（路径/方法/Schema/错误码/关联 FR 编号）
7. 前端组件架构
8. AI Prompt 工程（如适用）
9. 状态管理设计
10. 持久化策略
11. 错误处理
12. 性能预算
13. 安全考量
14. 目录结构
15. 环境变量

---

## Step 2：编写 Tasks 任务清单

在 `docs/vX.X.X/tasks/tasks.md` 中创建：

每个 Task 必含：
- 唯一 ID（T-001, T-002...）
- 关联需求 ID（FR-xxx / NFR-xxx）
- 前置依赖（depends on）
- 实施内容（含关键代码片段）
- 独立验收标准（checklist）

按 Phase 分组，Phase 内按依赖顺序排列。附：
- 任务依赖图
- 里程碑定义
- Definition of Done（全局标准）

---

## Step 2.5：编写 Milestone 硬性检查标准

在 `docs/vX.X.X/milestone/milestone.md` 中创建：

此文件是版本交付的**硬性门槛**，不完成不予通过。后续以此文件为基准开启目标模式，不完成不罢休。

必含内容：
- 版本号 + 日期
- 硬性检查项列表（每项必须可验证、可量化）
- 每项检查的通过标准（明确的 PASS/FAIL 判定条件）
- 全部检查项通过 = 版本可发布

格式示例：
```markdown
# v0.0.5 Milestone

| # | 检查项 | 通过标准 | 状态 |
|---|---------|----------|------|
| 1 | 主题切换影响全局 | 切换后所有组件颜色变化 | ☐ |
| 2 | 拖拽无闪烁 | 连续拖拽 10 次无视觉异常 | ☐ |
| 3 | 构建零错误 | npm run build 无 error | ☐ |
```

---

## Step 3：分 Phase 实现

### 开发规则

1. **按依赖顺序**：先完成无依赖的 Task，再推进有依赖的
2. **并行加速**：无依赖关系的 Task 使用子 Agent 并行实现
3. **每完成一个 Task**：确认 `npm run build` 无错误
4. **代码规范**：TypeScript 严格模式，无 any，有基本注释

### 子 Agent 并行策略

```
独立模块 A ──→ Agent 1
独立模块 B ──→ Agent 2  （同时执行）
依赖 A+B 的模块 C ──→ 等 A、B 完成后再实现
```

---

## Step 4：Phase 验收（强制）

每个 Phase 完成后，**必须**执行端到端验收，覆盖：

| 验收维度 | 检查内容 |
|----------|----------|
| 构建 | `npm run build` 零错误 |
| UI 交互 | 使用 Browser Agent 实际操作验证 |
| 核心数据流 | 完整闭环（如：对话→节点生成→画布更新） |
| 持久化 | 刷新页面数据不丢失 |
| 关键功能 | 对照 Task 验收 checklist 逐项确认 |

### 验收流程

1. 确认 build 通过
2. 启动 dev server
3. 使用 Browser Agent 执行端到端测试
4. 记录每项测试结果（通过/失败 + 截图）
5. 失败项立即修复，修复后重新验证
6. **全部通过后**才标记 Phase 完成

### 验收不通过

- 定位问题根因
- 修复代码
- 重新执行失败的测试项
- 循环直到全部通过

---

## Step 5：Git Push（每阶段完成后必须执行）

每个 Phase 验收通过后，立即推送到 GitHub：

```bash
git add -A
git commit -m "v{X.X.X} Phase {N}: {phase_description}"
git push origin main
```

仓库地址：https://github.com/Tylor110077/Memos.git

---

## Step 6：进入下一 Phase

确认当前 Phase 验收全部通过后：
1. 更新 Todo 状态
2. 开始下一 Phase 的 Task 实现
3. 重复 Step 3 → Step 4

---

## 文档版本化规则

```
docs/
└── vX.X.X/
    ├── PRDS/
    │   ├── req/PRD-requirements.md
    │   └── tecs/PRD-technical.md
    └── tasks/
        └── tasks.md
```

- 所有文档**必须**在版本目录下
- 新版本迭代时创建新的 `vX.X.X/` 目录
- 禁止在版本目录外放置 PRD 或 tasks 文件
