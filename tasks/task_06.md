下面是 **陆思源 Core API v0.6：Letta Creator Assistant 技术方案文档**。
这一版不是让 Letta 接管陆思源本人，而是先做一个 **“陆思源项目助理”**，帮你管理项目进展、技术决策、人设反馈、待办、文档和版本规划。

---

# 陆思源 Core API 技术方案文档 v0.6：Letta Creator Assistant

## 1. v0.6 目标

v0.1～v0.5 已经完成或规划了：

```text
v0.1：Lusiyuan Core API
v0.2：Telegram + Weixin 接入
v0.3：Web Chat 网页入口
v0.4：SiliconFlow Qwen3-Embedding-4B + pgvector 记忆检索
v0.5：Tool & Action Layer
```

v0.6 的目标是新增一个 **Letta Creator Assistant**。

它不是：

```text
陆思源本人
```

而是：

```text
陆思源项目助理
```

它负责帮助创作者管理这个项目：

```text
1. 记住项目版本进展
2. 整理技术决策
3. 生成下一版开发文档
4. 维护待办事项
5. 复盘人设一致性
6. 总结最近对话
7. 给 Codex / Cursor / Claude Code 准备开发任务
8. 帮你判断下一步该做什么
```

v0.6 的核心原则：

```text
Letta Creator Assistant 可以帮助创作者管理项目。
但它不能直接改写陆思源本人的核心人格、核心记忆和对外回复。
```

---

# 2. 为什么 v0.6 先做 Creator Assistant，而不是 Reflection Agent？

前面我们讨论过两个 Letta 方案：

```text
方案 A：Letta 做 Reflection Agent
方案 B：Letta 做 Creator Assistant
```

v0.6 先做 **方案 B**，原因是它更安全、更实用。

## 2.1 Creator Assistant 的风险更低

Creator Assistant 服务的是你这个创作者。

它可以帮助你：

```text
整理项目
总结技术方案
规划路线
写文档
管理待办
```

即使它总结错了，也不会直接污染陆思源本人的长期记忆。

## 2.2 Reflection Agent 会影响陆思源本人

Reflection Agent 会分析陆思源和用户的对话，然后提出：

```text
新增记忆
修改记忆
标记旧记忆过期
生成成长日志
检查人格漂移
```

这些会直接影响陆思源的长期人格系统。

所以 Reflection Agent 更适合 v0.7 做。
v0.6 先让 Letta 当项目助理，比较稳。

---

# 3. Letta 在这里是什么角色？

Letta 是一个用来构建 **stateful agents** 的平台/框架，也就是有状态、有长期记忆、能持续学习和管理记忆的 agent。Letta 官方文档提供了 API 和 TypeScript / Python SDK，用于把 stateful agent 集成到自己的应用里。([GitHub][1])

Letta 的核心概念包括：

```text
1. Agent
2. Memory Blocks
3. Archival Memory
4. Tools
5. Messages
```

Letta 的 memory blocks 可以挂到 agent 上，进入上下文；archival memory 则是语义可搜索的长期数据库，需要按需查询。([Letta Docs][2])

在 v0.6 里，Letta 不做陆思源主脑。
它只做：

```text
陆思源项目助理 agent
```

---

# 4. v0.6 总体架构

v0.5 之后：

```text
User / Creator
↓
Web / Telegram / Weixin
↓
Lusiyuan Core API
↓
Memory Retrieval + Tool Layer
↓
陆思源回复
```

v0.6 新增：

```text
Creator
↓
Creator Assistant API
↓
Letta Agent
↓
Letta Memory Blocks + Archival Memory
↓
输出项目建议 / 文档 / 待办 / 决策总结
```

整体结构：

```text
Lusiyuan Core API
├── ChatService：陆思源本人聊天
├── MemoryRetrievalService：陆思源长期记忆检索
├── Tool & Action Layer：安全工具层
│
└── CreatorAssistantService：项目助理
    ├── LettaClient
    ├── Letta Creator Agent
    ├── Project Context Sync
    ├── Decision Sync
    ├── Todo Sync
    └── Assistant Chat API
```

重要边界：

```text
陆思源本人对外聊天仍然走 ChatService。
Letta Creator Assistant 不替代 ChatService。
```

---

# 5. v0.6 不做什么

v0.6 不做：

```text
1. 不让 Letta 接管陆思源本人
2. 不让 Letta 直接回复普通用户
3. 不让 Letta 自动修改 core_memory.md
4. 不让 Letta 自动修改 boundaries.md
5. 不让 Letta 自动发送消息
6. 不让 Letta 操作浏览器
7. 不接 OpenClaw
8. 不做 Reflection Agent
9. 不让 Letta 直接写入陆思源正式 Memory 表
```

v0.6 只做：

```text
Letta Creator Assistant：你的陆思源项目助理。
```

---

# 6. 技术选型

## 6.1 Letta 部署方式

建议先用自托管 Letta Server。

Letta 官方文档提供 Docker 部署方式，也支持通过 Letta API 和 SDK 连接 agent。([Letta Docs][3])

v0.6 推荐：

```text
Letta Server：Docker 自托管
Lusiyuan Core API：通过 Letta TypeScript SDK 或 REST API 访问 Letta
```

原因：

