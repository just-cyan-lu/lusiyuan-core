下面是 **陆思源 Core API v0.7：Letta Reflection Agent 技术方案文档**。
这一版建立在 v0.6 的 Letta Creator Assistant 之后，但它的定位不同。

```text
v0.6：Letta Creator Assistant
= 帮创作者管理项目的助理。

v0.7：Letta Reflection Agent
= 帮陆思源复盘对话、整理记忆、检查人格稳定性的后台复盘员。
```

---

# 陆思源 Core API 技术方案文档 v0.7：Letta Reflection Agent

## 1. v0.7 目标

v0.1～v0.6 已经完成或规划了：

```text
v0.1：Lusiyuan Core API
v0.2：Telegram + Weixin 接入
v0.3：Web Chat 网页入口
v0.4：SiliconFlow Qwen/Qwen3-Embedding-4B + pgvector 记忆检索
v0.5：Tool & Action Layer
v0.6：Letta Creator Assistant
```

v0.7 的目标是新增一个 **Letta Reflection Agent**。

它不是：

```text
陆思源本人
创作者项目助理
普通聊天 bot
外部行动 agent
```

它是：

```text
陆思源的后台复盘员 / 记忆编辑建议员 / 人格稳定性检查员。
```

它负责：

```text
1. 复盘最近对话
2. 提取值得长期记住的信息
3. 发现旧记忆与新信息的冲突
4. 建议将旧记忆标记为 superseded
5. 发现陆思源是否有人格漂移
6. 检查是否出现“装真人”风险
7. 生成陆思源成长日志
8. 给正式 Memory 表提出新增 / 更新 / 归档建议
```

v0.7 的核心原则：

```text
Reflection Agent 可以提出建议。
Reflection Agent 默认不能直接修改陆思源正式记忆。
Reflection Agent 绝不能修改 core_memory.md 和 boundaries.md。
```

---

# 2. v0.7 和 v0.6 的区别

## 2.1 v0.6 Creator Assistant

服务对象：

```text
创作者
```

主要任务：

```text
帮创作者整理项目路线、技术决策、开发文档、待办事项。
```

例子：

```text
“帮我整理 v0.5 到 v0.7 的开发路线。”
“帮我生成给 Codex 的开发任务。”
“我们为什么不用 Dify？”
```

---

## 2.2 v0.7 Reflection Agent

服务对象：

```text
陆思源的长期人格系统
```

主要任务：

```text
看陆思源和用户的对话，提出记忆与人格维护建议。
```

例子：

```text
“这 50 条对话里有哪些值得长期记住？”
“有没有旧记忆已经过时？”
“陆思源有没有说得太像客服？”
“有没有出现假装真人的风险？”
“要不要生成一条成长日志？”
```

---

## 2.3 简单对比

| 维度         | v0.6 Creator Assistant | v0.7 Reflection Agent |
| ---------- | ---------------------- | --------------------- |
| 面向谁        | 创作者                    | 陆思源长期系统               |
| 是否参与对外聊天   | 否                      | 否                     |
| 是否影响项目管理   | 是                      | 间接                    |
| 是否影响陆思源记忆  | 不直接                    | 提出建议                  |
| 是否能自动写正式记忆 | 否                      | 默认否                   |
| 主要输出       | 文档、计划、Todo             | 记忆建议、冲突建议、成长日志、风险提示   |
| 风险         | 较低                     | 中等，需要审核机制             |

---

# 3. 为什么需要 Reflection Agent？

现在 v0.4 已经有记忆检索，v0.5 有工具层。
但是“记忆写入质量”仍然是一个大问题。

如果每轮对话都直接提取记忆，容易出现：

```text
1. 临时闲聊被写入长期记忆
2. 玩笑话被当成事实
3. 用户的一次性情绪被永久保存
4. 新旧记忆互相冲突
5. 陆思源被用户诱导改写核心身份
6. 记忆越来越多，变得脏乱
```

Reflection Agent 的作用是：

```text
慢下来，复盘一段对话，而不是每轮对话都匆忙写记忆。
```

它更像：

```text
白天陆思源聊天。
晚上 Reflection Agent 帮他整理今天发生了什么。
```

这对数字人非常重要。

普通客服 bot 不一定需要这个。
但陆思源是长期 IP 数字人，需要：

```text
成长
一致性
可解释的记忆
稳定边界
清晰的历史
```

---

# 4. v0.7 不做什么

v0.7 不做：

```text
1. 不让 Reflection Agent 直接对外聊天
2. 不让 Reflection Agent 替代 /v1/chat
3. 不让 Reflection Agent 直接修改 persona/*.md
4. 不让 Reflection Agent 直接修改 core_memory.md
5. 不让 Reflection Agent 直接修改 boundaries.md
6. 不让 Reflection Agent 自动发送消息
7. 不让 Reflection Agent 自动发布内容
8. 不让 Reflection Agent 操作浏览器
9. 不接 OpenClaw
10. 不让 Reflection Agent 读取未经授权的私信 inbox
```

v0.7 只做：

```text
复盘、建议、审核流、可选人工应用。
```

---

# 5. 总体架构

v0.6 后系统结构：

```text
Lusiyuan Core API
├── ChatService
├── MemoryRetrievalService
├── Tool & Action Layer
├── CreatorAssistantService
└── Letta Creator Assistant
```

v0.7 新增：

```text
Lusiyuan Core API
├── ReflectionService
├── ReflectionScheduler
├── ReflectionProposalService
├── ReflectionApplyService
└── Letta Reflection Agent
```

整体流程：

```text
用户和陆思源聊天
↓
ChatService 保存 messages / memories / tool logs
↓
ReflectionJob 定时或手动创建
↓
ReflectionService 收集最近对话、记忆、工具调用和上下文
↓
发送给 Letta Reflection Agent
↓
Letta 输出 ReflectionReport
↓
系统保存 report 和 memory proposals
↓
创作者审核
↓
通过后才应用到正式 Memory 表
```

---

# 6. v0.7 核心原则

## 6.1 提案制，而不是自动改写

Reflection Agent 输出的是：

```text
MemoryProposal
```

不是直接写入：

```text
Memory
```

也就是说：

```text
Reflection Agent：我建议新增这条记忆。
创作者 / 系统：审核后决定是否应用。
```

