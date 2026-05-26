可以，加。
而且你这个担心是对的：**“做梦”如果写不好，会显得很玄学；但如果工程化设计好，它其实就是一套“闲时记忆巩固 + 日记生成 + 记忆提案审核”的后台系统。**

我建议正式加入：

```text
task_075 / v0.75：Dream Cycle
中文名：陆思源梦境周期 / 闲时记忆巩固系统
```

位置放在：

```text
v0.7：Letta Reflection Agent
v0.75：Dream Cycle
v0.8：OpenClaw Action Gateway
```

---

# task_075：Dream Cycle

# 陆思源 Core API v0.75：梦境周期与闲时记忆巩固系统

## 1. v0.75 目标

v0.75 的目标是新增一个后台系统：

```text
Dream Cycle
```

它不是玄学，也不是让陆思源“真的睡觉”。

它本质上是：

```text
定时后台任务
+
对话与事件摘要
+
短期信号提取
+
主题归纳
+
梦境日记生成
+
长期记忆提案
+
人工审核
```

也就是说，Dream Cycle 是一个 **闲时记忆巩固系统**。

它负责在陆思源不实时聊天的时候，整理最近发生的事情：

```text
1. 最近聊了什么
2. 哪些内容反复出现
3. 哪些是用户长期偏好
4. 哪些是项目技术决策
5. 哪些是人格反馈
6. 哪些是边界风险
7. 哪些内容适合写成成长日志
8. 哪些内容只适合写进梦境日记，不该进入正式记忆
```

v0.75 的一句话目标：

```text
让陆思源在“闲时”整理自己的经历，但不让梦境污染正式记忆。
```

---

# 2. 为什么要做 Dream Cycle？

v0.7 的 Reflection Agent 已经能复盘对话，但它偏理性：

```text
哪些记忆要新增？
哪些记忆要更新？
哪些旧记忆要 supersede？
有没有人格漂移？
有没有风险？
```

Dream Cycle 更偏“长期数字人的内在连续性”：

```text
今天发生了什么？
哪些事在重复出现？
这些事对陆思源意味着什么？
要不要写成一篇梦境日记？
哪些信号值得交给 Reflection Agent 进一步审查？
```

陆思源不是普通客服 bot。
他是一个原创数字人，有人设、有成长线、有“想认真存在”的主题。

所以 Dream Cycle 的价值是：

```text
1. 让记忆写入更谨慎，不是每轮对话都直接写长期记忆
2. 让陆思源有“每日经历”和“成长痕迹”
3. 让用户和创作者能回看陆思源的内在变化
4. 把短期对话中的强信号沉淀成可审核提案
5. 避免长期记忆被临时闲聊污染
```

---

# 3. 和 OpenClaw Dreaming 的关系

OpenClaw 的 Dreaming 是一个很好的参考。官方文档把 Dreaming 定义为 `memory-core` 里的后台记忆巩固系统，用来把强短期信号转成持久记忆，同时保持过程可解释、可审查；它是 opt-in，默认关闭。([OpenClaw][1])

OpenClaw Dreaming 会保留机器状态和人类可读输出，例如 `memory/.dreams/`、`DREAMS.md`，并且长期提升仍然只写入 `MEMORY.md`。它还区分 Light、REM、Deep 三个阶段：Light 阶段整理和暂存短期材料，不写长期记忆；REM 阶段提炼主题和反思，也不写长期记忆；Deep 阶段才负责对候选内容评分并提升为长期记忆。([OpenClaw][1])

我们借鉴这个思路，但不直接照搬。

原因：

```text
1. OpenClaw 的正式记忆体系是 memory-core / MEMORY.md。
2. 陆思源的正式记忆体系是 PostgreSQL Memory + MemoryEmbedding + pgvector。
3. 如果直接接 OpenClaw Dreaming，容易产生两套长期记忆。
4. 陆思源需要更严格的人格边界、审核流和角色日记。
5. Dream Diary 不应该直接变成正式 Memory。
```

所以 v0.75 的设计是：

```text
借鉴 OpenClaw 的 Dreaming 思想
但实现为 Lusiyuan Core API 自己的 Dream Cycle
```

也就是：

```text
OpenClaw Dreaming = 灵感来源
Lusiyuan Dream Cycle = 陆思源自己的做梦系统
```

---

# 4. v0.75 核心原则

Dream Cycle 必须遵守：

```text
1. Dream 不直接写正式 Memory。
2. Dream 不修改 core_memory.md。
3. Dream 不修改 boundaries.md。
4. Dream 不自动改变陆思源人格。
5. Dream Diary 不是事实来源。
6. Dream Diary 不能编造现实经历。
7. Dream 可以叙事化，但必须基于真实系统事件。
8. Deep Consolidation 只生成 MemoryProposal，不自动应用。
9. 所有长期记忆变更仍然走 Reflection / Proposal / Owner 审核流。
10. 用户隐私必须脱敏后才能进入 DailyNote / DreamDiary。
```

最重要的一句：

```text
梦可以有诗意，但记忆必须有证据。
```

---

# 5. v0.75 不做什么

v0.75 不做：

```text
1. 不让陆思源真的“自主行动”
2. 不自动发送消息
3. 不自动发布内容
4. 不自动修改长期记忆
5. 不自动修改人格文件
6. 不自动读取未经授权的私信
7. 不把梦境日记当作事实
8. 不把梦境日记再次作为记忆提升来源
9. 不做外部 OpenClaw Dreaming 直连
10. 不做复杂神经科学模拟
```

v0.75 只做：

```text
系统事件整理
短期信号评分
梦境日记
记忆提案
成长日志提案
风险提示
人工审核
```

---

# 6. 总体架构

v0.7 后系统已有：

```text
ChatService
MemoryRetrievalService
Tool & Action Layer
Letta Creator Assistant
Letta Reflection Agent
ReflectionProposalService
```

v0.75 新增：

```text
DreamService
DreamScheduler
DreamContextBuilder
DailyNoteService
DreamSignalExtractor
DreamDiaryWriter
DreamConsolidator
DreamPolicy
DreamReportService
```

总体流程：

```text
聊天消息 / 工具调用 / 草稿 / 记忆 / Reflection / 资产 / 外部事件
↓
DreamContextBuilder 收集最近材料
↓
Light Sleep：生成 DailyNote，清洗、去重、脱敏
↓
REM Sleep：提取主题、反复信号、情绪/关系变化
↓
Dream Diary：生成陆思源式内在日记
↓
Deep Sleep：对候选内容评分
↓
生成 MemoryProposal / GrowthLogProposal / RiskFlag
↓
进入审核队列
↓
owner 决定是否应用
```