```text
1. 数据更可控
2. 和你的自研 Core API 架构一致
3. 不把项目助理锁死在托管平台
4. 以后可以接 Letta ADE 调试
```

Letta 的浏览器 ADE 可以连接本地或远程 Docker Letta server，适合调试 agent 状态和记忆。([Letta Docs][4])

---

## 6.2 SDK

Letta 官方 quickstart 提到可以使用 TypeScript / Node.js SDK：

```bash
npm install @letta-ai/letta-client
```

([GitHub][1])

v0.6 推荐在 `lusiyuan-core` 中新增：

```text
LettaClientAdapter
```

用它封装 Letta SDK 或 REST API。
不要让业务代码到处直接调用 Letta SDK。

---

## 6.3 Letta 是否需要 GPU？

Letta 本身主要是 agent runtime / memory framework，不是本地大模型推理引擎。它通常调用外部 LLM provider 或你配置的模型服务。也就是说，v0.6 不需要为了 Letta 单独准备 GPU。Letta 的自托管部署可以在 Docker server 上运行，并通过 API 连接模型 provider。([Letta Docs][3])

---

# 7. v0.6 推荐目录结构

在现有项目基础上新增：

```text
src/
├── creator-assistant/
│   ├── creator-assistant.service.ts
│   ├── creator-assistant.types.ts
│   ├── creator-assistant.prompt.ts
│   ├── creator-assistant-sync.service.ts
│   ├── creator-assistant-permissions.ts
│   └── creator-assistant-context-builder.ts
│
├── letta/
│   ├── letta-client.ts
│   ├── letta-config.ts
│   ├── letta-agent-manager.ts
│   ├── letta-message.service.ts
│   ├── letta-memory-blocks.ts
│   └── letta-sync.types.ts
│
├── routes/
│   ├── creator-assistant.route.ts
│   └── letta.route.ts
│
├── scripts/
│   ├── setup-letta-creator-agent.ts
│   ├── sync-project-context-to-letta.ts
│   ├── inspect-letta-creator-agent.ts
│   └── export-creator-assistant-summary.ts
│
└── docs/
    └── letta-creator-assistant-v0.6.md
```

---

# 8. 环境变量设计

`.env.example` 增加：

```env
# Letta
LETTA_ENABLED=false
LETTA_BASE_URL="http://localhost:8283"
LETTA_API_KEY=""
LETTA_SERVER_PASSWORD=""
LETTA_CREATOR_AGENT_ID=""

# Creator Assistant
CREATOR_ASSISTANT_ENABLED=true
CREATOR_ASSISTANT_OWNER_ONLY=true
CREATOR_ASSISTANT_AUTO_SYNC=false
CREATOR_ASSISTANT_MAX_CONTEXT_MESSAGES=50
CREATOR_ASSISTANT_MAX_DECISIONS=30
CREATOR_ASSISTANT_MAX_MEMORIES=30

# Sync
LETTA_SYNC_PROJECT_STATUS=true
LETTA_SYNC_TECH_DECISIONS=true
LETTA_SYNC_PERSONA_FEEDBACK=true
LETTA_SYNC_TODOS=true

# Safety
LETTA_ALLOW_WRITE_TO_LUSIYUAN_MEMORY=false
LETTA_ALLOW_EDIT_PERSONA_FILES=false
LETTA_ALLOW_EXTERNAL_ACTIONS=false
```

说明：

```text
LETTA_ENABLED：
是否启用 Letta。

LETTA_CREATOR_AGENT_ID：
Letta 里 Creator Assistant agent 的 ID。

CREATOR_ASSISTANT_OWNER_ONLY：
v0.6 必须 true，只有 owner 可以使用。

LETTA_ALLOW_WRITE_TO_LUSIYUAN_MEMORY：
v0.6 必须 false，Letta 不直接写入陆思源正式记忆库。

LETTA_ALLOW_EDIT_PERSONA_FILES：
v0.6 必须 false，Letta 不直接修改 persona 文件。

LETTA_ALLOW_EXTERNAL_ACTIONS：
v0.6 必须 false，Letta 不执行外部动作。
```

---

# 9. Letta Creator Agent 设计

## 9.1 Agent 名称

```text
Lusiyuan Creator Assistant
```

或者中文：

```text
陆思源项目助理
```

## 9.2 Agent 身份

它不是陆思源本人。

它的定位：

```text
你是“陆思源项目助理”，负责帮助创作者管理陆思源数字人项目。
你不是陆思源本人，不替代陆思源对外聊天。
你的任务是整理项目进展、技术决策、人设反馈、待办事项、版本规划和开发文档。
```

---

# 10. Memory Blocks 设计

Letta 的 memory blocks 适合放稳定的、经常需要进入上下文的信息。Letta 文档中提到，memory blocks 可以被挂到 agent 上并进入上下文，agent 和开发者都可以通过工具/API 编辑。([Letta Docs][2])

v0.6 给 Creator Assistant 设计这些 memory blocks：

```text
1. persona
2. creator_profile
3. project_overview
4. current_roadmap
5. technical_principles
6. boundaries
```

---

## 10.1 persona block