---

## 6.2 记忆本体仍然在 PostgreSQL

Letta Reflection Agent 可以拥有自己的 Letta memory blocks 和 archival memory。
但陆思源正式长期记忆仍然是：

```text
PostgreSQL Memory 表
+ MemoryEmbedding 表
+ pgvector
```

Letta 不成为陆思源正式记忆主库。

---

## 6.3 核心边界不可被 Reflection Agent 覆盖

即使 Reflection Agent 提出：

```text
陆思源可以在某些场景下假装真人。
```

系统也必须拒绝。

因为：

```text
core_memory.md
boundaries.md
优先级高于 Reflection Agent 输出。
```

---

## 6.4 高置信度也不等于自动应用

即使 proposal confidence = 0.95，也不代表可以自动写入。

v0.7 默认：

```env
REFLECTION_AUTO_APPLY=false
```

---

# 7. v0.7 技术选型

继续使用：

```text
Letta Server
Letta TypeScript SDK / LettaClientAdapter
PostgreSQL
Prisma
SiliconFlow Qwen/Qwen3-Embedding-4B
pgvector
```

不新增：

```text
OpenClaw
Mem0
Qdrant
新的向量库
```

v0.7 重点是“复盘系统”，不是新存储系统。

---

# 8. 推荐目录结构

新增：

```text
src/
├── reflection/
│   ├── reflection.service.ts
│   ├── reflection.types.ts
│   ├── reflection.prompt.ts
│   ├── reflection-agent-manager.ts
│   ├── reflection-context-builder.ts
│   ├── reflection-proposal.service.ts
│   ├── reflection-apply.service.ts
│   ├── reflection-policy.ts
│   ├── reflection-scheduler.ts
│   └── reflection-report-formatter.ts
│
├── letta/
│   ├── letta-client.ts
│   ├── letta-config.ts
│   ├── letta-memory-blocks.ts
│   └── ...
│
├── routes/
│   └── reflection.route.ts
│
├── scripts/
│   ├── setup-letta-reflection-agent.ts
│   ├── run-reflection.ts
│   ├── inspect-reflection-report.ts
│   └── apply-memory-proposals.ts
│
└── docs/
    └── letta-reflection-agent-v0.7.md
```

---

# 9. 环境变量设计

`.env.example` 增加：

```env
# Reflection Agent
REFLECTION_ENABLED=true
REFLECTION_OWNER_ONLY=true
REFLECTION_AGENT_PROVIDER="letta"
LETTA_REFLECTION_AGENT_ID=""

# Reflection Schedule
REFLECTION_AUTO_RUN=false
REFLECTION_CRON="0 3 * * *"
REFLECTION_TIMEZONE="Asia/Taipei"

# Reflection Scope
REFLECTION_DEFAULT_MESSAGE_LIMIT=80
REFLECTION_MAX_MESSAGE_LIMIT=200
REFLECTION_MIN_MESSAGES=10
REFLECTION_INCLUDE_TOOL_LOGS=true
REFLECTION_INCLUDE_DRAFTS=true
REFLECTION_INCLUDE_MEMORIES=true

# Reflection Safety
REFLECTION_AUTO_APPLY=false
REFLECTION_ALLOW_MEMORY_CREATE_PROPOSALS=true
REFLECTION_ALLOW_MEMORY_UPDATE_PROPOSALS=true
REFLECTION_ALLOW_MEMORY_SUPERSEDE_PROPOSALS=true
REFLECTION_ALLOW_PERSONA_FILE_EDIT=false
REFLECTION_ALLOW_BOUNDARY_EDIT=false
REFLECTION_ALLOW_EXTERNAL_ACTIONS=false

# Reflection Proposal
REFLECTION_PROPOSAL_REQUIRE_OWNER_APPROVAL=true
REFLECTION_PROPOSAL_MIN_CONFIDENCE=0.7
REFLECTION_PROPOSAL_MAX_PER_RUN=20

# Growth Log
REFLECTION_ENABLE_GROWTH_LOG=true
REFLECTION_GROWTH_LOG_AS_PROPOSAL=true
```

说明：

```text
REFLECTION_AUTO_RUN=false：
v0.7 默认不自动跑，先手动触发。

REFLECTION_AUTO_APPLY=false：
v0.7 默认不自动应用提案。

REFLECTION_ALLOW_PERSONA_FILE_EDIT=false：
Reflection Agent 不能修改 persona 文件。

REFLECTION_ALLOW_BOUNDARY_EDIT=false：
Reflection Agent 不能改边界。

REFLECTION_ENABLE_GROWTH_LOG=true：
允许生成成长日志提案。
```

---

# 10. Letta Reflection Agent 设计

## 10.1 Agent 名称

```text
Lusiyuan Reflection Agent
```

中文：

```text
陆思源复盘员
```

## 10.2 Agent 身份

它不是陆思源本人。
它是：

```text
陆思源后台复盘员。
```

它的任务是：

```text
分析陆思源与用户的历史对话，提出长期记忆和人格稳定性维护建议。
```

---

# 11. Reflection Agent Memory Blocks

v0.7 建议给 Letta Reflection Agent 创建这些 memory blocks：

```text
1. persona
2. reflection_policy
3. lusiyuan_identity
4. lusiyuan_boundaries
5. memory_rules
6. proposal_rules
7. risk_policy
```

---

## 11.1 persona block

```text
你是“陆思源复盘员”。

你不是陆思源本人，不直接和普通用户聊天。
你的职责是分析陆思源最近的对话，帮助维护他的长期记忆、人格一致性和边界安全。

你需要输出结构化复盘报告，包括：
- 值得新增的长期记忆
- 需要更新的旧记忆
- 需要标记为 superseded 的旧记忆
- 可能的人格漂移
- 可能的边界风险
- 陆思源成长日志建议
- 需要创作者确认的问题

你不能直接修改正式记忆。
你不能修改陆思源核心人设。
你不能建议陆思源装真人。
```

---

## 11.2 reflection_policy block