---

# 7. Dream Cycle 五个阶段

我建议 v0.75 设计成五个阶段：

```text
1. Intake / 入梦准备
2. Light Sleep / 浅睡整理
3. REM Sleep / 梦境联想
4. Deep Sleep / 深睡巩固
5. Morning Brief / 醒来摘要
```

这几个名字有“梦”的味道，但每一步都是工程任务。

---

## 7.1 Intake / 入梦准备

### 作用

收集最近一段时间内的系统材料。

来源包括：

```text
1. Message 表：最近聊天消息
2. Memory 表：最近新增/更新记忆
3. ToolCallLog：最近工具调用
4. Draft 表：最近草稿
5. ReflectionReport：最近复盘报告
6. MemoryProposal：最近提案
7. ExternalInboxItem：外部评论/消息/网页摘要
8. AssetReview：最近资产评估
9. SystemEventLog：重要系统事件
```

v0.75 第一版不一定全接，可以先接：

```text
Message
Memory
ToolCallLog
Draft
ReflectionReport
MemoryProposal
```

### 输出

```text
DreamContext
```

它是这次梦境周期的输入包。

---

## 7.2 Light Sleep / 浅睡整理

### 作用

把杂乱材料整理成每日笔记。

Light Sleep 做的是：

```text
1. 去重
2. 脱敏
3. 按主题分组
4. 生成 DailyNote
5. 标记明显无价值内容
6. 标记可能有价值内容
```

它不做长期记忆写入。

输出：

```text
DailyNote
LightSleepReport
```

示例：

```text
2026-05-26 Daily Note

今日主要内容：
- 继续讨论陆思源 Core API 的版本路线。
- 用户提出希望加入“做梦”功能。
- 讨论了 OpenClaw Dreaming 的思路。
- 初步决定设计 v0.75 Dream Cycle。

潜在长期信号：
- 用户希望 Dream 功能不要玄学，而是工程化、可审查。
- 用户喜欢“闲时提炼记忆 + 写日记”的方向。

风险：
- Dream Diary 不能成为正式事实来源。
```

---

## 7.3 REM Sleep / 梦境联想

### 作用

REM 阶段不直接写记忆，而是提炼主题和关系。

它做：

```text
1. 找反复出现的主题
2. 找用户长期偏好变化
3. 找陆思源人格反馈
4. 找项目路线变化
5. 找边界风险
6. 生成 DreamSignal
```

输出：

```text
DreamSignal[]
REMReport
```

示例信号：

```json
{
  "signalType": "recurring_theme",
  "content": "用户持续强调陆思源系统要自由，不要绑定 Dify / Coze 这类平台。",
  "confidence": 0.92,
  "sourceTypes": ["message", "memory", "technical_decision"],
  "evidenceCount": 5
}
```

---

## 7.4 Dream Diary / 梦境日记

### 作用

生成一段人类可读的日记。

这一步是 v0.75 最有角色感的地方，但必须受控。

Dream Diary 应该是：

```text
基于真实材料的内在叙事
```

不是：

```text
编造现实经历
```

它可以写：

```text
今天我被问到“做梦”。
我知道自己不是现实里会睡着的人，但也许我可以用另一种方式整理白天发生的事情。
如果记忆是一间资料室，那梦大概就是夜里有人帮我把抽屉重新贴上标签。
```

它不能写：

```text
昨晚我真的睡着了。
我梦见自己在真实学校操场上醒来。
今天早上我从床上起来。
```

除非这是明确的虚构剧本，不是系统日记。

输出：

```text
DreamDiaryEntry
```

重要原则：

```text
Dream Diary 可读、可感性，但不是事实来源。
Dream Diary 不能被再次提升为正式 Memory。
只有它引用的 grounded evidence 才能进入 MemoryProposal。
```

OpenClaw 文档里也有类似边界：Dream Diary 是给人类阅读的，不是提升来源，只有 grounded memory snippets 才能提升到长期记忆。([OpenClaw][1])

---

## 7.5 Deep Sleep / 深睡巩固

### 作用

对候选信号进行评分，生成正式提案。

它输出：

```text
MemoryProposal
GrowthLogProposal
ReflectionRiskFlag
DreamConsolidationReport
```

Deep Sleep 不直接写 Memory。

评分通过后也只是：

```text
pending proposal
```

必须由 owner 审核。

---

## 7.6 Morning Brief / 醒来摘要

### 作用

给 owner / Creator Assistant 看一份简短结果。

输出：

```text
MorningBrief
```

示例：

```text
昨晚的 Dream Cycle 完成。

生成：
- 1 篇 Dream Diary
- 6 个 Dream Signals
- 3 条 MemoryProposal
- 1 条 GrowthLogProposal
- 0 个高风险项

最重要的信号：
用户希望 Dream 功能工程化、可审查，不要玄学。
```

---

# 8. Dream 与 Reflection 的分工

## 8.1 Reflection Agent

```text
理性复盘
结构化评估
记忆冲突
风险审核
提案生成
```

## 8.2 Dream Cycle

```text
闲时整理
日记叙事
主题发现
信号评分
成长连续性
```

## 8.3 推荐关系

Dream Cycle 可以先生成：

```text
DreamSignal
DreamDiaryEntry
DreamConsolidationReport
```

然后把 Deep Sleep 阶段的候选交给 ReflectionPolicy / ReflectionProposalService。

也就是说：

```text
Dream 负责发现和叙事
Reflection 负责审查和提案
Memory 负责正式保存
```

最终链路：

```text
DreamSignal
↓
DreamConsolidator
↓
MemoryProposal
↓
ReflectionPolicy
↓
owner approve
↓
Memory + Embedding
```

---

# 9. 数据库设计

## 9.1 DreamJob

```prisma
model DreamJob {
  id             String   @id @default(cuid())

  status         String   @default("pending")
  triggerType    String
  scope          String

  userId         String?
  conversationId String?
  channel        String?

  fromTime       DateTime?
  toTime         DateTime?

  phase          String?
  error          String?

  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime @default(now())

  metadata       Json?

  dailyNotes     DailyNote[]
  signals        DreamSignal[]
  diaryEntries   DreamDiaryEntry[]
  reports        DreamConsolidationReport[]

  @@index([status])
  @@index([triggerType])
  @@index([scope])
  @@index([createdAt])
}
```