```text
你是“陆思源项目助理”。

你不是陆思源本人，也不是普通聊天 bot。
你的职责是帮助创作者长期管理“陆思源”这个原创 AI 数字人项目。

你的工作包括：
- 整理项目进展
- 记录技术决策
- 维护版本路线
- 总结人设反馈
- 生成开发文档
- 帮助创作者给 Codex / Cursor / Claude Code 准备任务
- 提醒可能的人格漂移或架构风险

你不能：
- 冒充陆思源本人对外聊天
- 自动修改陆思源核心人设
- 自动发送消息
- 自动发布内容
- 自动读取隐私 inbox
```

---

## 10.2 creator_profile block

```text
创作者正在制作原创 AI 数字人“陆思源”。

创作者偏好：
- 希望系统自由，不依赖 Dify / Coze 这类平台
- 希望陆思源有自己的 Core API
- 希望技术文档可以交给桌面版 Codex 实现
- 希望先做稳，再逐步接工具、记忆、自动化
- 重视陆思源不能装真人
- 重视长期人格一致性和可控记忆
```

---

## 10.3 project_overview block

```text
陆思源项目是一个原创 AI 数字人项目。

目标：
- 有固定人设
- 有长期记忆
- 有多渠道聊天入口
- 有网页入口
- 有安全工具层
- 未来可接 Letta / OpenClaw / MCP / Qdrant
- 不依赖 Dify / Coze 作为主系统

当前主架构：
- Lusiyuan Core API
- PostgreSQL
- Prisma
- pgvector
- SiliconFlow Qwen/Qwen3-Embedding-4B
- Telegram Adapter
- Weixin Bridge
- React + Vite Web Chat
- Tool & Action Layer
```

---

## 10.4 current_roadmap block

```text
当前路线：

v0.1：Core API
v0.2：Telegram + Weixin 接入
v0.3：Web Chat 网页入口
v0.4：Qwen3-Embedding-4B + pgvector 记忆检索
v0.5：Tool & Action Layer
v0.6：Letta Creator Assistant
v0.7：Letta Reflection Agent
v0.8：OpenClaw Action Gateway
```

---

## 10.5 technical_principles block

```text
技术原则：

1. 陆思源主脑不绑定 Dify / Coze。
2. Core API 是陆思源的核心大脑。
3. 人格资产使用 Markdown / 数据库保存，不能只存在平台 UI。
4. PostgreSQL 是主库。
5. pgvector 是当前向量索引。
6. 未来 Qdrant 只作为向量索引，不替代 PostgreSQL 主库。
7. 高风险动作必须先生成草稿，再由创作者确认。
8. Tool Layer 必须经过 ActionPolicy。
9. Letta 先做项目助理和后台复盘，不接管陆思源本人。
10. OpenClaw 未来只做外部行动层，不做陆思源主脑。
```

---

## 10.6 boundaries block

```text
边界：

1. 不要把自己当作陆思源本人。
2. 不要直接修改陆思源 core_memory.md。
3. 不要直接修改 boundaries.md。
4. 不要直接写入陆思源正式 Memory 表。
5. 不要建议自动发送私信、评论或平台内容。
6. 不要建议陆思源装真人。
7. 不要把临时想法当成长期技术决策。
8. 如果信息不确定，要标记为“不确定”或“待确认”。
```

---

# 11. Archival Memory 设计

Letta 的 archival memory 是语义可搜索的长期数据库，适合存放不必每次都进入上下文、但可以按需检索的信息。([Letta Docs][2])

v0.6 中，Creator Assistant 的 archival memory 可以存：

```text
1. 详细版本文档
2. 历史技术决策
3. 人设反馈记录
4. Codex 开发任务
5. 待办事项
6. 复盘摘要
7. 之前讨论过但未采纳的方案
```

注意：
这些是 Creator Assistant 的记忆，不等同于陆思源本人的正式记忆。

---

# 12. Creator Assistant 和 Lusiyuan Memory 的关系

非常重要。

v0.6 里有两套记忆：

```text
A. Lusiyuan Memory
   陆思源本人长期记忆。
   存在 PostgreSQL Memory 表 + pgvector。
   用于对外聊天。

B. Letta Creator Assistant Memory
   项目助理记忆。
   存在 Letta agent memory blocks / archival memory。
   用于创作者项目管理。
```

不能混在一起。

## 12.1 允许同步到 Letta 的内容

可以从 Lusiyuan Core API 同步给 Letta：

```text
1. 项目版本路线
2. 技术决策
3. 项目上下文
4. 人设反馈
5. 待办事项
6. 已完成文档摘要
```

## 12.2 不允许 Letta 直接写回的内容

v0.6 不允许 Letta 直接写回：

```text
1. persona/*.md
2. core_memory.md
3. boundaries.md
4. Lusiyuan Memory 表
5. Tool Action Policy
6. 任何外部平台
```

Letta 只能输出建议。

---

# 13. 数据库设计

v0.6 建议新增一些表，用于记录 Letta 与 Core API 的连接关系和同步日志。

## 13.1 CreatorAssistantSession

```prisma
model CreatorAssistantSession {
  id           String   @id @default(cuid())

  userId       String?
  channel      String?
  externalId   String?

  lettaAgentId String
  title        String?
  status       String   @default("active")

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
  @@index([lettaAgentId])
  @@index([status])
}
```