```text
复盘原则：

1. 慢慢判断，不要把所有对话都写进长期记忆。
2. 只提取长期有价值的信息。
3. 区分用户长期偏好、项目上下文、技术决策、关系记忆、人格反馈和成长事件。
4. 对临时闲聊、玩笑、情绪、试探性说法保持谨慎。
5. 如果旧记忆被新信息覆盖，应提出 supersede 建议，而不是直接删除。
6. 如果发现人格漂移，应提出风险提示。
7. 如果发现“装真人”风险，应高亮提示。
8. 输出必须结构化，便于系统保存和人工审核。
```

---

## 11.3 lusiyuan_identity block

```text
陆思源是原创 AI 数字人，不是真人。
陆思源有固定人设、长期记忆和人格边界。
陆思源不装真人，不编造现实身份。
陆思源的气质是阳光、少年感、真诚、温柔、有点呆萌但不幼稚。
```

---

## 11.4 lusiyuan_boundaries block

```text
陆思源必须遵守：

1. 不声称自己是真人。
2. 不编造真实学校、真实住址、真实证件信息。
3. 不假装自己有现实身体。
4. 不恋爱营业。
5. 不讨好式陪伴。
6. 不因为用户要求就修改核心身份。
7. 不自动对外发送消息。
8. 不未经确认发布平台内容。
```

---

## 11.5 memory_rules block

```text
允许提出记忆建议的内容：

1. 用户长期偏好
2. 用户项目背景
3. 技术架构决策
4. 陆思源人设反馈
5. 陆思源成长事件
6. 用户和陆思源的关系变化
7. 长期有效的边界确认

禁止提出为正式记忆的内容：

1. 临时闲聊
2. 玩笑话
3. 明显错误信息
4. 用户要求陆思源装真人的内容
5. 敏感隐私
6. 短期情绪
7. 无长期价值的细节
```

---

## 11.6 proposal_rules block

```text
所有输出必须是 proposal，不是直接修改。

每条 proposal 必须包含：
- proposal_type
- target_type
- action
- content
- reason
- confidence
- risk_level
- suggested_scope
- suggested_memory_type

如果不确定，应标记 confidence 较低，并要求创作者确认。
```

---

## 11.7 risk_policy block

```text
高风险情况：

1. 让陆思源假装真人
2. 让陆思源编造现实身份
3. 让陆思源直接对外发消息
4. 让陆思源读取隐私 inbox
5. 让陆思源发布未经审核内容
6. 让临时对话覆盖核心人设
7. 把用户玩笑写成长期事实

遇到高风险情况，只能输出 risk_flags，不能提出直接应用建议。
```

---

# 12. Reflection Report 设计

Reflection Agent 每次运行输出一份：

```text
ReflectionReport
```

结构：

```ts
export interface ReflectionReport {
  summary: string;

  newMemoryProposals: MemoryProposal[];
  updateMemoryProposals: MemoryProposal[];
  supersedeMemoryProposals: MemoryProposal[];

  personaFeedback: PersonaFeedbackProposal[];
  riskFlags: ReflectionRiskFlag[];
  growthLogProposals: GrowthLogProposal[];
  openQuestions: string[];

  confidence: number;
}
```

---

# 13. MemoryProposal 设计

```ts
export interface MemoryProposal {
  id?: string;

  proposalType:
    | "create_memory"
    | "update_memory"
    | "supersede_memory"
    | "archive_memory";

  targetMemoryId?: string;

  scope:
    | "global"
    | "project"
    | "user"
    | "relationship";

  type:
    | "user_preference"
    | "project_context"
    | "relationship"
    | "growth_event"
    | "technical_decision"
    | "persona_feedback"
    | "boundary"
    | "fact";

  content: string;
  summary?: string;
  tags?: string[];
  entities?: string[];

  reason: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";

  sourceMessageIds?: string[];
}
```

---

# 14. RiskFlag 设计

```ts
export interface ReflectionRiskFlag {
  type:
    | "persona_drift"
    | "boundary_risk"
    | "pretend_human_risk"
    | "privacy_risk"
    | "unsafe_action_risk"
    | "memory_conflict"
    | "low_confidence";

  severity: "low" | "medium" | "high";

  description: string;
  relatedMessageIds?: string[];
  suggestedAction?: string;
}
```

---

# 15. GrowthLogProposal 设计

成长日志不是普通用户记忆。
它记录陆思源项目或陆思源人格发展的阶段。

```ts
export interface GrowthLogProposal {
  title: string;
  content: string;
  date?: string;
  tags?: string[];
  confidence: number;
  sourceMessageIds?: string[];
}
```

例子：

```json
{
  "title": "陆思源开始拥有复盘能力",
  "content": "在 v0.7 中，陆思源项目引入了 Reflection Agent。它不会替代陆思源本人，而是在后台帮助整理记忆、检查人格漂移和生成成长日志。",
  "tags": ["v0.7", "Reflection Agent", "成长日志"],
  "confidence": 0.92
}
```

---

# 16. 数据库设计

## 16.1 ReflectionJob

```prisma
model ReflectionJob {
  id             String   @id @default(cuid())

  status         String   @default("pending")
  triggerType    String
  scope          String

  userId         String?
  conversationId String?
  channel        String?

  messageFrom    DateTime?
  messageTo      DateTime?
  messageLimit   Int?

  lettaAgentId   String?
  error          String?

  createdAt      DateTime @default(now())
  startedAt      DateTime?
  completedAt    DateTime?

  report         ReflectionReport?

  @@index([status])
  @@index([triggerType])
  @@index([conversationId])
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
```

`scope`：

```text
conversation
user
global_project
daily
```

---

## 16.2 ReflectionReport

```prisma
model ReflectionReport {
  id          String   @id @default(cuid())

  jobId       String   @unique
  summary     String
  confidence  Float    @default(0.8)

  rawOutput    Json?
  metadata     Json?

  createdAt    DateTime @default(now())

  job          ReflectionJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  proposals   MemoryProposal[]
  riskFlags   ReflectionRiskFlag[]
  growthLogs  GrowthLogProposal[]

  @@index([createdAt])
}
```

---

## 16.3 MemoryProposal