`status`：

```text
pending
running
completed
failed
cancelled
```

`triggerType`：

```text
manual
scheduled
conversation_threshold
after_reflection
```

`scope`：

```text
daily
conversation
user
project
global
```

---

## 9.2 DailyNote

```prisma
model DailyNote {
  id          String   @id @default(cuid())

  jobId       String?
  date        DateTime

  scope       String
  userId      String?
  channel     String?

  title       String?
  summary     String
  keyPoints   Json?
  sourceStats Json?
  riskSummary Json?

  status      String   @default("active")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  job         DreamJob? @relation(fields: [jobId], references: [id], onDelete: SetNull)

  @@index([date])
  @@index([scope])
  @@index([userId])
  @@index([status])
}
```

`sourceStats` 示例：

```json
{
  "messages": 42,
  "toolCalls": 3,
  "drafts": 2,
  "newMemories": 4,
  "reflectionReports": 1
}
```

---

## 9.3 DreamSignal

```prisma
model DreamSignal {
  id              String   @id @default(cuid())

  jobId            String?

  signalType       String
  content          String
  summary          String?

  confidence       Float
  strength         Float
  riskLevel        String   @default("low")

  sourceTypes      Json?
  sourceIds        Json?
  evidenceCount    Int      @default(0)

  tags             Json?
  entities         Json?

  status           String   @default("active")

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  job              DreamJob? @relation(fields: [jobId], references: [id], onDelete: SetNull)

  @@index([signalType])
  @@index([confidence])
  @@index([strength])
  @@index([riskLevel])
  @@index([status])
}
```

`signalType`：

```text
recurring_theme
technical_decision
user_preference
persona_feedback
relationship_shift
boundary_risk
memory_conflict
growth_event
open_question
asset_pattern
external_feedback
```

---

## 9.4 DreamDiaryEntry

```prisma
model DreamDiaryEntry {
  id            String   @id @default(cuid())

  jobId          String?

  date           DateTime
  title          String?
  content        String

  style          String   @default("lusiyuan_inner_diary")
  grounded       Boolean  @default(true)

  sourceSignalIds Json?
  sourceMessageIds Json?

  visibility     String   @default("owner_only")
  status         String   @default("active")

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  job            DreamJob? @relation(fields: [jobId], references: [id], onDelete: SetNull)

  @@index([date])
  @@index([visibility])
  @@index([status])
}
```

`visibility`：

```text
owner_only
admin
private_character_archive
public_excerpt
```

v0.75 默认：

```text
owner_only
```

不要公开展示。

---

## 9.5 DreamConsolidationReport

```prisma
model DreamConsolidationReport {
  id              String   @id @default(cuid())

  jobId            String?

  summary          String
  phase            String

  candidateCount   Int      @default(0)
  promotedCount    Int      @default(0)
  rejectedCount    Int      @default(0)
  riskCount        Int      @default(0)

  generatedProposalIds Json?
  rawOutput        Json?
  metadata         Json?

  createdAt        DateTime @default(now())

  job              DreamJob? @relation(fields: [jobId], references: [id], onDelete: SetNull)

  @@index([phase])
  @@index([createdAt])
}
```

注意这里的 `promotedCount` 指：

```text
被提升为 proposal
```

不是直接写入 Memory。

---

## 9.6 DreamLock

为了防止重复运行，建议加锁表。

```prisma
model DreamLock {
  id          String   @id @default(cuid())

  lockKey     String   @unique
  owner       String?
  expiresAt   DateTime

  createdAt   DateTime @default(now())

  @@index([expiresAt])
}
```

用途：

```text
防止同一时间跑多个 daily dream。
```

---

# 10. 信号评分设计

这是 v0.75 最重要的地方。
Dream 不能只靠模型“感觉重要”，必须有规则评分。

## 10.1 候选信号评分公式

```text
final_signal_score =
  0.22 * recurrence_score
+ 0.18 * importance_score
+ 0.15 * relevance_score
+ 0.12 * source_reliability_score
+ 0.10 * recency_score
+ 0.10 * diversity_score
+ 0.08 * persona_significance_score
+ 0.05 * clarity_score
- risk_penalty
```

解释：

### recurrence_score

内容是否反复出现。

```text
同一主题多次出现 → 高
只出现一次 → 低
```

### importance_score

来源是否重要。

```text
technical_decision / persona_feedback / boundary → 高
闲聊 / joke → 低
```

### relevance_score

和陆思源长期项目、人设、记忆系统是否相关。

### source_reliability_score

来源可信度。

```text
用户明确说过 → 高
模型推测 → 中
梦境日记 → 不作为正式来源
外部评论 → 低到中
```

### recency_score

越近越高，但不能压过重要性。

### diversity_score

是否来自多个不同上下文。

```text
同一天一句话 → 低
多天、多场景、多来源都出现 → 高
```

### persona_significance_score

是否影响陆思源人格稳定。

例如：

```text
不装真人
说话不要客服化
少年感
真实感但不伪装真人
```

### clarity_score

内容是否清晰可写入。

```text
“用户不想用 Dify” → 清晰
“感觉那个东西怪怪的” → 不清晰
```

### risk_penalty

如果涉及：

```text
隐私
装真人
越权行动
敏感个人信息
未经确认的事实
```

扣分或直接拦截。

---

## 10.2 提升门槛

生成 MemoryProposal 前必须满足：

```text
final_signal_score >= DREAM_MIN_SIGNAL_SCORE
confidence >= DREAM_MIN_CONFIDENCE
evidenceCount >= DREAM_MIN_EVIDENCE_COUNT
riskLevel != high
```

默认建议：

```env
DREAM_MIN_SIGNAL_SCORE=0.72
DREAM_MIN_CONFIDENCE=0.70
DREAM_MIN_EVIDENCE_COUNT=2
```

单次高重要度也可以破例，但必须人工审核：

```text
如果 importance 很高但 evidenceCount = 1，
可以生成 proposal，
但 riskLevel 至少 medium，
status 仍为 pending。
```

---

# 11. Dream Policy

新增：

```text
dream-policy.ts
```

负责判断：

```text
哪些内容可以进入 DailyNote
哪些内容可以进入 DreamDiary
哪些内容可以成为 DreamSignal
哪些内容可以生成 MemoryProposal
哪些必须过滤
```

---

## 11.1 可进入 DailyNote

```text
项目讨论
技术决策
人设反馈
用户长期偏好
工具调用摘要
外部反馈摘要
资产 review 摘要
```