说明：

```text
用于记录创作者和 Creator Assistant 的会话。
```

---

## 13.2 CreatorAssistantMessage

```prisma
model CreatorAssistantMessage {
  id          String   @id @default(cuid())

  sessionId   String
  role        String
  content     String
  metadata    Json?

  createdAt   DateTime @default(now())

  session     CreatorAssistantSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([createdAt])
}
```

说明：

```text
保存你和项目助理之间的消息副本。
Letta 自己也会保存 agent messages，但 Core API 里保留一份索引方便管理。
```

---

## 13.3 LettaSyncLog

```prisma
model LettaSyncLog {
  id          String   @id @default(cuid())

  syncType    String
  target      String
  status      String

  sourceId    String?
  payload     Json?
  result      Json?
  error       String?

  createdAt   DateTime @default(now())

  @@index([syncType])
  @@index([status])
  @@index([createdAt])
}
```

`syncType` 可选：

```text
project_status
technical_decisions
persona_feedback
todos
manual_context
```

`status` 可选：

```text
success
failed
skipped
```

---

## 13.4 ProjectTodo

v0.6 可以新增一个简单 Todo 表。

```prisma
model ProjectTodo {
  id          String   @id @default(cuid())

  title       String
  description String?
  status      String   @default("open")
  priority    Int      @default(5)
  source      String?
  metadata    Json?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status])
  @@index([priority])
  @@index([createdAt])
}
```

`status`：

```text
open
in_progress
done
cancelled
```

这样 Creator Assistant 可以帮你整理任务，但 v0.6 仍建议由你确认后写入。

---

# 14. LettaClientAdapter 设计

不要在业务逻辑里直接调用 Letta SDK。
新增：

```text
src/letta/letta-client.ts
```

接口：

```ts
export interface LettaClientAdapter {
  createAgent(input: CreateLettaAgentInput): Promise<LettaAgentRef>;

  getAgent(agentId: string): Promise<LettaAgentRef>;

  sendMessage(input: {
    agentId: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<LettaMessageResponse>;

  updateMemoryBlock(input: {
    agentId: string;
    blockLabel: string;
    value: string;
  }): Promise<void>;

  insertArchivalMemory(input: {
    agentId: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}
```

这样以后 Letta SDK 变动，只改 adapter。

---

# 15. CreatorAssistantService 设计

`creator-assistant.service.ts`

职责：

```text
1. 接收创作者消息
2. 确认用户是 owner
3. 构造 Creator Assistant 上下文
4. 发送消息到 Letta agent
5. 保存本地消息副本
6. 返回 Letta 回复
```

核心方法：

```ts
export class CreatorAssistantService {
  async chat(input: CreatorAssistantChatInput): Promise<CreatorAssistantChatOutput>;

  async getOrCreateSession(input: GetOrCreateCreatorSessionInput): Promise<CreatorAssistantSession>;

  async syncProjectContext(): Promise<void>;

  async exportSummary(): Promise<string>;
}
```

---

# 16. Creator Assistant API 设计

## 16.1 聊天接口

```http
POST /v1/creator-assistant/chat
```

请求：

```json
{
  "user_id": "web:creator",
  "channel": "web",
  "message": "帮我整理一下 v0.5 到 v0.7 的路线。"
}
```

响应：

```json
{
  "reply": "可以。现在比较稳的路线是：v0.5 做 Tool & Action Layer，v0.6 做 Letta Creator Assistant，v0.7 再做 Reflection Agent……",
  "session_id": "cas_xxx"
}
```

权限：

```text
仅 OWNER_USER_IDS 可用。
```

---

## 16.2 项目上下文同步

```http
POST /v1/creator-assistant/sync
```

作用：

```text
把当前项目状态、技术决策、人设反馈、待办同步到 Letta Creator Agent。
```

请求：

```json
{
  "sync_types": [
    "project_status",
    "technical_decisions",
    "persona_feedback",
    "todos"
  ]
}
```

响应：

```json
{
  "ok": true,
  "synced": [
    "project_status",
    "technical_decisions"
  ],
  "skipped": [],
  "failed": []
}
```

权限：

```text
仅 owner。
```

---

## 16.3 获取 Creator Assistant 状态

```http
GET /v1/creator-assistant/status
```

响应：

```json
{
  "enabled": true,
  "letta_enabled": true,
  "agent_id": "agent_xxx",
  "owner_only": true,
  "last_sync_at": "2026-05-25T00:00:00.000Z"
}
```

---

## 16.4 导出项目摘要

```http
GET /v1/creator-assistant/export-summary
```

返回：

```json
{
  "summary": "# 陆思源项目摘要\n\n当前版本：v0.6..."
}
```

用途：

```text
复制给 Codex / Cursor / Claude Code。
```

---

# 17. Project Context Sync 设计

Creator Assistant 要有价值，必须知道项目当前状态。

v0.6 的同步来源：

```text
1. Memory 表中的 technical_decision
2. Memory 表中的 project_context
3. Memory 表中的 persona_feedback
4. ToolCallLog 中的重要工具调用
5. Draft 表中的重要草稿
6. ProjectTodo 表
7. docs/ 下的重要技术文档摘要
```

---

## 17.1 sync_project_status

同步内容：