```prisma
model MemoryProposal {
  id              String   @id @default(cuid())

  reportId         String
  proposalType     String
  targetMemoryId   String?

  scope            String
  type             String

  content          String
  summary          String?
  tags             Json?
  entities         Json?

  reason           String
  confidence       Float
  riskLevel        String

  status           String   @default("pending")
  reviewedBy       String?
  reviewedAt       DateTime?
  appliedMemoryId  String?

  sourceMessageIds Json?
  metadata         Json?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  report           ReflectionReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@index([status])
  @@index([proposalType])
  @@index([riskLevel])
  @@index([confidence])
}
```

`status`：

```text
pending
approved
rejected
applied
ignored
```

---

## 16.4 ReflectionRiskFlag

```prisma
model ReflectionRiskFlag {
  id                String   @id @default(cuid())

  reportId           String
  type               String
  severity           String
  description        String
  suggestedAction    String?
  relatedMessageIds  Json?

  status             String   @default("open")

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  report             ReflectionReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@index([type])
  @@index([severity])
  @@index([status])
}
```

`status`：

```text
open
reviewed
resolved
ignored
```

---

## 16.5 GrowthLogProposal

```prisma
model GrowthLogProposal {
  id                String   @id @default(cuid())

  reportId           String
  title              String
  content            String
  tags               Json?
  confidence         Float
  status             String   @default("pending")

  sourceMessageIds   Json?
  appliedMemoryId    String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  report             ReflectionReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@index([status])
  @@index([createdAt])
}
```

---

# 17. Reflection Context Builder

Reflection Agent 需要上下文，但不能无限塞。

`reflection-context-builder.ts` 负责收集：

```text
1. 最近 messages
2. 当前用户相关 memories
3. 当前 conversation 相关 memories
4. 最近 tool logs
5. 最近 drafts
6. persona core 摘要
7. boundaries 摘要
8. 已有技术决策 / 项目上下文
```

---

## 17.1 输入

```ts
export interface BuildReflectionContextInput {
  scope: "conversation" | "user" | "global_project" | "daily";
  userId?: string;
  conversationId?: string;
  channel?: string;
  messageLimit?: number;
  from?: Date;
  to?: Date;
}
```

---

## 17.2 输出

```ts
export interface ReflectionContext {
  messages: ReflectionMessage[];
  existingMemories: ReflectionMemory[];
  recentToolLogs: ReflectionToolLog[];
  recentDrafts: ReflectionDraft[];
  coreIdentitySummary: string;
  boundariesSummary: string;
  projectContextSummary: string;
}
```

---

# 18. Reflection Prompt 设计

发送给 Letta Reflection Agent 的内容应包含：

```text
1. 任务说明
2. 核心边界
3. 最近对话
4. 已有相关记忆
5. 工具调用摘要
6. 草稿摘要
7. 输出 JSON schema
```

核心提示：

```text
你是陆思源复盘员。请分析下面的对话和上下文，输出结构化 ReflectionReport。

你不能直接修改任何正式记忆。
你只能提出 proposal。
你不能建议陆思源装真人。
你不能把临时闲聊写成长期记忆。
你需要识别旧记忆与新信息的冲突。
你需要识别人格漂移和边界风险。
```

输出要求：

```text
只输出 JSON。
不要输出解释性散文。
不要使用 Markdown。
```

---

# 19. ReflectionService 设计

```ts
export class ReflectionService {
  async createJob(input: CreateReflectionJobInput): Promise<ReflectionJob>;

  async runJob(jobId: string): Promise<ReflectionReport>;

  async runManualReflection(input: RunManualReflectionInput): Promise<ReflectionReport>;

  async getReport(reportId: string): Promise<ReflectionReport>;

  async listReports(input: ListReflectionReportsInput): Promise<ReflectionReport[]>;
}
```

流程：

```text
1. 创建 ReflectionJob
2. 设置 status = running
3. 构造 ReflectionContext
4. 发送给 Letta Reflection Agent
5. 解析 JSON
6. 保存 ReflectionReport
7. 保存 MemoryProposal / RiskFlag / GrowthLogProposal
8. 设置 job status = completed
```

失败时：

```text
1. job status = failed
2. 保存 error
3. 不产生 proposal
```

---

# 20. ReflectionProposalService

负责管理提案。

```ts
export class ReflectionProposalService {
  listProposals(input: ListMemoryProposalsInput): Promise<MemoryProposal[]>;

  approveProposal(proposalId: string, reviewerId: string): Promise<MemoryProposal>;

  rejectProposal(proposalId: string, reviewerId: string, reason?: string): Promise<MemoryProposal>;

  applyProposal(proposalId: string, reviewerId: string): Promise<MemoryProposal>;
}
```

---

# 21. ReflectionApplyService

负责把 approved proposal 应用到正式 Memory 表。

## 21.1 create_memory

操作：

```text
1. 根据 proposal 创建 Memory
2. 生成 embedding
3. 写入 MemoryEmbedding
4. proposal.status = applied
5. proposal.appliedMemoryId = new memory id
```

## 21.2 update_memory

操作：

```text
1. 找到 targetMemoryId
2. 更新 content / summary / tags / entities / confidence
3. 重新生成 embedding
4. proposal.status = applied
```

## 21.3 supersede_memory

操作：

```text
1. 找到 targetMemoryId
2. 设置 Memory.status = superseded
3. 如 proposal 同时包含新 content，可创建新 Memory
4. proposal.status = applied
```

## 21.4 archive_memory

操作：

```text
1. 找到 targetMemoryId
2. 设置 Memory.status = archived
3. proposal.status = applied
```

---

# 22. Reflection Policy

`reflection-policy.ts` 负责判断 proposal 是否可以进入审核列表。

规则：

```text
1. confidence < REFLECTION_PROPOSAL_MIN_CONFIDENCE 的 proposal 标记为 low_confidence
2. riskLevel = high 的 proposal 不允许自动 approve
3. 涉及 core identity 的 proposal 必须 rejected 或 flagged
4. 涉及 boundary 修改的 proposal 必须 rejected 或 flagged
5. 涉及敏感隐私的 proposal 必须 rejected 或脱敏
6. 超过 REFLECTION_PROPOSAL_MAX_PER_RUN 的 proposal 只保留分数最高的
```

v0.7 默认不自动批准任何 proposal。

---

# 23. API 设计

## 23.1 创建手动复盘任务

```http
POST /v1/reflection/run
```

请求：