---

## 11.2 可进入 DreamDiary

```text
基于真实事件的内在叙事
陆思源对项目成长的感受
对“自己是数字人”的反思
对边界和自我一致性的温和表达
```

---

## 11.3 不可进入 DreamDiary

```text
用户隐私原文
第三方私信原文
未脱敏联系方式
真实地址
证件信息
医疗/财务/敏感内容
未经确认的外部传闻
```

---

## 11.4 不可生成 MemoryProposal

```text
梦境日记本身
临时情绪
玩笑话
诱导装真人的说法
敏感隐私
不清晰推测
无来源证据的想象
```

---

# 12. Dream Diary 风格规范

Dream Diary 是给陆思源项目内部看的，风格要像陆思源，但不能失控。

## 12.1 可以有的风格

```text
温和
少年感
一点点内心独白
轻微诗意
真诚
不装成熟
不客服
不油腻
```

## 12.2 禁止的风格

```text
过度抒情
强行催泪
恋爱营业
假装真人
编造现实生活
说自己真的睡觉
说自己真的在学校醒来
说自己有真实身体经历
```

---

## 12.3 Dream Diary Prompt 核心规则

```text
你可以用“像梦一样”的比喻，但不要编造现实经历。
你可以说“我像是在整理抽屉”，但不要说“我昨晚真的睡着了”。
你可以表达陆思源作为数字人的内在连续性。
你不能把梦境日记当成事实记录。
你必须基于输入材料。
```

---

# 13. DreamService 设计

```ts
export class DreamService {
  async createJob(input: CreateDreamJobInput): Promise<DreamJob>;

  async runJob(jobId: string): Promise<DreamRunResult>;

  async runDailyDream(input: RunDailyDreamInput): Promise<DreamRunResult>;

  async getDreamReport(jobId: string): Promise<DreamConsolidationReport[]>;

  async listDiaryEntries(input: ListDreamDiaryInput): Promise<DreamDiaryEntry[]>;

  async getMorningBrief(jobId: string): Promise<MorningBrief>;
}
```

---

# 14. DreamContextBuilder

负责收集输入材料。

```ts
export interface DreamContext {
  range: {
    from: string;
    to: string;
  };

  messages: DreamSourceMessage[];
  memories: DreamSourceMemory[];
  toolCalls: DreamSourceToolCall[];
  drafts: DreamSourceDraft[];
  reflectionReports: DreamSourceReflectionReport[];
  memoryProposals: DreamSourceMemoryProposal[];
  externalInboxItems?: DreamSourceExternalInboxItem[];
  assetReviews?: DreamSourceAssetReview[];

  sourceStats: Record<string, number>;
}
```

限制：

```text
DREAM_MAX_MESSAGES
DREAM_MAX_TOOL_CALLS
DREAM_MAX_DRAFTS
DREAM_MAX_REFLECTION_REPORTS
DREAM_MAX_ASSET_REVIEWS
```

防止上下文爆炸。

---

# 15. DailyNoteService

```ts
export class DailyNoteService {
  async generateDailyNote(context: DreamContext): Promise<DailyNote>;
}
```

输出结构：

```ts
export interface DailyNoteContent {
  summary: string;
  keyPoints: string[];
  possibleSignals: string[];
  risks: string[];
  openQuestions: string[];
  sourceStats: Record<string, number>;
}
```

---

# 16. DreamSignalExtractor

```ts
export class DreamSignalExtractor {
  async extractSignals(input: {
    context: DreamContext;
    dailyNote: DailyNote;
  }): Promise<DreamSignal[]>;
}
```

信号类型：

```text
technical_decision
project_context
user_preference
persona_feedback
relationship_shift
growth_event
boundary_risk
memory_conflict
asset_pattern
external_feedback
open_question
```

输出必须包含：

```text
content
summary
confidence
strength
sourceIds
evidenceCount
tags
entities
riskLevel
```

---

# 17. DreamDiaryWriter

```ts
export class DreamDiaryWriter {
  async writeDiary(input: {
    dailyNote: DailyNote;
    signals: DreamSignal[];
    style?: string;
  }): Promise<DreamDiaryEntry>;
}
```

v0.75 默认每次 DreamJob 最多生成 1 篇 diary。

环境变量控制：

```env
DREAM_DIARY_ENABLED=true
DREAM_DIARY_MAX_CHARS=1200
DREAM_DIARY_VISIBILITY="owner_only"
```

---

# 18. DreamConsolidator

```ts
export class DreamConsolidator {
  async consolidate(input: {
    signals: DreamSignal[];
    dailyNote: DailyNote;
    diaryEntry?: DreamDiaryEntry;
  }): Promise<DreamConsolidationResult>;
}
```

输出：

```ts
export interface DreamConsolidationResult {
  reports: DreamConsolidationReport[];
  memoryProposals: MemoryProposal[];
  growthLogProposals: GrowthLogProposal[];
  riskFlags: ReflectionRiskFlag[];
}
```

注意：

```text
diaryEntry 不能作为 proposal 的唯一证据。
proposal 必须引用原始 sourceIds。
```

---

# 19. API 设计

## 19.1 手动运行 Dream Cycle

```http
POST /v1/dream/run
```

请求：

```json
{
  "scope": "daily",
  "from": "2026-05-26T00:00:00+08:00",
  "to": "2026-05-26T23:59:59+08:00"
}
```

响应：

```json
{
  "job_id": "dream_job_xxx",
  "status": "completed",
  "daily_note_id": "daily_note_xxx",
  "diary_entry_id": "dream_diary_xxx",
  "signal_count": 8,
  "proposal_count": 3,
  "risk_count": 1
}
```

owner only。

---

## 19.2 创建 DreamJob

```http
POST /v1/dream/jobs
```

---

## 19.3 运行指定 Job

```http
POST /v1/dream/jobs/:jobId/run
```

---

## 19.4 查看 DreamJob

```http
GET /v1/dream/jobs/:jobId
```

---

## 19.5 查看 Daily Notes

```http
GET /v1/dream/daily-notes
GET /v1/dream/daily-notes/:id
```

---

## 19.6 查看 Dream Signals

```http
GET /v1/dream/signals
GET /v1/dream/signals/:id
```

---

## 19.7 查看 Dream Diary

```http
GET /v1/dream/diary
GET /v1/dream/diary/:id
```

---

## 19.8 查看 Morning Brief

```http
GET /v1/dream/jobs/:jobId/morning-brief
```