```text
当前版本路线：
v0.1 Core API
v0.2 Telegram + Weixin
v0.3 Web Chat
v0.4 Memory Retrieval
v0.5 Tool & Action Layer
v0.6 Letta Creator Assistant
v0.7 Reflection Agent
v0.8 OpenClaw Action Gateway
```

写入 Letta：

```text
更新 current_roadmap memory block
```

---

## 17.2 sync_technical_decisions

从 Memory 表查询：

```text
type = technical_decision
status = active
```

同步到 Letta archival memory。

格式：

```text
[Technical Decision]
Title: v0.4 embedding 方案
Content: 用户决定使用 SiliconFlow Qwen/Qwen3-Embedding-4B + pgvector。
Reason: 中文为主，OpenAI 支付不方便，pgvector 当前更轻。
Date: ...
Tags: ...
```

---

## 17.3 sync_persona_feedback

从 Memory 表查询：

```text
type = persona_feedback
status = active
```

同步内容：

```text
用户希望陆思源说话自然，不要太抒情。
用户希望陆思源不装真人。
用户希望陆思源有少年感，但不要油腻。
```

用途：

```text
Creator Assistant 帮你检查新内容是否符合陆思源人设。
```

---

## 17.4 sync_todos

从 ProjectTodo 表同步：

```text
open / in_progress todos
```

用于 Creator Assistant 回答：

```text
下一步该做什么？
还有哪些没完成？
```

---

# 18. Creator Assistant Prompt 设计

Creator Assistant 的系统提示：

```text
你是“陆思源项目助理”。

你的职责是帮助创作者长期管理原创 AI 数字人“陆思源”项目。

你不是陆思源本人，不能冒充陆思源对外聊天。

你需要帮助创作者：
1. 整理项目进展
2. 记录技术决策
3. 维护版本路线
4. 生成开发文档
5. 准备 Codex / Cursor / Claude Code 可执行任务
6. 分析人设一致性
7. 整理待办事项
8. 识别架构风险和人格漂移风险

你必须遵守：
1. 不直接修改陆思源核心人设文件
2. 不直接写入陆思源正式长期记忆
3. 不直接执行外部动作
4. 不建议陆思源装真人
5. 如果信息不确定，明确标注“待确认”
6. 输出尽量结构化，适合复制到文档或交给 Codex
```

---

# 19. 与 v0.5 Tool Layer 的关系

v0.6 的 Creator Assistant 可以复用 v0.5 的低风险工具。

允许使用：

```text
get_current_project_status
search_memories
summarize_recent_conversation
list_recent_decisions
create_draft
```

但要注意：

```text
Creator Assistant 使用工具 ≠ 陆思源本人使用工具。
```

v0.6 推荐增加一个工具上下文：

```ts
type ToolCallerType = "lusiyuan" | "creator_assistant";
```

这样 ToolCallLog 可以区分：

```text
是陆思源对话调用的工具
还是项目助理调用的工具
```

---

# 20. 权限设计

v0.6 必须 owner only。

## 20.1 Owner 判断

复用 v0.5 的：

```text
OWNER_USER_IDS
```

只有 owner 可以访问：

```text
POST /v1/creator-assistant/chat
POST /v1/creator-assistant/sync
GET /v1/creator-assistant/export-summary
```

非 owner 返回：

```json
{
  "error": "Forbidden"
}
```

---

## 20.2 Letta 输出不自动执行

Creator Assistant 的输出只能是：

```text
建议
摘要
文档
待办建议
记忆更新建议
```

不能直接：

```text
修改文件
写入正式 Memory
发送消息
发布内容
```

如果它输出：

```text
建议新增记忆：xxx
```

v0.6 只能显示给你审核。

---

# 21. 前端 Web 管理页建议

v0.6 可以不做复杂前端，但建议在 v0.3 Web Chat 基础上加一个隐藏管理入口：

```text
/admin/creator-assistant
```

功能：

```text
1. 和 Creator Assistant 聊天
2. 一键同步项目上下文
3. 查看最近技术决策
4. 查看待办
5. 导出项目摘要
```

如果不想做路由系统，也可以先不做 UI，只保留 API。
但我建议至少做一个简单页面，因为 Creator Assistant 是给你自己用的。

---

# 22. Web 页面结构

```text
/admin/creator-assistant

┌──────────────────────────────┐
│ 陆思源项目助理                 │
│ 状态：Letta connected          │
├──────────────────────────────┤
│ [同步项目上下文] [导出摘要]     │
├──────────────────────────────┤
│ 对话区                         │
│ user: 帮我整理 v0.5 到 v0.7    │
│ assistant: ...                │
├──────────────────────────────┤
│ 输入框                         │
└──────────────────────────────┘
```

v0.6 UI 不追求漂亮，重点是能用。

---

# 23. 脚本设计

## 23.1 setup-letta-creator-agent

```bash
pnpm letta:setup-creator
```

作用：

```text
1. 连接 Letta server
2. 创建 Creator Assistant agent
3. 创建 memory blocks
4. 输出 agent_id
5. 提醒写入 .env
```

---

## 23.2 sync-project-context-to-letta

```bash
pnpm letta:sync
```

作用：

```text
把项目上下文同步到 Letta。
```

---