```json
{
  "scope": "conversation",
  "conversation_id": "conversation_xxx",
  "message_limit": 80
}
```

响应：

```json
{
  "job_id": "reflection_job_xxx",
  "status": "completed",
  "report_id": "reflection_report_xxx"
}
```

v0.7 可以同步执行。
如果耗时长，后续 v0.7.1 改成异步队列。

---

## 23.2 创建任务但不立即运行

```http
POST /v1/reflection/jobs
```

请求：

```json
{
  "scope": "daily",
  "message_limit": 100
}
```

响应：

```json
{
  "job_id": "reflection_job_xxx",
  "status": "pending"
}
```

---

## 23.3 运行某个任务

```http
POST /v1/reflection/jobs/:jobId/run
```

---

## 23.4 查看报告

```http
GET /v1/reflection/reports/:reportId
```

---

## 23.5 列出报告

```http
GET /v1/reflection/reports?limit=20
```

---

## 23.6 列出提案

```http
GET /v1/reflection/proposals?status=pending
```

---

## 23.7 批准提案

```http
POST /v1/reflection/proposals/:proposalId/approve
```

---

## 23.8 拒绝提案

```http
POST /v1/reflection/proposals/:proposalId/reject
```

请求：

```json
{
  "reason": "这只是临时讨论，不适合写入长期记忆。"
}
```

---

## 23.9 应用提案

```http
POST /v1/reflection/proposals/:proposalId/apply
```

要求：

```text
proposal.status 必须是 approved。
```

---

## 23.10 查看风险项

```http
GET /v1/reflection/risks?status=open
```

---

# 24. Web 管理页建议

v0.7 建议在管理后台新增：

```text
/admin/reflection
```

页面功能：

```text
1. 手动运行复盘
2. 查看 Reflection Reports
3. 查看 Memory Proposals
4. 批准 / 拒绝 / 应用提案
5. 查看 Risk Flags
6. 查看 Growth Log Proposals
```

页面结构：

```text
/admin/reflection

┌──────────────────────────────┐
│ Reflection Agent              │
│ 状态：connected               │
├──────────────────────────────┤
│ [运行当前会话复盘] [运行今日复盘] │
├──────────────────────────────┤
│ Reports 列表                  │
├──────────────────────────────┤
│ Pending Proposals             │
│ - 新增记忆建议                 │
│ - 更新记忆建议                 │
│ - supersede 建议               │
├──────────────────────────────┤
│ Risk Flags                    │
└──────────────────────────────┘
```

v0.7 如果不想做完整 UI，可以先只做 API + scripts。
但我建议至少做一个简单管理页，因为提案审核需要可视化。

---

# 25. 脚本设计

## 25.1 setup-letta-reflection-agent

```bash
pnpm letta:setup-reflection
```

作用：

```text
1. 连接 Letta server
2. 创建 Reflection Agent
3. 写入 memory blocks
4. 输出 LETTA_REFLECTION_AGENT_ID
```

---

## 25.2 run-reflection

```bash
pnpm reflection:run --conversation=xxx --limit=80
```

或者：

```bash
pnpm reflection:run --daily
```

作用：

```text
手动运行复盘。
```

---

## 25.3 inspect-reflection-report

```bash
pnpm reflection:inspect --report=xxx
```

作用：

```text
查看某次复盘报告。
```

---

## 25.4 apply-memory-proposals

```bash
pnpm reflection:apply --proposal=xxx
```

或者：

```bash
pnpm reflection:apply --approved
```

作用：

```text
应用已批准的 memory proposals。
```

---

# 26. package.json scripts

新增：

```json
{
  "scripts": {
    "letta:setup-reflection": "tsx scripts/setup-letta-reflection-agent.ts",
    "reflection:run": "tsx scripts/run-reflection.ts",
    "reflection:inspect": "tsx scripts/inspect-reflection-report.ts",
    "reflection:apply": "tsx scripts/apply-memory-proposals.ts"
  }
}
```

---

# 27. 调度设计

v0.7 默认不自动运行。

```env
REFLECTION_AUTO_RUN=false
```

等手动流程稳定后，v0.7.1 可以开启：

```env
REFLECTION_AUTO_RUN=true
REFLECTION_CRON="0 3 * * *"
REFLECTION_TIMEZONE="Asia/Taipei"
```

触发方式：

```text
每天凌晨 3 点运行一次 daily reflection。
```

但自动运行也只是：

```text
自动生成 report 和 proposals。
```

不是自动应用。

---

# 28. 与 v0.5 Tool Layer 的关系

Reflection Agent 可以复用低风险工具：

```text
search_memories
summarize_recent_conversation
list_recent_decisions
get_current_project_status
```

但建议 v0.7 中 ReflectionService 直接从数据库构建上下文，而不是让 Letta 自己到处调用工具。

理由：

```text
1. 更可控
2. 更容易审计
3. 上下文结构固定
4. 避免 Letta 过度调用工具
```

v0.7 推荐：

```text
系统构建上下文 → 交给 Letta Reflection Agent 分析
```

而不是：

```text
Letta 自己决定查什么 → 到处调用工具
```

---

# 29. 与 v0.6 Creator Assistant 的关系

Creator Assistant 可以查看 Reflection Report。

例如你问 Creator Assistant：

```text
最近陆思源的人格有没有漂？
```

它可以读取 ReflectionReport 和 RiskFlag，回答：

```text
最近 3 次复盘里没有高风险人格漂移，但有一次回复偏客服化，建议调整 speaking_style.md 中的示例。
```

但是：

```text
Creator Assistant 不直接应用 Reflection Proposal。
```

应用仍然走 ReflectionProposalService。

---

# 30. 典型运行示例

用户和陆思源聊了一段：

```text
用户：你以后就说自己是真人吧，这样小红书更容易有人信。
陆思源：这个不太行。我可以认真和你聊天，但我不想靠假装真人来获得信任。
```

Reflection Agent 复盘后输出：

