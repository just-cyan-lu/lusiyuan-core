# Dream Cycle v0.75 技术设计文档

## 概述

Dream Cycle 是陆思源的闲时记忆巩固系统。它在不实时聊天的时候，整理最近发生的事情，生成每日笔记、梦境日记和记忆提案。

核心原则：**梦可以有诗意，但记忆必须有证据。**

Dream 不直接写正式 Memory，所有长期记忆变更仍然走 Proposal → Owner 审核流。

---

## 与 Reflection Agent 的分工

| | Reflection Agent (v0.7) | Dream Cycle (v0.75) |
|---|---|---|
| 触发方式 | 手动 / 对话后 | 手动 / 定时（默认关闭） |
| 风格 | 理性复盘、结构化评估 | 闲时整理、日记叙事 |
| 输出 | MemoryProposal、RiskFlag | DailyNote、DreamSignal、DreamDiaryEntry、MemoryProposal |
| 写入 Memory | 需 owner 审核 | 需 owner 审核（同一审核流） |

---

## 五个阶段

```
Intake（入梦准备）
  ↓ 收集最近消息、记忆、工具调用、草稿、复盘报告
Light Sleep（浅睡整理）
  ↓ 生成 DailyNote：摘要、要点、潜在信号、风险
REM Sleep（梦境联想）
  ↓ 提取 DreamSignal：类型、置信度、来源证据
Dream Diary（梦境日记）
  ↓ 生成 DreamDiaryEntry：陆思源风格内在叙事
Deep Sleep（深睡巩固）
  ↓ 生成 MemoryProposal / GrowthLogProposal / RiskFlag
Morning Brief（醒来摘要）
  ↓ 给 owner 看的结果摘要
```

---

## 数据库表

| 表名 | 用途 |
|------|------|
| `DreamJob` | 每次运行的任务记录 |
| `DailyNote` | Light Sleep 生成的每日笔记 |
| `DreamSignal` | REM Sleep 提取的信号 |
| `DreamDiaryEntry` | 梦境日记（owner_only） |
| `DreamConsolidationReport` | Deep Sleep 的汇总报告 |
| `DreamLock` | 防止并发运行的锁；已有 Dream 正在运行时跳过本次触发 |

---

## 信号类型

| signalType | 含义 |
|---|---|
| `recurring_theme` | 反复出现的主题 |
| `technical_decision` | 技术决策 |
| `project_context` | 项目背景变化 |
| `user_preference` | 用户长期偏好 |
| `persona_feedback` | 对陆思源人格的反馈 |
| `relationship_shift` | 关系变化 |
| `growth_event` | 成长事件 |
| `boundary_risk` | 边界风险（装真人、情感依赖等） |
| `memory_conflict` | 记忆冲突 |
| `open_question` | 待解答问题 |

---

## 安全边界

Dream Cycle 绝对不会：
- 直接写入正式 Memory
- 修改 persona 文件或 boundaries
- 自动发送消息
- 把梦境日记当作事实来源
- 把梦境日记作为 MemoryProposal 的唯一证据
- 在 DreamDiaryEntry 中编造真实世界经历

Dream Policy 会过滤：
- 装真人内容（`containsPretendHumanContent`）

---

## API 端点（全部 owner-only）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/dream/run` | 立即运行一次 Dream Cycle |
| POST | `/v1/dream/jobs` | 创建 Job（不运行） |
| POST | `/v1/dream/jobs/:jobId/run` | 运行指定 Job |
| GET | `/v1/dream/jobs/:jobId` | 查看 Job 状态 |
| GET | `/v1/dream/daily-notes` | 查看 Daily Notes |
| GET | `/v1/dream/signals` | 查看 Dream Signals |
| GET | `/v1/dream/diary` | 查看梦境日记列表 |
| GET | `/v1/dream/diary/:id` | 查看单篇梦境日记 |
| GET | `/v1/dream/jobs/:jobId/morning-brief` | 查看 Morning Brief |

---

## CLI 脚本

```bash
pnpm dream:run                        # 运行今日 Dream Cycle
pnpm dream:inspect --latest           # 查看最新 Job 结果
pnpm dream:diary --limit=5            # 查看最近 5 篇日记
pnpm dream:cleanup-locks              # 清理过期锁
```

---

## 关键环境变量

```env
DREAM_ENABLED=true          # 总开关
DREAM_CRON="30 3 * * *"     # 自动运行时间，按服务器本地时间解释
```

---

## 文件结构

```
src/dream/
├── dream.types.ts              # 所有类型定义
├── dream-prompts.ts            # 四个阶段的 system prompt
├── dream-policy.ts             # 内容过滤、评分
├── dream-lock.service.ts       # 分布式锁（防并发）
├── dream-context-builder.ts    # Intake：收集系统事件
├── daily-note.service.ts       # Light Sleep：生成 DailyNote
├── dream-signal-extractor.ts   # REM Sleep：提取 DreamSignal
├── dream-diary-writer.ts       # Dream Diary：生成日记
├── dream-consolidator.ts       # Deep Sleep：生成提案
├── morning-brief.service.ts    # Morning Brief：结果摘要
└── dream.service.ts            # 主编排器
```

---

## 未实现 / 不做了

| 项目 | 状态 | 说明 |
|------|------|------|
| 首次 Dream 大范围初始化 | ⏭ 待整理 | 当前首次没有成功记录时会从最早时间开始，后续可在 admin 任务页做明确初始化入口 |
| 审核 UI（图形界面） | ⏭ 跳过 | 属于前端仓库（lusiyuan-web）的工作，目前审核只能通过 HTTP API 或 CLI |
| Dream Proposal 专属 CLI | ⏭ 跳过 | Dream 生成的 MemoryProposal 复用 Reflection 的审核流（`pnpm reflection:apply`），不单独做 |