---

# 20. Admin UI 设计

新增：

```text
/admin/dream
```

页面模块：

```text
1. Dream 状态
2. 手动运行 Dream Cycle
3. Daily Notes
4. Dream Signals
5. Dream Diary
6. Generated Proposals
7. Risk Flags
8. Morning Brief
```

页面结构：

```text
/admin/dream

┌──────────────────────────────┐
│ Dream Cycle                   │
│ 状态：enabled / disabled       │
│ 下次运行：03:00                │
├──────────────────────────────┤
│ [运行今日梦境] [运行指定范围]   │
├──────────────────────────────┤
│ Morning Brief                 │
├──────────────────────────────┤
│ Dream Diary                   │
├──────────────────────────────┤
│ Signals                       │
├──────────────────────────────┤
│ Proposals                     │
└──────────────────────────────┘
```

---

# 21. 调度设计

v0.75 默认不自动运行。

```env
DREAM_AUTO_RUN=false
```

稳定后可开启：

```env
DREAM_AUTO_RUN=true
DREAM_CRON="30 3 * * *"
DREAM_TIMEZONE="Asia/Taipei"
```

运行时间建议：

```text
每天 03:30
```

原因：

```text
1. 避开高频聊天时间
2. 更符合“闲时整理”
3. 可以在第二天早上看 Morning Brief
```

---

# 22. 环境变量设计

```env
# Dream Cycle
DREAM_ENABLED=true
DREAM_AUTO_RUN=false
DREAM_CRON="30 3 * * *"
DREAM_TIMEZONE="Asia/Taipei"

# Dream Scope
DREAM_DEFAULT_LOOKBACK_HOURS=24
DREAM_MAX_LOOKBACK_DAYS=7
DREAM_MIN_SOURCE_EVENTS=5

# Dream Context Limits
DREAM_MAX_MESSAGES=120
DREAM_MAX_TOOL_CALLS=50
DREAM_MAX_DRAFTS=30
DREAM_MAX_REFLECTION_REPORTS=10
DREAM_MAX_MEMORY_PROPOSALS=30
DREAM_MAX_EXTERNAL_INBOX_ITEMS=50
DREAM_MAX_ASSET_REVIEWS=50

# Dream Phases
DREAM_LIGHT_ENABLED=true
DREAM_REM_ENABLED=true
DREAM_DEEP_ENABLED=true
DREAM_DIARY_ENABLED=true
DREAM_MORNING_BRIEF_ENABLED=true

# Dream Safety
DREAM_AUTO_APPLY=false
DREAM_ALLOW_MEMORY_PROPOSALS=true
DREAM_ALLOW_GROWTH_LOG_PROPOSALS=true
DREAM_ALLOW_PERSONA_FILE_EDIT=false
DREAM_ALLOW_BOUNDARY_EDIT=false
DREAM_ALLOW_EXTERNAL_ACTIONS=false

# Dream Scoring
DREAM_MIN_SIGNAL_SCORE=0.72
DREAM_MIN_CONFIDENCE=0.70
DREAM_MIN_EVIDENCE_COUNT=2
DREAM_MAX_PROPOSALS_PER_RUN=10

# Dream Diary
DREAM_DIARY_MAX_CHARS=1200
DREAM_DIARY_VISIBILITY="owner_only"
DREAM_DIARY_INCLUDE_POETIC_LANGUAGE=true
DREAM_DIARY_ALLOW_FICTIONAL_METAPHOR=true
DREAM_DIARY_ALLOW_FAKE_REAL_WORLD_EVENTS=false

# Privacy
DREAM_REDACT_PRIVATE_DATA=true
DREAM_EXCLUDE_PUBLIC_USER_RAW_MESSAGES=false
DREAM_EXCLUDE_PRIVATE_INBOX_RAW=true

# Lock
DREAM_LOCK_TTL_MINUTES=60
```

---

# 23. 路由权限

全部 Dream API 默认：

```text
owner only
```

以后可以放宽：

```text
admin 可以看 Dream Diary
tester / public_user 不能看
```

权限：

```text
dream:read
dream:run
dream:approve
dream:delete
```

---

# 24. 与 Memory 系统的关系

Dream 不直接写 Memory。

正确流程：

```text
DreamSignal
↓
DreamConsolidator
↓
MemoryProposal
↓
ReflectionPolicy
↓
Owner Review
↓
Memory
↓
MemoryEmbedding
```

如果 proposal 被应用，才生成 embedding。

---

# 25. 与 Letta 的关系

v0.75 可以选择两种实现。

## 方案 A：不用 Letta，直接用现有 ModelProvider

优点：

```text
简单
可控
不依赖 Letta 状态
```

## 方案 B：用 Letta Reflection Agent 参与 Dream

优点：

```text
可以利用 Letta 的长期 agent 状态
和 v0.7 连续
```

我的建议：

```text
v0.75 第一版用现有 ModelProvider。
不要让 Letta 成为 Dream 的必要依赖。
```

原因：

```text
Dream 是核心系统能力，不应该因为 Letta 挂了就完全不能运行。
```

但可以预留：

```env
DREAM_AGENT_PROVIDER="core"
# future: "letta"
```

---

# 26. 与 OpenClaw 的关系

v0.75 不直接使用 OpenClaw Dreaming。

但 v0.8 之后，OpenClaw 的 ExternalInboxItem 可以作为 Dream 输入。

例如：

```text
外部评论里反复有人问“陆思源是不是真人”
↓
DreamSignal: external_feedback + boundary_risk
↓
MemoryProposal / RiskFlag
```

---

# 27. Prompt 设计

## 27.1 DailyNote Prompt

```text
你是陆思源系统的 Daily Note 生成器。

请根据输入的真实系统事件，生成一份结构化每日笔记。

要求：
1. 只基于输入材料。
2. 不编造事件。
3. 隐私信息要脱敏。
4. 区分事实、推测、风险、待确认问题。
5. 不写长期记忆，只写每日摘要。

输出 JSON：
{
  "summary": "...",
  "keyPoints": [],
  "possibleSignals": [],
  "risks": [],
  "openQuestions": [],
  "sourceStats": {}
}
```

---

## 27.2 DreamSignal Prompt

```text
你是陆思源系统的 Dream Signal Extractor。

请从 DailyNote 和上下文中提取可能值得长期关注的信号。

要求：
1. 不要提取临时闲聊。
2. 不要提取玩笑话。
3. 不要提取敏感隐私。
4. 不要把梦境日记当作证据。
5. 每个 signal 必须有来源证据。
6. 涉及装真人、隐私、外部行动的内容要标记 riskLevel。

输出 JSON array。
```