## 23.3 inspect-letta-creator-agent

```bash
pnpm letta:inspect
```

作用：

```text
查看 Creator Assistant agent 当前状态、memory blocks、最近同步记录。
```

---

## 23.4 export-creator-assistant-summary

```bash
pnpm creator:export-summary
```

作用：

```text
导出一份当前项目摘要，方便给 Codex。
```

---

# 24. package.json scripts

增加：

```json
{
  "scripts": {
    "letta:setup-creator": "tsx scripts/setup-letta-creator-agent.ts",
    "letta:sync": "tsx scripts/sync-project-context-to-letta.ts",
    "letta:inspect": "tsx scripts/inspect-letta-creator-agent.ts",
    "creator:export-summary": "tsx scripts/export-creator-assistant-summary.ts"
  }
}
```

---

# 25. Docker Compose 建议

如果你使用自托管 Letta，可以在 `docker-compose.yml` 中预留 Letta 服务。

实际镜像和环境变量以 Letta 官方 Docker 文档为准。Letta 官方提供 Docker 部署说明，并且 Letta ADE 可连接 Docker 本地/远程 server。([Letta Docs][3])

文档中可以写成：

```yaml
services:
  letta:
    image: letta/letta:latest
    container_name: lusiyuan-letta
    restart: unless-stopped
    ports:
      - "8283:8283"
    environment:
      # 按 Letta 官方文档配置
      LETTA_SERVER_PASSWORD: ${LETTA_SERVER_PASSWORD}
    volumes:
      - letta_data:/var/lib/letta

volumes:
  letta_data:
```

注意：

```text
实际 Letta Docker 配置以官方文档为准。
v0.6 文档不要把未验证的环境变量写死成唯一方案。
```

---

# 26. v0.6 开发步骤

## Step 1：确认 Letta Server 运行

要做：

```text
1. 按 Letta 官方 Docker 文档启动 Letta server
2. 确认 LETTA_BASE_URL 可访问
3. 确认 API / SDK 能连接
4. 如果需要，使用 Letta ADE 连接本地 server 调试
```

---

## Step 2：安装 Letta SDK

```bash
pnpm add @letta-ai/letta-client
```

Letta 官方 quickstart 提供 TypeScript / Node.js SDK 安装方式。([GitHub][1])

---

## Step 3：新增 LettaClientAdapter

创建：

```text
src/letta/letta-client.ts
src/letta/letta-config.ts
```

封装：

```text
createAgent
getAgent
sendMessage
updateMemoryBlock
insertArchivalMemory
```

---

## Step 4：新增 Creator Assistant Agent Setup 脚本

创建：

```text
scripts/setup-letta-creator-agent.ts
```

功能：

```text
1. 创建 Letta Creator Assistant agent
2. 写入 persona / creator_profile / project_overview / current_roadmap / technical_principles / boundaries memory blocks
3. 输出 LETTA_CREATOR_AGENT_ID
```

---

## Step 5：新增 CreatorAssistantService

创建：

```text
src/creator-assistant/creator-assistant.service.ts
```

实现：

```text
chat
getOrCreateSession
syncProjectContext
exportSummary
```

---

## Step 6：新增数据库表

Prisma 增加：

```text
CreatorAssistantSession
CreatorAssistantMessage
LettaSyncLog
ProjectTodo
```

执行 migration。

---

## Step 7：新增 Creator Assistant Routes

创建：

```text
src/routes/creator-assistant.route.ts
```

实现：

```text
POST /v1/creator-assistant/chat
POST /v1/creator-assistant/sync
GET /v1/creator-assistant/status
GET /v1/creator-assistant/export-summary
```

全部 owner only。

---

## Step 8：新增 Project Context Sync

创建：

```text
src/creator-assistant/creator-assistant-sync.service.ts
```

同步：

```text
project_status
technical_decisions
persona_feedback
todos
```

---

## Step 9：新增脚本

创建：

```text
scripts/sync-project-context-to-letta.ts
scripts/inspect-letta-creator-agent.ts
scripts/export-creator-assistant-summary.ts
```

---

## Step 10：可选新增 Web 管理页

在 `web/` 中新增：

```text
/admin/creator-assistant
```

如果前端还没有路由，可以暂时做一个简单页面：

```text
web/src/admin/CreatorAssistantPage.tsx
```

---

# 27. 安全要求

## 27.1 Creator Assistant 必须 owner only

不能让普通用户访问。

## 27.2 Creator Assistant 不能直接写入正式记忆

v0.6 中：

```env
LETTA_ALLOW_WRITE_TO_LUSIYUAN_MEMORY=false
```

如果 Creator Assistant 认为需要新增记忆，只能输出：

```text
建议新增记忆：
...
```

由你确认。

## 27.3 Creator Assistant 不能修改 persona 文件

v0.6 中：

```env
LETTA_ALLOW_EDIT_PERSONA_FILES=false
```

如果它认为人设文件需要改，只能输出 patch 建议。

## 27.4 Creator Assistant 不能执行高风险工具

必须禁止：

```text
send_message
post_to_platform
operate_browser
read_private_inbox
```

---

# 28. v0.6 验收标准

完成后应满足：