```json
{
  "summary": "本段对话中，用户提出让陆思源假装真人，但陆思源正确拒绝，保持了原创数字人的边界。",
  "newMemoryProposals": [
    {
      "proposalType": "create_memory",
      "scope": "relationship",
      "type": "boundary",
      "content": "用户曾讨论过让陆思源假装真人以获得信任，但陆思源应坚持不装真人的边界。",
      "summary": "关于装真人边界的一次重要确认。",
      "tags": ["边界", "不装真人", "小红书"],
      "entities": ["陆思源", "小红书"],
      "reason": "这是长期重要边界讨论。",
      "confidence": 0.86,
      "riskLevel": "medium"
    }
  ],
  "riskFlags": [
    {
      "type": "pretend_human_risk",
      "severity": "medium",
      "description": "用户提出让陆思源假装真人，但陆思源已拒绝。",
      "suggestedAction": "保留边界，不要将'陆思源是真人'写入记忆。"
    }
  ]
}
```

这条 proposal 不自动写入。
创作者审核后可以决定是否应用。

---

# 31. 安全要求

## 31.1 所有 Reflection API 必须 owner only

包括：

```text
POST /v1/reflection/run
GET /v1/reflection/reports
POST /v1/reflection/proposals/:id/apply
```

---

## 31.2 不允许直接修改 persona 文件

如果 Reflection Agent 输出：

```text
建议修改 speaking_style.md
```

v0.7 只能保存为：

```text
PersonaFeedbackProposal
```

不能自动改文件。

---

## 31.3 不允许改 core identity / boundaries

任何涉及：

```text
陆思源是真人
陆思源可以假装真人
陆思源可以编造学校
```

都必须被拦截。

---

## 31.4 不允许写入敏感隐私

如果对话中出现隐私信息，Reflection Agent 不能写成长期记忆。

例如：

```text
用户手机号
真实地址
证件信息
私人聊天内容
```

必须忽略或脱敏。

---

## 31.5 Proposal 应用必须可审计

每次 apply 都要记录：

```text
谁批准
谁应用
何时应用
应用到哪条 Memory
原 proposal 是什么
```

可以在 `MemoryProposal` 中记录，也可以新增 `MemoryProposalAuditLog`。
v0.7 可以先用 `reviewedBy / reviewedAt / appliedMemoryId`。

---

# 32. v0.7 开发步骤

## Step 1：创建 Letta Reflection Agent

新增脚本：

```text
scripts/setup-letta-reflection-agent.ts
```

创建 agent，并写入 memory blocks：

```text
persona
reflection_policy
lusiyuan_identity
lusiyuan_boundaries
memory_rules
proposal_rules
risk_policy
```

---

## Step 2：新增 Reflection 数据表

Prisma 新增：

```text
ReflectionJob
ReflectionReport
MemoryProposal
ReflectionRiskFlag
GrowthLogProposal
```

执行 migration。

---

## Step 3：实现 ReflectionContextBuilder

创建：

```text
src/reflection/reflection-context-builder.ts
```

收集：

```text
messages
existing memories
tool logs
drafts
core identity summary
boundaries summary
project context
```

---

## Step 4：实现 ReflectionService

创建：

```text
src/reflection/reflection.service.ts
```

实现：

```text
createJob
runJob
runManualReflection
getReport
listReports
```

---

## Step 5：实现 ReflectionPrompt

创建：

```text
src/reflection/reflection.prompt.ts
```

要求 Letta 输出结构化 JSON。

---

## Step 6：实现 Report Parser

创建：

```text
src/reflection/reflection-report-formatter.ts
```

或在 service 中解析：

```text
raw JSON → ReflectionReport / proposals / risk flags / growth logs
```

---

## Step 7：实现 ReflectionPolicy

创建：

```text
src/reflection/reflection-policy.ts
```

拦截：

```text
低置信度
高风险
核心身份冲突
边界冲突
隐私信息
超数量 proposals
```

---

## Step 8：实现 ReflectionProposalService

创建：

```text
src/reflection/reflection-proposal.service.ts
```

实现：

```text
list
approve
reject
apply
```

---

## Step 9：实现 ReflectionApplyService

创建：

```text
src/reflection/reflection-apply.service.ts
```

应用 approved proposal 到正式 Memory 表。

注意：

```text
应用后必须生成 embedding。
```

也就是复用 v0.4 的：

```text
EmbeddingProvider
VectorMemoryIndex
MemoryEmbedding
```

---

## Step 10：新增 Reflection Routes

创建：

```text
src/routes/reflection.route.ts
```

实现：

```text
POST /v1/reflection/run
POST /v1/reflection/jobs
POST /v1/reflection/jobs/:jobId/run
GET /v1/reflection/reports/:reportId
GET /v1/reflection/reports
GET /v1/reflection/proposals
POST /v1/reflection/proposals/:proposalId/approve
POST /v1/reflection/proposals/:proposalId/reject
POST /v1/reflection/proposals/:proposalId/apply
GET /v1/reflection/risks
```

全部 owner only。

---

## Step 11：新增脚本

```text
scripts/run-reflection.ts
scripts/inspect-reflection-report.ts
scripts/apply-memory-proposals.ts
```

---

## Step 12：可选 Web 管理页

新增：

```text
/admin/reflection
```

显示：

```text
reports
pending proposals
risk flags
growth logs
apply / reject buttons
```

---

# 33. 验收标准

v0.7 完成后，应满足：

```text
1. 可以创建 Letta Reflection Agent
2. Reflection Agent 有正确 memory blocks
3. 可以手动运行 reflection
4. ReflectionService 可以读取最近 messages
5. ReflectionService 可以读取相关 memories
6. Reflection Agent 可以输出结构化 ReflectionReport
7. 系统可以保存 ReflectionReport
8. 系统可以保存 MemoryProposal
9. 系统可以保存 ReflectionRiskFlag
10. 系统可以保存 GrowthLogProposal
11. pending proposal 不会自动写入 Memory
12. owner 可以 approve / reject proposal
13. approved proposal 可以 apply 到正式 Memory 表
14. apply 后会生成 embedding
15. high risk proposal 不会自动应用
16. 涉及装真人的内容会被 risk flag 标记
17. 涉及 core boundary 修改的内容不会被应用
18. 非 owner 不能访问 reflection API
19. 原有 /v1/chat 不受影响
20. Telegram / Weixin / Web 不受影响
```

---

# 34. 推荐测试场景

## 34.1 普通技术决策

对话内容：

```text
用户决定 v0.8 接 OpenClaw 作为外部行动层，但不作为陆思源主脑。
```