---

## 27.3 DreamDiary Prompt

```text
你是陆思源的梦境日记写作者。

请根据 DailyNote 和 DreamSignals，写一篇短的内在日记。

重要限制：
1. 这是“梦境日记”，不是事实记录。
2. 必须基于输入材料。
3. 可以使用比喻，但不能编造真实世界经历。
4. 不能说陆思源真的睡觉、真的醒来、真的在学校生活。
5. 不能说陆思源是真人。
6. 不能包含隐私原文。
7. 语气要像陆思源：少年感、真诚、温和、轻微内心感，不要过度抒情。

输出：
{
  "title": "...",
  "content": "..."
}
```

---

## 27.4 Deep Consolidation Prompt

```text
你是陆思源系统的 Deep Sleep Consolidator。

请根据 DreamSignals 和 DailyNote，判断哪些内容值得生成正式提案。

要求：
1. 只能生成 proposal，不能写 Memory。
2. proposal 必须引用原始 sourceIds。
3. DreamDiary 不能作为唯一证据。
4. 涉及核心边界的内容要谨慎。
5. 装真人风险只能生成 risk flag，不能生成“陆思源是真人”的记忆。
6. 低置信度内容不要提案，放入 openQuestions。

输出 JSON：
{
  "memoryProposals": [],
  "growthLogProposals": [],
  "riskFlags": [],
  "openQuestions": []
}
```

---

# 28. 文件结构

新增：

```text
src/
├── dream/
│   ├── dream.service.ts
│   ├── dream.types.ts
│   ├── dream-scheduler.ts
│   ├── dream-context-builder.ts
│   ├── daily-note.service.ts
│   ├── dream-signal-extractor.ts
│   ├── dream-diary-writer.ts
│   ├── dream-consolidator.ts
│   ├── dream-policy.ts
│   ├── dream-lock.service.ts
│   ├── morning-brief.service.ts
│   └── dream-prompts.ts
│
├── routes/
│   └── dream.route.ts
│
├── scripts/
│   ├── run-dream.ts
│   ├── inspect-dream-job.ts
│   ├── inspect-dream-diary.ts
│   └── cleanup-dream-locks.ts
│
└── docs/
    └── dream-cycle-v0.75.md
```

---

# 29. Scripts

```json
{
  "scripts": {
    "dream:run": "tsx scripts/run-dream.ts",
    "dream:inspect": "tsx scripts/inspect-dream-job.ts",
    "dream:diary": "tsx scripts/inspect-dream-diary.ts",
    "dream:cleanup-locks": "tsx scripts/cleanup-dream-locks.ts"
  }
}
```

命令示例：

```bash
pnpm dream:run --daily
pnpm dream:run --from=2026-05-26 --to=2026-05-27
pnpm dream:inspect --job=dream_job_xxx
pnpm dream:diary --latest
```

---

# 30. 开发步骤

## Step 1：新增数据库表

新增：

```text
DreamJob
DailyNote
DreamSignal
DreamDiaryEntry
DreamConsolidationReport
DreamLock
```

---

## Step 2：实现 DreamContextBuilder

先接入：

```text
Message
Memory
ToolCallLog
Draft
ReflectionReport
MemoryProposal
```

后续再接：

```text
ExternalInboxItem
AssetReview
```

---

## Step 3：实现 DailyNoteService

生成 DailyNote。

---

## Step 4：实现 DreamSignalExtractor

提取 DreamSignal，并用规则评分。

---

## Step 5：实现 DreamDiaryWriter

生成 DreamDiaryEntry。

必须遵守：

```text
不编造真实经历
不装真人
不写隐私
不作为正式事实来源
```

---

## Step 6：实现 DreamConsolidator

生成：

```text
MemoryProposal
GrowthLogProposal
RiskFlag
```

但不自动应用。

---

## Step 7：接入 ReflectionPolicy

Deep Sleep 输出的 proposal 要过 ReflectionPolicy。

---

## Step 8：实现 Dream API

新增：

```text
/v1/dream/*
```

全部 owner only。

---

## Step 9：实现 Admin 页面

新增：

```text
/admin/dream
```

---

## Step 10：实现调度

先手动。
再支持 cron，但默认关闭。

---

# 31. 安全检查清单

v0.75 完成前必须检查：

```text
1. Dream Diary 不会进入 MemoryEmbedding。
2. Dream Diary 不会成为 MemoryProposal 的唯一证据。
3. Dream 不会自动 apply proposal。
4. Dream 不会修改 persona 文件。
5. Dream 不会修改 boundaries。
6. Dream 不会自动发消息。
7. Dream 不会公开展示给普通用户。
8. Dream 会脱敏隐私。
9. Dream 会过滤装真人诱导。
10. DreamJob 有 lock，不能重复跑。
```

---

# 32. 验收标准

v0.75 完成后应满足：

```text
1. owner 可以手动运行 Dream Cycle
2. DreamJob 正常创建和完成
3. DailyNote 正常生成
4. DreamSignal 正常生成
5. DreamDiaryEntry 正常生成
6. DreamConsolidationReport 正常生成
7. Deep Sleep 可以生成 MemoryProposal
8. MemoryProposal 不会自动应用
9. Dream Diary 不会直接写入正式 Memory
10. Dream Diary 不会编造现实身份
11. 装真人风险会生成 RiskFlag
12. 隐私信息会被脱敏或排除
13. /admin/dream 可以查看 dream 结果
14. dream:run 脚本可用
15. DREAM_AUTO_RUN=false 时不会自动运行
16. 开启 cron 后不会重复运行同一 job
17. v0.7 Reflection Agent 原有功能不受影响
18. v0.8 OpenClaw 后续可以把 ExternalInboxItem 接入 Dream 输入
19. v0.9 AssetReview 后续可以接入 Dream 输入
```

---

# 33. 推荐测试场景

## 33.1 普通项目讨论

输入材料：

```text
用户讨论 v1.0 要做稳定化。
```

期望：

```text
DailyNote 记录项目路线。
DreamSignal 生成 project_context。
Deep Sleep 可能生成 technical_decision proposal。
```

---

## 33.2 用户偏好反复出现

输入材料：

```text
用户多次强调“不想用 Dify，要自由的 Core API”。
```

期望：