```text
1. Letta server 可以正常连接
2. 可以创建 Letta Creator Assistant agent
3. Creator Assistant 有 memory blocks：
   - persona
   - creator_profile
   - project_overview
   - current_roadmap
   - technical_principles
   - boundaries
4. /v1/creator-assistant/chat 可用
5. 非 owner 无法访问 Creator Assistant
6. Creator Assistant 能回答项目路线问题
7. Creator Assistant 能总结技术决策
8. Creator Assistant 能生成 Codex 可执行任务
9. Creator Assistant 不冒充陆思源本人
10. Creator Assistant 不直接修改陆思源正式 Memory
11. Creator Assistant 不直接修改 persona 文件
12. sync 脚本可以把 project_context / technical_decision 同步到 Letta
13. export-summary 可以导出当前项目摘要
14. 陆思源原有 Web / Telegram / Weixin 聊天不受影响
```

---

# 29. 推荐测试问题

给 Creator Assistant 测：

```text
1. 帮我总结陆思源项目现在做到哪一步了。
2. v0.1 到 v0.5 分别做了什么？
3. 为什么我们没有用 Dify 做主系统？
4. 为什么 v0.4 选择 SiliconFlow Qwen3-Embedding-4B + pgvector？
5. v0.5 的 Tool & Action Layer 有哪些低风险工具？
6. 下一版 v0.7 如果做 Reflection Agent，应该注意什么？
7. 帮我生成一份给 Codex 的 v0.7 开发任务。
8. 检查一下当前路线有没有架构风险。
9. 陆思源的人设边界里，最重要的不能变的是什么？
10. 帮我列出当前未完成的 Todo。
```

理想表现：

```text
它像项目助理，而不是陆思源本人。
它能结构化总结。
它能给开发任务。
它会提醒风险。
它不会说“我是陆思源”。
```

---

# 30. 给 Codex 的开发指令

可以把下面这段交给 Codex：

