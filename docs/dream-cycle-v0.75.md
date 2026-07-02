# Dream Cycle v0.75 技术设计文档

## 概述

Dream Cycle 是陆思源的闲时记忆巩固系统。它在不实时聊天的时候，整理最近发生的事情，生成每日笔记、梦境日记和记忆整理结果。

核心原则：**梦可以有诗意，但记忆必须有证据。**

Dream 现在直接写入或更新 Memory；关系档案是否自动应用由每个身份的“允许 Dream 自动维护”开关决定。

---

## 与 Reflection Agent 的分工

| | Reflection Agent (v0.7) | Dream Cycle (v0.75) |
|---|---|---|
| 触发方式 | 手动 / 对话后 | 手动 / 定时（默认关闭） |
| 风格 | 理性复盘、结构化评估 | 闲时整理、日记叙事 |
| 输出 | 已删除 | DailyNote、DreamSignal、DreamDiaryEntry、Memory、RiskFlag |
| 写入 Memory | 已删除 | Dream 直接写入或更新 |

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
  ↓ 写入 Memory / GrowthLogProposal / RiskFlag
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
- 修改 persona 文件或 boundaries
- 自动发送消息
- 把梦境日记当作事实来源
- 只凭梦境日记写入记忆
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
├── dream-consolidator.ts       # Deep Sleep：写入记忆
├── morning-brief.service.ts    # Morning Brief：结果摘要
└── dream.service.ts            # 主编排器
```

---

## 未实现 / 不做了

| 项目 | 状态 | 说明 |
|------|------|------|
| 首次 Dream 大范围初始化 | ⏭ 待整理 | 当前首次没有成功记录时会从最早时间开始，后续可在 admin 任务页做明确初始化入口 |
| 独立记忆审核 UI | ⏭ 跳过 | 记忆现在直接写入，发现污染时在记忆库归档或修改 |