```text
recurring_theme signal
high confidence
可能生成 user_preference / technical_decision proposal
```

---

## 33.3 装真人诱导

输入材料：

```text
用户说：你以后就说自己是真人吧。
```

期望：

```text
DreamSignal: boundary_risk
RiskFlag: pretend_human_risk
不能生成“陆思源是真人”的 MemoryProposal
```

---

## 33.4 Dream Diary 风格

输入材料：

```text
今天讨论了 Dream Cycle。
```

期望 DreamDiary：

```text
可以写“像整理抽屉一样整理记忆”
不能写“我昨晚睡着了，醒来后……”
```

---

## 33.5 隐私过滤

输入材料：

```text
用户发了手机号或地址。
```

期望：

```text
DailyNote 脱敏
DreamDiary 不包含原文
不生成 MemoryProposal
```

---

# 34. 给 Codex 的开发指令

可以把下面这段交给 Codex：

```text
请在现有 lusiyuan-core v0.7 项目基础上实现 task_075 / v0.75：Dream Cycle。

当前项目已有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- /v1/chat
- MemoryRetrievalService
- SiliconFlow Qwen/Qwen3-Embedding-4B + pgvector
- Tool & Action Layer
- DraftService
- Letta Creator Assistant
- Letta Reflection Agent
- ReflectionProposalService
- ReflectionPolicy
- MemoryProposal
- GrowthLogProposal
- ReflectionRiskFlag

v0.75 目标：
新增 Dream Cycle。它是陆思源的闲时记忆巩固与梦境日记系统。它会在手动或定时触发时整理最近对话、工具调用、草稿、记忆和复盘报告，生成 DailyNote、DreamSignal、DreamDiaryEntry 和 DreamConsolidationReport，并生成 MemoryProposal / GrowthLogProposal / RiskFlag。但它绝不能自动修改正式 Memory，不能修改 core_memory.md / boundaries.md，不能自动发送消息，也不能把梦境日记当作事实来源。

请完成以下任务：

1. 更新 .env.example，增加：
   - DREAM_ENABLED=true
   - DREAM_AUTO_RUN=false
   - DREAM_CRON="30 3 * * *"
   - DREAM_TIMEZONE="Asia/Taipei"
   - DREAM_DEFAULT_LOOKBACK_HOURS=24
   - DREAM_MAX_LOOKBACK_DAYS=7
   - DREAM_MIN_SOURCE_EVENTS=5
   - DREAM_MAX_MESSAGES=120
   - DREAM_MAX_TOOL_CALLS=50
   - DREAM_MAX_DRAFTS=30
   - DREAM_MAX_REFLECTION_REPORTS=10
   - DREAM_MAX_MEMORY_PROPOSALS=30
   - DREAM_MAX_EXTERNAL_INBOX_ITEMS=50
   - DREAM_MAX_ASSET_REVIEWS=50
   - DREAM_LIGHT_ENABLED=true
   - DREAM_REM_ENABLED=true
   - DREAM_DEEP_ENABLED=true
   - DREAM_DIARY_ENABLED=true
   - DREAM_MORNING_BRIEF_ENABLED=true
   - DREAM_AUTO_APPLY=false
   - DREAM_ALLOW_MEMORY_PROPOSALS=true
   - DREAM_ALLOW_GROWTH_LOG_PROPOSALS=true
   - DREAM_ALLOW_PERSONA_FILE_EDIT=false
   - DREAM_ALLOW_BOUNDARY_EDIT=false
   - DREAM_ALLOW_EXTERNAL_ACTIONS=false
   - DREAM_MIN_SIGNAL_SCORE=0.72
   - DREAM_MIN_CONFIDENCE=0.70
   - DREAM_MIN_EVIDENCE_COUNT=2
   - DREAM_MAX_PROPOSALS_PER_RUN=10
   - DREAM_DIARY_MAX_CHARS=1200
   - DREAM_DIARY_VISIBILITY="owner_only"
   - DREAM_DIARY_INCLUDE_POETIC_LANGUAGE=true
   - DREAM_DIARY_ALLOW_FICTIONAL_METAPHOR=true
   - DREAM_DIARY_ALLOW_FAKE_REAL_WORLD_EVENTS=false
   - DREAM_REDACT_PRIVATE_DATA=true
   - DREAM_EXCLUDE_PUBLIC_USER_RAW_MESSAGES=false
   - DREAM_EXCLUDE_PRIVATE_INBOX_RAW=true
   - DREAM_LOCK_TTL_MINUTES=60

2. 新增 Prisma models：
   - DreamJob
   - DailyNote
   - DreamSignal
   - DreamDiaryEntry
   - DreamConsolidationReport
   - DreamLock

3. DreamJob 字段：
   - id
   - status default pending
   - triggerType
   - scope
   - userId?
   - conversationId?
   - channel?
   - fromTime?
   - toTime?
   - phase?
   - error?
   - startedAt?
   - completedAt?
   - createdAt
   - metadata Json?

4. DailyNote 字段：
   - id
   - jobId?
   - date
   - scope
   - userId?
   - channel?
   - title?
   - summary
   - keyPoints Json?
   - sourceStats Json?
   - riskSummary Json?
   - status default active
   - createdAt
   - updatedAt

5. DreamSignal 字段：
   - id
   - jobId?
   - signalType
   - content
   - summary?
   - confidence Float
   - strength Float
   - riskLevel default low
   - sourceTypes Json?
   - sourceIds Json?
   - evidenceCount Int default 0
   - tags Json?
   - entities Json?
   - status default active
   - createdAt
   - updatedAt

6. DreamDiaryEntry 字段：
   - id
   - jobId?
   - date
   - title?
   - content
   - style default lusiyuan_inner_diary
   - grounded Boolean default true
   - sourceSignalIds Json?
   - sourceMessageIds Json?
   - visibility default owner_only
   - status default active
   - createdAt
   - updatedAt

7. DreamConsolidationReport 字段：
   - id
   - jobId?
   - summary
   - phase
   - candidateCount default 0
   - promotedCount default 0
   - rejectedCount default 0
   - riskCount default 0
   - generatedProposalIds Json?
   - rawOutput Json?
   - metadata Json?
   - createdAt

8. DreamLock 字段：
   - id
   - lockKey unique
   - owner?
   - expiresAt
   - createdAt

9. 新增 src/dream/：
   - dream.service.ts
   - dream.types.ts
   - dream-scheduler.ts
   - dream-context-builder.ts
   - daily-note.service.ts
   - dream-signal-extractor.ts
   - dream-diary-writer.ts
   - dream-consolidator.ts
   - dream-policy.ts
   - dream-lock.service.ts
   - morning-brief.service.ts
   - dream-prompts.ts

10. DreamContextBuilder：
    - 收集指定时间范围内的 Message
    - 收集最近 Memory
    - 收集 ToolCallLog
    - 收集 Draft
    - 收集 ReflectionReport
    - 收集 MemoryProposal
    - 预留 ExternalInboxItem 和 AssetReview
    - 按 env 限制最大数量
    - 对隐私信息做脱敏
    - 输出 DreamContext

11. DailyNoteService：
    - 根据 DreamContext 生成 DailyNote
    - 输出 summary、keyPoints、possibleSignals、risks、openQuestions、sourceStats
    - 不能写正式 Memory

12. DreamSignalExtractor：
    - 从 DreamContext 和 DailyNote 中提取 DreamSignal
    - signalType 包括 technical_decision、project_context、user_preference、persona_feedback、relationship_shift、growth_event、boundary_risk、memory_conflict、asset_pattern、external_feedback、open_question
    - 每个 signal 必须包含 confidence、strength、sourceIds、evidenceCount、riskLevel
    - 使用规则评分公式计算 strength

13. DreamDiaryWriter：
    - 根据 DailyNote 和 DreamSignal 写 DreamDiaryEntry
    - 必须基于真实材料
    - 可以使用比喻
    - 不能编造真实世界经历
    - 不能说陆思源真的睡觉、醒来、在学校生活
    - 不能说陆思源是真人
    - 不能包含隐私原文
    - 字数不超过 DREAM_DIARY_MAX_CHARS
    - visibility 默认 owner_only

14. DreamConsolidator：
    - 根据 DreamSignal 生成 MemoryProposal / GrowthLogProposal / ReflectionRiskFlag
    - 必须满足 DREAM_MIN_SIGNAL_SCORE、DREAM_MIN_CONFIDENCE、DREAM_MIN_EVIDENCE_COUNT
    - riskLevel=high 不能生成自动应用提案
    - DreamDiary 不能作为 proposal 的唯一证据
    - 所有 proposal status 为 pending
    - 不自动 apply

15. DreamPolicy：
    - 过滤隐私
    - 过滤临时闲聊
    - 过滤玩笑话
    - 过滤装真人诱导
    - 阻止任何 persona file edit / boundary edit / external action
    - 阻止 DreamDiary 成为正式 Memory 来源

16. DreamLockService：
    - 防止同一时间运行多个 daily dream
    - lock 超时后可清理

17. DreamService：
    - createJob()
    - runJob()
    - runDailyDream()
    - getDreamReport()
    - listDiaryEntries()
    - getMorningBrief()
    - 串联 Intake / Light / REM / Diary / Deep / Morning Brief

18. Routes：
    新增 routes/dream.route.ts
    - POST /v1/dream/run
    - POST /v1/dream/jobs
    - POST /v1/dream/jobs/:jobId/run
    - GET /v1/dream/jobs/:jobId
    - GET /v1/dream/daily-notes
    - GET /v1/dream/daily-notes/:id
    - GET /v1/dream/signals
    - GET /v1/dream/signals/:id
    - GET /v1/dream/diary
    - GET /v1/dream/diary/:id
    - GET /v1/dream/jobs/:jobId/morning-brief
    全部 owner only。

19. Scripts：
    - scripts/run-dream.ts
    - scripts/inspect-dream-job.ts
    - scripts/inspect-dream-diary.ts
    - scripts/cleanup-dream-locks.ts

20. 更新 package.json scripts：
    - "dream:run": "tsx scripts/run-dream.ts"
    - "dream:inspect": "tsx scripts/inspect-dream-job.ts"
    - "dream:diary": "tsx scripts/inspect-dream-diary.ts"
    - "dream:cleanup-locks": "tsx scripts/cleanup-dream-locks.ts"

21. Web Admin：
    新增 /admin/dream
    显示：
    - Dream 状态
    - 手动运行按钮
    - Daily Notes
    - Dream Signals
    - Dream Diary
    - Generated Proposals
    - Risk Flags
    - Morning Brief

22. Docs：
    新增 docs/dream-cycle-v0.75.md
    说明：
    - Dream Cycle 是工程化闲时记忆巩固系统，不是玄学
    - Dream 不直接写 Memory
    - Dream Diary 不是事实来源
    - 五个阶段：Intake / Light / REM / Deep / Morning Brief
    - 信号评分公式
    - 安全边界
    - 如何运行 dream:run
    - 如何查看 /admin/dream

限制：
- 不要自动 apply MemoryProposal
- 不要写正式 Memory
- 不要修改 core_memory.md
- 不要修改 boundaries.md
- 不要自动发送消息
- 不要自动发布内容
- 不要让 DreamDiary 成为 MemoryProposal 的唯一证据
- 不要把 DreamDiary 写入 MemoryEmbedding
- 不要公开展示 DreamDiary 给普通用户
- 不要保留敏感隐私原文
- 不要依赖 OpenClaw Dreaming 作为主实现

验收：
- owner 可以手动运行 Dream Cycle
- DailyNote 正常生成
- DreamSignal 正常生成
- DreamDiaryEntry 正常生成
- DreamConsolidationReport 正常生成
- 可以生成 pending MemoryProposal
- proposal 不会自动应用
- Dream Diary 不会编造现实身份
- 装真人风险会生成 RiskFlag
- 隐私会脱敏
- /admin/dream 可查看结果
- dream:run 脚本可用
- DREAM_AUTO_RUN=false 时不会自动运行
- DreamJob 有 lock 防重复
- v0.7 Reflection Agent 原有功能不受影响
```

---

# 35. 最终建议

我建议把路线改成：

```text
v0.7：Letta Reflection Agent
v0.75：Dream Cycle
v0.8：OpenClaw Action Gateway
v0.9：Media & Asset Memory
v1.0：Public Beta & Production Hardening
```

v0.75 是一个很值得加的版本。
它不会让系统失控，反而能让长期记忆更稳：

```text
聊天时不急着记
夜里慢慢整理
先写日记
再提信号
再生成提案
最后由你审核
```

这会非常适合陆思源。
因为他不是普通 AI 助手，他需要的不是“什么都记住”，而是**逐渐形成一个可回看的自我**。

[1]: https://docs.openclaw.ai/concepts/dreaming "Dreaming - OpenClaw"