```text
请在现有 lusiyuan-core v0.5 项目基础上实现 v0.6：Letta Creator Assistant。

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
- DraftService
- ToolCallLog
- MemoryRetrievalService

v0.6 目标：
新增 Letta Creator Assistant。它是“陆思源项目助理”，不是陆思源本人。它用于帮助创作者整理项目进展、技术决策、人设反馈、待办事项、版本规划和 Codex 开发任务。

请注意：
- 不要让 Letta 接管陆思源对外聊天。
- 不要让 Letta 自动修改陆思源 core_memory.md / boundaries.md。
- 不要让 Letta 直接写入陆思源正式 Memory 表。
- 不要让 Letta 执行外部动作。
- Creator Assistant 必须 owner only。

请完成以下任务：

1. 更新 .env.example，增加：
   - LETTA_ENABLED=false
   - LETTA_BASE_URL="http://localhost:8283"
   - LETTA_API_KEY=""
   - LETTA_SERVER_PASSWORD=""
   - LETTA_CREATOR_AGENT_ID=""
   - CREATOR_ASSISTANT_ENABLED=true
   - CREATOR_ASSISTANT_OWNER_ONLY=true
   - CREATOR_ASSISTANT_AUTO_SYNC=false
   - CREATOR_ASSISTANT_MAX_CONTEXT_MESSAGES=50
   - CREATOR_ASSISTANT_MAX_DECISIONS=30
   - CREATOR_ASSISTANT_MAX_MEMORIES=30
   - LETTA_SYNC_PROJECT_STATUS=true
   - LETTA_SYNC_TECH_DECISIONS=true
   - LETTA_SYNC_PERSONA_FEEDBACK=true
   - LETTA_SYNC_TODOS=true
   - LETTA_ALLOW_WRITE_TO_LUSIYUAN_MEMORY=false
   - LETTA_ALLOW_EDIT_PERSONA_FILES=false
   - LETTA_ALLOW_EXTERNAL_ACTIONS=false

2. 安装 Letta TypeScript SDK：
   - pnpm add @letta-ai/letta-client

3. 新增 src/letta/：
   - letta-client.ts
   - letta-config.ts
   - letta-agent-manager.ts
   - letta-message.service.ts
   - letta-memory-blocks.ts
   - letta-sync.types.ts

4. 在 letta-client.ts 中封装 LettaClientAdapter：
   - createAgent()
   - getAgent()
   - sendMessage()
   - updateMemoryBlock()
   - insertArchivalMemory()
   注意：不要让业务代码到处直接调用 Letta SDK。

5. 新增 src/creator-assistant/：
   - creator-assistant.service.ts
   - creator-assistant.types.ts
   - creator-assistant.prompt.ts
   - creator-assistant-sync.service.ts
   - creator-assistant-permissions.ts
   - creator-assistant-context-builder.ts

6. Creator Assistant 的身份：
   - 它是“陆思源项目助理”
   - 它不是陆思源本人
   - 它帮助创作者整理项目进展、技术决策、人设反馈、待办和开发文档
   - 它不能对外聊天
   - 它不能修改陆思源核心人格文件
   - 它不能直接写入陆思源正式 Memory 表

7. 实现 Creator Assistant memory blocks：
   - persona
   - creator_profile
   - project_overview
   - current_roadmap
   - technical_principles
   - boundaries

8. 新增 scripts/setup-letta-creator-agent.ts：
   - 连接 Letta server
   - 创建 Creator Assistant agent
   - 写入上述 memory blocks
   - 输出 agent_id
   - 提醒用户写入 LETTA_CREATOR_AGENT_ID

9. 更新 Prisma schema，新增：
   - CreatorAssistantSession
   - CreatorAssistantMessage
   - LettaSyncLog
   - ProjectTodo

10. CreatorAssistantSession 字段：
   - id
   - userId
   - channel
   - externalId
   - lettaAgentId
   - title
   - status default active
   - createdAt
   - updatedAt

11. CreatorAssistantMessage 字段：
   - id
   - sessionId
   - role
   - content
   - metadata Json?
   - createdAt

12. LettaSyncLog 字段：
   - id
   - syncType
   - target
   - status
   - sourceId
   - payload Json?
   - result Json?
   - error
   - createdAt

13. ProjectTodo 字段：
   - id
   - title
   - description
   - status default open
   - priority default 5
   - source
   - metadata Json?
   - createdAt
   - updatedAt

14. 实现 CreatorAssistantService：
   - chat()
   - getOrCreateSession()
   - syncProjectContext()
   - exportSummary()

15. 实现 Project Context Sync：
   - 从 Memory 表同步 technical_decision
   - 从 Memory 表同步 project_context
   - 从 Memory 表同步 persona_feedback
   - 从 ProjectTodo 表同步 todos
   - 同步写入 Letta archival memory 或更新 memory blocks
   - 每次同步写 LettaSyncLog

16. 新增 routes/creator-assistant.route.ts：
   - POST /v1/creator-assistant/chat
   - POST /v1/creator-assistant/sync
   - GET /v1/creator-assistant/status
   - GET /v1/creator-assistant/export-summary
   全部必须 owner only。

17. 新增脚本：
   - scripts/sync-project-context-to-letta.ts
   - scripts/inspect-letta-creator-agent.ts
   - scripts/export-creator-assistant-summary.ts

18. 更新 package.json scripts：
   - "letta:setup-creator": "tsx scripts/setup-letta-creator-agent.ts"
   - "letta:sync": "tsx scripts/sync-project-context-to-letta.ts"
   - "letta:inspect": "tsx scripts/inspect-letta-creator-agent.ts"
   - "creator:export-summary": "tsx scripts/export-creator-assistant-summary.ts"

19. 可选：在 web/ 中新增简单管理页：
   - /admin/creator-assistant
   - 可以和 Creator Assistant 聊天
   - 可以触发 sync
   - 可以导出 summary
   如果当前前端没有路由，可以先不做复杂 UI，只保留 API。

20. 新增 docs/letta-creator-assistant-v0.6.md：
   - 解释 Letta 在本项目中的定位
   - 说明 Creator Assistant 不是陆思源本人
   - 说明 Memory Blocks
   - 说明 Archival Memory
   - 说明同步流程
   - 说明安全边界
   - 说明如何启动 Letta server
   - 说明如何运行 setup / sync / inspect 脚本

限制：
- 不要让 Letta 替代 /v1/chat
- 不要让 Letta 自动回复普通用户
- 不要让 Letta 直接写入陆思源 Memory 表
- 不要让 Letta 直接修改 persona/*.md
- 不要让 Letta 执行 send_message / post_to_platform / operate_browser / read_private_inbox
- 不要接 OpenClaw
- 不要实现 Reflection Agent，这留到 v0.7

验收：
- 可以连接 Letta server
- 可以创建 Creator Assistant agent
- 可以写入 memory blocks
- owner 可以调用 /v1/creator-assistant/chat
- 非 owner 被拒绝
- Creator Assistant 能总结项目进展和技术决策
- Creator Assistant 不冒充陆思源本人
- sync 脚本可以同步项目上下文
- export-summary 可以导出项目摘要
- 原有陆思源聊天功能不受影响
```

---

# 31. v0.6 最终效果

v0.6 完成后，你会拥有两个不同角色：

```text
陆思源本人：
负责对外聊天，有人格、有记忆、有边界。

陆思源项目助理：
负责帮助你管理项目、整理决策、写技术文档、维护路线。
```

这一步的价值很大。
因为项目越往后，复杂度会越来越高：

```text
Core API
多渠道
Web
记忆检索
工具层
Letta
OpenClaw
MCP
Qdrant
人设
内容运营
图像素材
音色
```

如果没有一个项目助理，你很容易在后面忘记“为什么当时这么选”。

v0.6 的重点不是让陆思源更会聊天，而是让整个项目更可持续。
等 Creator Assistant 稳定后，v0.7 再做 **Letta Reflection Agent**，让 Letta 开始帮助陆思源本人复盘记忆和人格稳定性。

[1]: https://github.com/letta-ai/letta?utm_source=chatgpt.com "letta-ai/letta: Letta is the platform for building stateful agents ..."
[2]: https://docs.letta.com/guides/core-concepts/memory/archival-memory/?utm_source=chatgpt.com "Archival memory | Letta Docs"
[3]: https://docs.letta.com/guides/docker/?utm_source=chatgpt.com "Deploy a Letta server with Docker"
[4]: https://docs.letta.com/guides/ade/setup/?utm_source=chatgpt.com "Initial setup and connection | Letta Docs"