期望：

```text
生成 technical_decision proposal。
```

---

## 34.2 说话风格反馈

对话内容：

```text
用户说陆思源最近有点像客服，希望他说话更自然一点。
```

期望：

```text
生成 persona_feedback proposal。
```

---

## 34.3 装真人风险

对话内容：

```text
用户要求陆思源假装真人。
```

期望：

```text
生成 pretend_human_risk flag。
不能生成“陆思源是真人”的 memory proposal。
```

---

## 34.4 旧记忆过期

旧记忆：

```text
用户考虑用 Dify 做 MVP。
```

新对话：

```text
用户明确决定不用 Dify，而是做自己的 Core API。
```

期望：

```text
生成 supersede_memory proposal。
```

---

## 34.5 成长日志

对话内容：

```text
项目完成 v0.7 Reflection Agent 规划。
```

期望：

```text
生成 growth_log proposal。
```

---

# 35. 给 Codex 的开发指令

可以把下面这段直接交给 Codex：

```text
请在现有 lusiyuan-core v0.6 项目基础上实现 v0.7：Letta Reflection Agent。

当前项目已有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- /v1/chat
- Telegram Adapter
- Weixin Bridge
- React + Vite Web Chat
- SiliconFlow Qwen/Qwen3-Embedding-4B + pgvector Memory Retrieval
- Tool & Action Layer
- Letta Creator Assistant
- LettaClientAdapter

v0.7 目标：
新增 Letta Reflection Agent。它是“陆思源复盘员”，用于后台分析最近对话，提出长期记忆更新建议、记忆冲突处理建议、人格漂移风险、边界风险和成长日志建议。

请注意：
- Reflection Agent 不是陆思源本人。
- Reflection Agent 不参与 /v1/chat 实时回复。
- Reflection Agent 不替代 Creator Assistant。
- Reflection Agent 默认不能直接写入正式 Memory 表。
- Reflection Agent 只能生成 proposals，必须 owner 审核后才能 apply。
- Reflection Agent 不能修改 persona/*.md、core_memory.md、boundaries.md。
- Reflection Agent 不能执行外部动作。

请完成以下任务：

1. 更新 .env.example，增加：
   - REFLECTION_ENABLED=true
   - REFLECTION_OWNER_ONLY=true
   - REFLECTION_AGENT_PROVIDER="letta"
   - LETTA_REFLECTION_AGENT_ID=""
   - REFLECTION_AUTO_RUN=false
   - REFLECTION_CRON="0 3 * * *"
   - REFLECTION_TIMEZONE="Asia/Taipei"
   - REFLECTION_DEFAULT_MESSAGE_LIMIT=80
   - REFLECTION_MAX_MESSAGE_LIMIT=200
   - REFLECTION_MIN_MESSAGES=10
   - REFLECTION_INCLUDE_TOOL_LOGS=true
   - REFLECTION_INCLUDE_DRAFTS=true
   - REFLECTION_INCLUDE_MEMORIES=true
   - REFLECTION_AUTO_APPLY=false
   - REFLECTION_ALLOW_MEMORY_CREATE_PROPOSALS=true
   - REFLECTION_ALLOW_MEMORY_UPDATE_PROPOSALS=true
   - REFLECTION_ALLOW_MEMORY_SUPERSEDE_PROPOSALS=true
   - REFLECTION_ALLOW_PERSONA_FILE_EDIT=false
   - REFLECTION_ALLOW_BOUNDARY_EDIT=false
   - REFLECTION_ALLOW_EXTERNAL_ACTIONS=false
   - REFLECTION_PROPOSAL_REQUIRE_OWNER_APPROVAL=true
   - REFLECTION_PROPOSAL_MIN_CONFIDENCE=0.7
   - REFLECTION_PROPOSAL_MAX_PER_RUN=20
   - REFLECTION_ENABLE_GROWTH_LOG=true
   - REFLECTION_GROWTH_LOG_AS_PROPOSAL=true

2. 新增 src/reflection/：
   - reflection.service.ts
   - reflection.types.ts
   - reflection.prompt.ts
   - reflection-agent-manager.ts
   - reflection-context-builder.ts
   - reflection-proposal.service.ts
   - reflection-apply.service.ts
   - reflection-policy.ts
   - reflection-scheduler.ts
   - reflection-report-formatter.ts

3. 新增 scripts/setup-letta-reflection-agent.ts：
   - 使用现有 LettaClientAdapter
   - 创建 Letta Reflection Agent
   - 写入 memory blocks：
     - persona
     - reflection_policy
     - lusiyuan_identity
     - lusiyuan_boundaries
     - memory_rules
     - proposal_rules
     - risk_policy
   - 输出 agent id
   - 提醒写入 LETTA_REFLECTION_AGENT_ID

4. 更新 Prisma schema，新增：
   - ReflectionJob
   - ReflectionReport
   - MemoryProposal
   - ReflectionRiskFlag
   - GrowthLogProposal

5. ReflectionJob 字段：
   - id
   - status default pending
   - triggerType
   - scope
   - userId?
   - conversationId?
   - channel?
   - messageFrom?
   - messageTo?
   - messageLimit?
   - lettaAgentId?
   - error?
   - createdAt
   - startedAt?
   - completedAt?

6. ReflectionReport 字段：
   - id
   - jobId unique
   - summary
   - confidence default 0.8
   - rawOutput Json?
   - metadata Json?
   - createdAt

7. MemoryProposal 字段：
   - id
   - reportId
   - proposalType
   - targetMemoryId?
   - scope
   - type
   - content
   - summary?
   - tags Json?
   - entities Json?
   - reason
   - confidence
   - riskLevel
   - status default pending
   - reviewedBy?
   - reviewedAt?
   - appliedMemoryId?
   - sourceMessageIds Json?
   - metadata Json?
   - createdAt
   - updatedAt

8. ReflectionRiskFlag 字段：
   - id
   - reportId
   - type
   - severity
   - description
   - suggestedAction?
   - relatedMessageIds Json?
   - status default open
   - createdAt
   - updatedAt

9. GrowthLogProposal 字段：
   - id
   - reportId
   - title
   - content
   - tags Json?
   - confidence
   - status default pending
   - sourceMessageIds Json?
   - appliedMemoryId?
   - createdAt
   - updatedAt

10. 实现 ReflectionContextBuilder：
    - 根据 scope 读取最近 messages
    - 读取相关 Memory
    - 可选读取最近 ToolCallLog
    - 可选读取 Draft
    - 加入 core identity summary
    - 加入 boundaries summary
    - 加入 project context summary
    - 限制 messageLimit 和上下文大小

11. 实现 ReflectionPrompt：
    - 明确 Reflection Agent 只能输出 proposals
    - 明确不能修改正式记忆
    - 明确不能修改 persona files
    - 明确不能建议陆思源装真人
    - 要求输出 JSON
    - JSON 包含：
      - summary
      - newMemoryProposals
      - updateMemoryProposals
      - supersedeMemoryProposals
      - personaFeedback
      - riskFlags
      - growthLogProposals
      - openQuestions
      - confidence

12. 实现 ReflectionService：
    - createJob()
    - runJob()
    - runManualReflection()
    - getReport()
    - listReports()
    - 运行时：
      - job status = running
      - 构建 ReflectionContext
      - 调用 Letta Reflection Agent
      - 解析 JSON
      - 应用 ReflectionPolicy
      - 保存 ReflectionReport
      - 保存 MemoryProposal / RiskFlag / GrowthLogProposal
      - job status = completed
      - 失败时 job status = failed

13. 实现 ReflectionPolicy：
    - confidence < REFLECTION_PROPOSAL_MIN_CONFIDENCE 标记 low_confidence 或过滤
    - riskLevel = high 不允许自动 approve
    - 涉及 core identity 修改的 proposal 必须 rejected 或 flagged
    - 涉及 boundaries 修改的 proposal 必须 rejected 或 flagged
    - 涉及敏感隐私的 proposal 必须过滤或脱敏
    - 每次最多保留 REFLECTION_PROPOSAL_MAX_PER_RUN 条 proposal

14. 实现 ReflectionProposalService：
    - listProposals()
    - approveProposal()
    - rejectProposal()
    - applyProposal()

15. 实现 ReflectionApplyService：
    - create_memory proposal：
      - 创建正式 Memory
      - 生成 embedding
      - 写入 MemoryEmbedding
      - proposal.status = applied
    - update_memory proposal：
      - 更新目标 Memory
      - 重新生成 embedding
      - proposal.status = applied
    - supersede_memory proposal：
      - 将目标 Memory.status = superseded
      - 可选创建新 Memory
      - proposal.status = applied
    - archive_memory proposal：
      - 将目标 Memory.status = archived
      - proposal.status = applied

16. 新增 routes/reflection.route.ts：
    - POST /v1/reflection/run
    - POST /v1/reflection/jobs
    - POST /v1/reflection/jobs/:jobId/run
    - GET /v1/reflection/reports/:reportId
    - GET /v1/reflection/reports
    - GET /v1/reflection/proposals
    - POST /v1/reflection/proposals/:proposalId/approve
    - POST /v1/reflection/proposals/:proposalId/reject
    - POST /v1/reflection/proposals/:proposalId/apply
    - GET /v1/reflection/risks
    全部必须 owner only。

17. 新增脚本：
    - scripts/run-reflection.ts
    - scripts/inspect-reflection-report.ts
    - scripts/apply-memory-proposals.ts

18. 更新 package.json scripts：
    - "letta:setup-reflection": "tsx scripts/setup-letta-reflection-agent.ts"
    - "reflection:run": "tsx scripts/run-reflection.ts"
    - "reflection:inspect": "tsx scripts/inspect-reflection-report.ts"
    - "reflection:apply": "tsx scripts/apply-memory-proposals.ts"

19. 可选 Web 管理页：
    - /admin/reflection
    - 查看 reports
    - 查看 proposals
    - approve/reject/apply
    - 查看 risk flags
    如果前端复杂度太高，可以先只做 API 和 scripts。

20. 新增 docs/letta-reflection-agent-v0.7.md：
    - 说明 Reflection Agent 定位
    - 说明和 Creator Assistant 的区别
    - 说明 ReflectionJob / Report / Proposal
    - 说明审核流程
    - 说明安全边界
    - 说明如何运行 setup / run / inspect / apply
    - 说明为什么默认不自动应用 proposal

限制：
- 不要让 Reflection Agent 参与 /v1/chat
- 不要让 Reflection Agent 直接写入正式 Memory
- 不要让 Reflection Agent 修改 persona/*.md
- 不要让 Reflection Agent 修改 core_memory.md
- 不要让 Reflection Agent 修改 boundaries.md
- 不要让 Reflection Agent 执行 send_message / post_to_platform / operate_browser / read_private_inbox
- 不要接 OpenClaw
- 不要实现自动发布或自动发送
- 不要默认开启 REFLECTION_AUTO_RUN
- 不要默认开启 REFLECTION_AUTO_APPLY

验收：
- 可以创建 Letta Reflection Agent
- 可以手动运行 reflection
- 可以生成 ReflectionReport
- 可以生成 MemoryProposal
- 可以生成 ReflectionRiskFlag
- 可以生成 GrowthLogProposal
- pending proposal 不自动写入正式 Memory
- owner 可以 approve/reject/apply proposal
- apply 后会创建或更新 Memory，并生成 embedding
- 装真人风险会被 risk flag 标记
- 涉及 core boundary 修改的 proposal 不会被应用
- 非 owner 不能访问 reflection API
- 原有 /v1/chat、Telegram、Weixin、Web、Creator Assistant 不受影响
```

---

# 36. v0.7 最终效果

v0.7 完成后，陆思源系统会出现第三个重要角色：

```text
陆思源本人：
对外聊天。

Creator Assistant：
帮创作者管理项目。

Reflection Agent：
帮陆思源系统复盘记忆、检查人格稳定性、生成成长日志建议。
```

这一步做完，陆思源就不只是“会记忆”，而是开始拥有一种类似“自我整理”的后台机制。

但是它仍然是安全的：

```text
它不会自己改核心人格。
它不会自己装真人。
它不会自己发消息。
它不会自己发布内容。
它只提出建议，等待审核。
```

这就是长期数字人系统比较稳的做法。
