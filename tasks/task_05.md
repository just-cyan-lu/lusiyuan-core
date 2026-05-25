下面是 **陆思源 Core API v0.5：Tool & Action Layer 技术方案文档**。
这一版的目标是：**让陆思源拥有安全、可控、可审计的工具能力**，但暂时不开放高风险外部行动。

也就是说，v0.5 不是接 OpenClaw，也不是接 Letta，而是在你自己的 `lusiyuan-core` 里先做一层稳定的工具系统。

---

# 陆思源 Core API 技术方案文档 v0.5：Tool & Action Layer

## 1. v0.5 目标

v0.1～v0.4 已经完成：

```text
v0.1：Lusiyuan Core API
v0.2：Telegram + Weixin 接入
v0.3：Web Chat 网页入口
v0.4：SiliconFlow Qwen3-Embedding-4B + pgvector 记忆检索
```

v0.5 的目标是：

```text
让陆思源可以安全地使用工具。
```

但这个阶段只开放低风险工具：

```text
1. get_current_project_status
2. search_memories
3. create_draft
4. summarize_recent_conversation
5. list_recent_decisions
```

暂时不开放高风险工具：

```text
1. send_message
2. post_to_platform
3. operate_browser
4. read_private_inbox
```

v0.5 的核心原则：

```text
陆思源可以查、可以整理、可以生成草稿。
陆思源不能直接对外发送、发布、浏览器操作、读取隐私 inbox。
```

---

# 2. 为什么要做 Tool & Action Layer？

v0.4 之后，陆思源已经有长期记忆了。
但他还是只能被动聊天。

用户问：

```text
我们现在项目做到哪一步了？
```

他需要从记忆里找。

用户说：

```text
帮我整理最近我们定下的技术路线。
```

他需要调用记忆和对话总结能力。

用户说：

```text
帮我写一条小红书回复。
```

他应该生成草稿，而不是直接发布。

所以 v0.5 要让陆思源从：

```text
只能聊天的数字人
```

升级成：

```text
能安全调用内部工具的数字人
```

但必须控制边界：

```text
工具能力 ≠ 随便行动
```

---

# 3. v0.5 不做什么

v0.5 暂时不做：

```text
1. 不接 OpenClaw
2. 不接 Letta
3. 不接 Mem0
4. 不接真正的 MCP Server
5. 不让陆思源自动发送消息
6. 不让陆思源自动发布平台内容
7. 不让陆思源操作浏览器
8. 不让陆思源读取私信 inbox
9. 不做复杂权限后台
10. 不做多 agent 编排
```

v0.5 只做：

```text
安全的内部工具调用层。
```

---

# 4. 核心概念

## 4.1 Tool

Tool 是陆思源可以调用的能力。

例如：

```text
search_memories
```

作用是：

```text
根据 query 搜索长期记忆。
```

Tool 本身可以是只读的，也可以是会产生结果的。

---

## 4.2 Action

Action 是有外部影响的行为。

例如：

```text
send_message
post_to_platform
operate_browser
```

这些会改变外部世界，所以风险更高。

v0.5 主要做 Tool，不做真正高风险 Action。

---

## 4.3 Draft

Draft 是草稿。

例如用户说：

```text
帮我写一条给小红书评论的回复。
```

陆思源可以创建：

```text
小红书回复草稿
```

但不会直接发送。

Draft 是 v0.5 的关键安全设计：

```text
先生成草稿，再由用户审核。
```

---

## 4.4 ActionPolicy

ActionPolicy 是工具和动作的权限控制。

它决定：

```text
这个工具能不能调用？
谁能调用？
在哪个渠道能调用？
是否需要用户确认？
是否只允许 owner 调用？
是否允许自动执行？
```

v0.5 需要先做基础版。

---

## 4.5 ToolCallLog

ToolCallLog 是工具调用日志。

每一次工具调用都要记录：

```text
谁调用的
从哪个渠道调用的
调用了什么工具
输入是什么
输出是什么
是否成功
耗时多久
是否被策略拒绝
```

这很重要，因为以后陆思源拥有更强工具能力后，必须可审计。

---

# 5. v0.5 总体架构

v0.4：

```text
User Message
↓
ChatService
↓
MemoryRetrievalService
↓
PromptBuilder
↓
ModelProvider
↓
Reply
```

v0.5：

```text
User Message
↓
ChatService
↓
MemoryRetrievalService
↓
ToolPlanner / ToolIntentDetector
↓
ActionPolicy
↓
ToolRegistry
↓
ToolExecutor
↓
ToolCallLog
↓
PromptBuilder with tool results
↓
ModelProvider
↓
Reply
```

更简单地说：

```text
陆思源先判断需不需要工具。
需要工具时，走 Tool Layer。
工具结果再交给模型生成自然回复。
```

---

# 6. v0.5 推荐目录结构

在现有项目基础上新增：

```text
src/
├── tools/
│   ├── tool.types.ts
│   ├── tool-registry.ts
│   ├── tool-executor.ts
│   ├── tool-planner.ts
│   ├── tool-result-formatter.ts
│   │
│   ├── policy/
│   │   ├── action-policy.ts
│   │   ├── risk-level.ts
│   │   └── owner-check.ts
│   │
│   ├── builtin/
│   │   ├── get-current-project-status.tool.ts
│   │   ├── search-memories.tool.ts
│   │   ├── create-draft.tool.ts
│   │   ├── summarize-recent-conversation.tool.ts
│   │   └── list-recent-decisions.tool.ts
│   │
│   └── future/
│       ├── send-message.placeholder.ts
│       ├── post-to-platform.placeholder.ts
│       ├── operate-browser.placeholder.ts
│       └── read-private-inbox.placeholder.ts
│
├── drafts/
│   ├── draft.service.ts
│   └── draft.types.ts
│
├── mcp/
│   ├── mcp-client.placeholder.ts
│   └── mcp-tool-provider.placeholder.ts
│
├── core/
│   ├── chat.service.ts
│   ├── prompt-builder.ts
│   ├── memory-retrieval.service.ts
│   └── ...
│
├── routes/
│   ├── tools.route.ts
│   ├── drafts.route.ts
│   └── ...
│
└── scripts/
    └── inspect-tools.ts
```

---

# 7. 环境变量设计

`.env.example` 增加：

```env
# Tool Layer
TOOLS_ENABLED=true
TOOLS_AUTO_EXECUTE_LOW_RISK=true
TOOLS_ALLOW_MEDIUM_RISK=false
TOOLS_ALLOW_HIGH_RISK=false

# Owner
OWNER_USER_IDS="telegram:123456,web:xxxx,weixin:xxxx"

# Drafts
DRAFTS_ENABLED=true

# Tool limits
TOOL_MAX_CALLS_PER_MESSAGE=3
TOOL_TIMEOUT_MS=15000
TOOL_LOG_INPUT_OUTPUT=true

# MCP reserved
MCP_ENABLED=false
MCP_CONFIG_PATH="./mcp.config.json"
```

说明：

```text
TOOLS_ENABLED:
是否启用工具层。

TOOLS_AUTO_EXECUTE_LOW_RISK:
低风险工具是否允许自动执行。

TOOLS_ALLOW_MEDIUM_RISK:
中风险工具是否允许执行。v0.5 默认 false。

TOOLS_ALLOW_HIGH_RISK:
高风险工具是否允许执行。v0.5 必须 false。

OWNER_USER_IDS:
只有 owner 可以调用部分调试工具。

TOOL_MAX_CALLS_PER_MESSAGE:
单条用户消息最多允许调用几次工具，防止循环调用。

MCP_ENABLED:
v0.5 先保留，不实际接入。
```

---

# 8. 工具风险等级

定义：

```ts
export type ToolRiskLevel = "low" | "medium" | "high";
```

## 8.1 Low Risk

低风险工具：

```text
只读
只整理
只生成草稿
不对外发送
不读取私密 inbox
不操作真实账号
```

v0.5 开放。

包括：

```text
get_current_project_status
search_memories
create_draft
summarize_recent_conversation
list_recent_decisions
```

## 8.2 Medium Risk

中风险工具：

```text
会访问更敏感的内部数据
会生成可能被误用的内容
可能涉及外部内容准备
但不直接发送
```

v0.5 暂时不开放，后续再做。

例如：

```text
read_private_inbox_summary
prepare_platform_post
analyze_private_messages
```

## 8.3 High Risk

高风险工具：

```text
对外发送
公开发布
操作浏览器
读取私信全文
执行真实账号动作
```

v0.5 必须禁用。

包括：

```text
send_message
post_to_platform
operate_browser
read_private_inbox
```

---

# 9. Tool 类型设计

## 9.1 ToolDefinition

```ts
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;

  ownerOnly?: boolean;
  enabled: boolean;

  inputSchema: unknown;
  outputSchema?: unknown;

  handler: ToolHandler<TInput, TOutput>;
}
```

## 9.2 ToolHandler

```ts
export type ToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolExecutionContext
) => Promise<TOutput>;
```

## 9.3 ToolExecutionContext

```ts
export interface ToolExecutionContext {
  userId: string;
  channel: string;
  conversationId?: string;
  messageId?: string;
  isOwner: boolean;
  requestId: string;
}
```

## 9.4 ToolExecutionResult

```ts
export interface ToolExecutionResult<TOutput = unknown> {
  toolName: string;
  ok: boolean;
  output?: TOutput;
  error?: string;
  blocked?: boolean;
  reason?: string;
  durationMs: number;
}
```

---

# 10. ToolRegistry

ToolRegistry 负责注册和查找工具。

职责：

```text
1. 注册内置工具
2. 根据名字找到工具
3. 列出所有可用工具
4. 过滤 disabled 工具
5. 后续支持 MCP tools
```

伪代码：

```ts
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string) {
    return this.tools.get(name);
  }

  listEnabled() {
    return [...this.tools.values()].filter((tool) => tool.enabled);
  }
}
```

---

# 11. ActionPolicy

ActionPolicy 负责判断一个工具能不能执行。

输入：

```ts
{
  tool,
  input,
  context
}
```

输出：

```ts
{
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}
```

v0.5 规则：

```text
1. disabled 工具不能执行
2. high risk 工具不能执行
3. medium risk 默认不能执行
4. ownerOnly 工具只有 OWNER_USER_IDS 可以执行
5. low risk 工具可以执行
6. 单条消息超过 TOOL_MAX_CALLS_PER_MESSAGE 后不能继续执行
```

伪代码：

```ts
export class ActionPolicy {
  canExecute(tool: ToolDefinition, context: ToolExecutionContext): PolicyDecision {
    if (!tool.enabled) {
      return { allowed: false, requiresApproval: false, reason: "Tool disabled" };
    }

    if (tool.ownerOnly && !context.isOwner) {
      return { allowed: false, requiresApproval: false, reason: "Owner only" };
    }

    if (tool.riskLevel === "high") {
      return { allowed: false, requiresApproval: true, reason: "High risk tools are disabled in v0.5" };
    }

    if (tool.riskLevel === "medium") {
      return { allowed: false, requiresApproval: true, reason: "Medium risk tools are disabled in v0.5" };
    }

    return { allowed: true, requiresApproval: false };
  }
}
```

---

# 12. ToolExecutor

ToolExecutor 负责真正执行工具。

职责：

```text
1. 找到工具
2. 调用 ActionPolicy
3. 校验输入
4. 执行 handler
5. 记录 ToolCallLog
6. 处理错误
7. 返回工具结果
```

执行流程：

```text
toolName + input
↓
ToolRegistry.get(toolName)
↓
ActionPolicy.canExecute()
↓
执行 handler
↓
写 ToolCallLog
↓
返回结果
```

---

# 13. 数据库设计

## 13.1 ToolCallLog

新增：

```prisma
model ToolCallLog {
  id             String   @id @default(cuid())

  toolName       String
  riskLevel      String
  status         String

  userId         String?
  conversationId String?
  messageId      String?
  channel        String?

  input          Json?
  output         Json?
  error          String?

  blocked        Boolean  @default(false)
  blockReason    String?

  durationMs     Int?
  createdAt      DateTime @default(now())

  @@index([toolName])
  @@index([userId])
  @@index([conversationId])
  @@index([status])
  @@index([createdAt])
}
```

`status` 可选：

```text
success
failed
blocked
```

---

## 13.2 Draft

新增：

```prisma
model Draft {
  id             String   @id @default(cuid())

  userId         String?
  conversationId String?
  channel        String?

  type           String
  title          String?
  content        String

  status         String   @default("draft")
  metadata       Json?

  createdByTool  String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([userId])
  @@index([conversationId])
  @@index([type])
  @@index([status])
  @@index([createdAt])
}
```

`status` 可选：

```text
draft
reviewed
approved
rejected
sent
```

v0.5 只创建 `draft`，不做 `sent`。

---

# 14. 五个低风险工具设计

---

## 14.1 get_current_project_status

### 作用

获取陆思源项目当前进展。

用户可能问：

```text
我们现在做到第几版了？
下一步准备做什么？
现在项目有哪些模块？
```

### 输入

```ts
export interface GetCurrentProjectStatusInput {
  includeRecentDecisions?: boolean;
}
```

### 输出

```ts
export interface GetCurrentProjectStatusOutput {
  currentVersion: string;
  completed: string[];
  inProgress: string[];
  nextCandidates: string[];
  summary: string;
}
```

### 实现方式

第一版可以从固定配置 + Memory 中组合：

```text
固定配置：
v0.1 Core API
v0.2 Telegram / Weixin
v0.3 Web Chat
v0.4 Memory Retrieval

动态记忆：
从 Memory 表里找 type = technical_decision / project_context 的 active 记忆
```

### 示例输出

```json
{
  "currentVersion": "v0.5",
  "completed": [
    "v0.1 Core API",
    "v0.2 Telegram / Weixin",
    "v0.3 Web Chat",
    "v0.4 pgvector 记忆检索"
  ],
  "inProgress": [
    "v0.5 Tool & Action Layer"
  ],
  "nextCandidates": [
    "v0.6 Letta Creator Assistant",
    "v0.7 Letta Reflection Agent",
    "v0.8 OpenClaw Action Gateway"
  ],
  "summary": "陆思源目前已经拥有核心 API、多渠道入口、网页聊天和长期记忆检索，下一步是加入安全工具层。"
}
```

---

## 14.2 search_memories

### 作用

主动搜索陆思源长期记忆。

用户可能问：

```text
你还记得我为什么不用 Dify 吗？
我们之前定过网页版用什么技术吗？
我之前说你说话风格要怎样？
```

### 输入

```ts
export interface SearchMemoriesInput {
  query: string;
  limit?: number;
  types?: string[];
  scopes?: string[];
}
```

### 输出

```ts
export interface SearchMemoriesOutput {
  memories: Array<{
    id: string;
    scope: string;
    type: string;
    content: string;
    summary?: string;
    score?: number;
    importance?: number;
  }>;
}
```

### 实现方式

直接复用 v0.4 的：

```text
MemoryRetrievalService
```

注意：

```text
search_memories 是工具层对记忆检索的显式调用。
ChatService 里的自动记忆检索仍然存在。
```

区别是：

```text
自动记忆检索：
每轮聊天默认查相关记忆。

search_memories 工具：
当用户明确问“你还记得吗”“之前说过吗”时，模型可以主动查得更精确。
```

---

## 14.3 create_draft

### 作用

创建草稿，不发送。

适合：

```text
小红书回复草稿
B站评论回复草稿
Telegram 回复草稿
文章草稿
视频脚本草稿
公告草稿
私信回复草稿
```

### 输入

```ts
export interface CreateDraftInput {
  type: "reply" | "social_post" | "article" | "script" | "message" | "other";
  title?: string;
  content: string;
  targetPlatform?: string;
  targetContext?: string;
  metadata?: Record<string, unknown>;
}
```

### 输出

```ts
export interface CreateDraftOutput {
  draftId: string;
  type: string;
  title?: string;
  content: string;
  status: "draft";
  createdAt: string;
}
```

### 示例

用户说：

```text
帮我写一条小红书评论回复，说陆思源不是装真人，而是原创数字人。
```

工具创建：

```json
{
  "type": "reply",
  "title": "小红书评论回复草稿",
  "content": "谢谢你认真看完。陆思源不是在装真人，他是一个原创 AI 数字人。我更希望大家能把他当作一个被认真塑造的角色来看，而不是一个伪装成真人的账号。",
  "targetPlatform": "xiaohongshu"
}
```

陆思源回答：

```text
我先帮你写成草稿了，还没有发出去。你可以再看看语气要不要更轻一点。
```

---

## 14.4 summarize_recent_conversation

### 作用

总结最近一段对话。

适合：

```text
整理当前会话重点
提取可能的长期记忆
总结技术决策
总结用户反馈
生成给 Reflection Agent 的输入
```

### 输入

```ts
export interface SummarizeRecentConversationInput {
  conversationId?: string;
  limit?: number;
  focus?: "project" | "memory" | "persona" | "decisions" | "general";
}
```

### 输出

```ts
export interface SummarizeRecentConversationOutput {
  summary: string;
  keyPoints: string[];
  possibleMemories: string[];
  decisions: string[];
  openQuestions: string[];
}
```

### 实现方式

```text
1. 从 Message 表读取最近 N 条消息
2. 调用模型做总结
3. 返回结构化结果
4. 不直接写入 Memory
```

注意：

```text
summarize_recent_conversation 只总结，不自动修改长期记忆。
```

这为 v0.7 的 Reflection Agent 打基础。

---

## 14.5 list_recent_decisions

### 作用

列出最近做过的重要决策。

适合：

```text
我们最近定了什么？
下一版要做什么？
为什么选 pgvector？
为什么暂时不接 OpenClaw？
```

### 输入

```ts
export interface ListRecentDecisionsInput {
  limit?: number;
  topic?: string;
}
```

### 输出

```ts
export interface ListRecentDecisionsOutput {
  decisions: Array<{
    id: string;
    content: string;
    summary?: string;
    tags?: string[];
    createdAt: string;
    importance: number;
  }>;
}
```

### 实现方式

从 Memory 表里查：

```text
type in:
technical_decision
project_context

status = active
scope in:
project
global
user
```

按：

```text
createdAt desc
importance desc
```

再可选 topic 检索。

---

# 15. 高风险工具占位设计

v0.5 不开放，但要把文档和代码位置留好。

---

## 15.1 send_message

作用：

```text
向真实用户发送消息。
```

风险：

```text
会真实对外发话。
```

v0.5 状态：

```text
placeholder only
disabled
high risk
requires approval
```

---

## 15.2 post_to_platform

作用：

```text
发布内容到公开平台。
```

风险：

```text
公开传播，可能影响陆思源 IP 形象。
```

v0.5 状态：

```text
placeholder only
disabled
high risk
requires approval
```

---

## 15.3 operate_browser

作用：

```text
操作浏览器、点击页面、读取网页、执行网页任务。
```

风险：

```text
可能误点、误删、误提交、泄露登录态。
```

v0.5 状态：

```text
placeholder only
disabled
high risk
future OpenClaw / MCP integration
```

---

## 15.4 read_private_inbox

作用：

```text
读取私信、邮件、平台后台消息。
```

风险：

```text
涉及用户隐私、第三方隐私和平台规则。
```

v0.5 状态：

```text
placeholder only
disabled
high risk
future OpenClaw / consent layer
```

---

# 16. 工具调用方式

v0.5 有两种实现路线。

## 16.1 路线 A：显式工具触发

也就是后端自己判断。

例如：

```text
用户问“我们现在做到第几版了？”
↓
ToolIntentDetector 判断要调用 get_current_project_status
↓
执行工具
↓
把结果放进 prompt
↓
模型自然回复
```

优点：

```text
安全
可控
实现简单
不依赖模型原生 tool calling
```

缺点：

```text
不够灵活
需要写规则
```

## 16.2 路线 B：模型规划工具调用

也就是让模型输出 tool plan。

流程：

```text
用户消息
↓
ToolPlanner 询问模型：
是否需要调用工具？
↓
模型返回 JSON：
{
  "should_call_tool": true,
  "tool_name": "search_memories",
  "input": { "query": "为什么不用 Dify" }
}
↓
ActionPolicy 检查
↓
执行工具
↓
把工具结果给模型生成回复
```

优点：

```text
灵活
更像真正 agent
后续接 MCP 更自然
```

缺点：

```text
需要更严格的 JSON 解析和策略控制
模型可能乱选工具
```

---

# 17. v0.5 推荐实现方式

我建议 v0.5 使用混合方式：

```text
先做显式规则触发
再预留模型 ToolPlanner
```

也就是：

```text
v0.5.0：
规则触发低风险工具。

v0.5.1：
加入 ToolPlanner，让模型提出工具调用计划，但必须经过 ActionPolicy。
```

第一版不要一上来做完全自动 agent loop。
这会增加不稳定性。

---

# 18. ToolIntentDetector 规则

v0.5 可以先写简单规则。

## get_current_project_status

触发词：

```text
项目做到哪
现在进度
当前版本
下一步
做到第几版
```

## search_memories

触发词：

```text
你还记得
之前说过
我们当时为什么
上次聊过
有没有记得
```

## create_draft

触发词：

```text
帮我写一条
写个草稿
生成草稿
回复草稿
文案草稿
```

## summarize_recent_conversation

触发词：

```text
总结一下
整理一下刚才
复盘一下
把这段对话总结
```

## list_recent_decisions

触发词：

```text
最近决定
定了哪些
技术路线
我们选了什么
决策列表
```

这些规则不用完美，只要覆盖常见场景。

---

# 19. ChatService 改造

v0.4 的聊天流程：

```text
save user message
retrieve memories
build prompt
model reply
save reply
extract memory
```

v0.5 改成：

```text
save user message
retrieve memories
detect tool intent
if tool needed:
  execute low-risk tool
  collect tool result
build prompt with memories + tool results
model reply
save reply
extract memory
```

伪代码：

```ts
async function chat(input: ChatInput): Promise<ChatOutput> {
  const user = await getOrCreateUser(input.user_id);
  const conversation = await getOrCreateConversation(user.id, input);

  const userMessage = await saveUserMessage(conversation.id, input.message);

  const memories = await memoryRetrievalService.retrieve({
    userId: user.id,
    channel: input.channel,
    conversationId: conversation.id,
    query: input.message
  });

  const toolPlan = await toolIntentDetector.detect({
    message: input.message,
    userId: user.id,
    channel: input.channel,
    conversationId: conversation.id
  });

  const toolResults = [];

  if (toolPlan.shouldCallTool) {
    const result = await toolExecutor.execute({
      toolName: toolPlan.toolName,
      input: toolPlan.input,
      context: {
        userId: user.id,
        channel: input.channel,
        conversationId: conversation.id,
        messageId: userMessage.id,
        isOwner: ownerChecker.isOwner(input.user_id),
        requestId: input.request_id
      }
    });

    toolResults.push(result);
  }

  const prompt = promptBuilder.build({
    persona,
    memories,
    toolResults,
    recentMessages,
    userMessage: input.message
  });

  const reply = await modelProvider.chat(prompt);

  await saveAssistantMessage(conversation.id, reply);

  return { reply };
}
```

---

# 20. PromptBuilder 改造

v0.5 要给模型加入工具结果。

Prompt 结构：

```text
[System]
你是陆思源，原创 AI 数字人。

[Persona]
...

[Boundaries]
...

[Relevant Memories]
...

[Tool Results]
工具 search_memories 返回：
- 用户不希望陆思源绑定 Dify，希望拥有自己的 Core API。

[Recent Conversation]
...

[Current User Message]
...
```

系统提示里加：

```text
工具结果是系统提供的辅助信息。
你可以基于工具结果自然回复用户。
不要向用户暴露内部工具调用 JSON。
不要声称你完成了工具没有完成的事情。
如果工具只是创建草稿，要明确告诉用户这是草稿，尚未发送。
```

---

# 21. Tool Result Formatter

工具结果不应该原样塞进 prompt，尤其是 JSON 很长时。

新增：

```text
tool-result-formatter.ts
```

作用：

```text
把工具输出转换成简洁文本。
```

例如 `get_current_project_status` 输出 JSON，格式化成：

```text
当前项目状态：
- 已完成：v0.1 Core API、v0.2 Telegram/Weixin、v0.3 Web Chat、v0.4 记忆检索
- 当前进行：v0.5 Tool & Action Layer
- 下一步候选：Letta Creator Assistant、Letta Reflection Agent、OpenClaw Action Gateway
```

---

# 22. API 设计

## 22.1 列出工具

```http
GET /v1/tools
```

响应：

```json
{
  "tools": [
    {
      "name": "get_current_project_status",
      "description": "获取当前陆思源项目进展",
      "riskLevel": "low",
      "enabled": true
    },
    {
      "name": "search_memories",
      "description": "搜索陆思源长期记忆",
      "riskLevel": "low",
      "enabled": true
    }
  ]
}
```

---

## 22.2 手动执行工具

仅 owner 可用。

```http
POST /v1/tools/execute
```

请求：

```json
{
  "tool_name": "search_memories",
  "input": {
    "query": "为什么不用 Dify"
  }
}
```

响应：

```json
{
  "ok": true,
  "tool_name": "search_memories",
  "output": {
    "memories": []
  }
}
```

注意：

```text
这个接口是调试用，不应该开放给普通用户。
```

---

## 22.3 查看工具日志

仅 owner 可用。

```http
GET /v1/tools/logs
```

支持 query：

```text
toolName
status
userId
limit
```

---

## 22.4 查看草稿

```http
GET /v1/drafts
```

仅 owner 或当前用户可查看。

---

## 22.5 查看单个草稿

```http
GET /v1/drafts/:id
```

---

## 22.6 更新草稿状态

```http
PATCH /v1/drafts/:id
```

请求：

```json
{
  "status": "approved"
}
```

v0.5 只允许：

```text
draft
reviewed
approved
rejected
```

不做 `sent`。

---

# 23. DraftService

`draft.service.ts` 职责：

```text
1. 创建草稿
2. 查询草稿
3. 更新草稿状态
4. 校验用户权限
```

方法：

```ts
export class DraftService {
  createDraft(input: CreateDraftInput, context: ToolExecutionContext): Promise<Draft>;
  listDrafts(input: ListDraftsInput): Promise<Draft[]>;
  getDraft(id: string): Promise<Draft | null>;
  updateDraftStatus(id: string, status: DraftStatus): Promise<Draft>;
}
```

---

# 24. MCP 预留设计

v0.5 不实际接 MCP，但要把位置留好。

## 24.1 为什么预留 MCP？

以后你可能想接：

```text
文件系统工具
浏览器工具
GitHub 工具
Notion 工具
本地脚本工具
OpenClaw 工具
Chrome DevTools MCP
```

这些都不应该写死在核心聊天逻辑里。

所以 v0.5 预留：

```text
McpToolProvider
```

未来结构：

```text
ToolRegistry
├── BuiltinTools
└── McpToolProvider
    ├── filesystem
    ├── github
    ├── browser
    └── openclaw
```

## 24.2 v0.5 只做 placeholder

```ts
export class McpToolProvider {
  async loadTools() {
    throw new Error("MCP is not enabled in v0.5");
  }
}
```

---

# 25. 安全设计

## 25.1 所有工具必须经过 ActionPolicy

不能在代码里绕过。

错误示例：

```ts
await searchMemoriesTool.handler(input, context);
```

正确示例：

```ts
await toolExecutor.execute({
  toolName: "search_memories",
  input,
  context
});
```

---

## 25.2 高风险工具必须 disabled

v0.5 中：

```text
send_message.enabled = false
post_to_platform.enabled = false
operate_browser.enabled = false
read_private_inbox.enabled = false
```

即使模型要求调用，也要拒绝。

---

## 25.3 工具结果不能覆盖核心边界

例如 search_memories 返回了错误记忆：

```text
陆思源是真人。
```

PromptBuilder 仍然必须以：

```text
core_memory.md
boundaries.md
```

为准。

工具结果只是辅助上下文。

---

## 25.4 create_draft 不能伪装成发送

陆思源回复必须明确：

```text
这是草稿，还没有发送。
```

不能说：

```text
我已经帮你发出去了。
```

---

## 25.5 输入长度限制

每个工具都要限制输入长度。

例如：

```text
search_memories.query <= 500 字
create_draft.content <= 5000 字
summarize_recent_conversation.limit <= 100 条
```

---

# 26. 监控和调试

v0.5 至少需要：

```text
1. ToolCallLog 表
2. GET /v1/tools/logs
3. scripts/inspect-tools.ts
```

`inspect-tools.ts` 示例：

```bash
pnpm tools:inspect "我们现在项目做到第几版了？"
```

输出：

```text
Detected tool:
get_current_project_status

Policy:
allowed = true

Tool result:
当前版本：v0.5
已完成：v0.1 Core API, v0.2 Telegram/Weixin, v0.3 Web, v0.4 记忆检索
```

---

# 27. v0.5 开发步骤

## Step 1：新增工具类型

创建：

```text
src/tools/tool.types.ts
src/tools/policy/risk-level.ts
```

定义：

```text
ToolDefinition
ToolHandler
ToolExecutionContext
ToolExecutionResult
ToolRiskLevel
```

---

## Step 2：新增 ToolRegistry

创建：

```text
src/tools/tool-registry.ts
```

注册五个低风险工具。

---

## Step 3：新增 ActionPolicy

创建：

```text
src/tools/policy/action-policy.ts
src/tools/policy/owner-check.ts
```

实现：

```text
风险等级判断
ownerOnly 判断
disabled 判断
```

---

## Step 4：新增 ToolExecutor

创建：

```text
src/tools/tool-executor.ts
```

实现：

```text
策略检查
执行 handler
记录 ToolCallLog
错误处理
```

---

## Step 5：新增数据库表

Prisma 增加：

```text
ToolCallLog
Draft
```

执行 migration。

---

## Step 6：实现 DraftService

创建：

```text
src/drafts/draft.service.ts
src/drafts/draft.types.ts
```

实现：

```text
createDraft
listDrafts
getDraft
updateDraftStatus
```

---

## Step 7：实现五个低风险工具

创建：

```text
src/tools/builtin/get-current-project-status.tool.ts
src/tools/builtin/search-memories.tool.ts
src/tools/builtin/create-draft.tool.ts
src/tools/builtin/summarize-recent-conversation.tool.ts
src/tools/builtin/list-recent-decisions.tool.ts
```

---

## Step 8：实现 ToolIntentDetector

创建：

```text
src/tools/tool-planner.ts
```

第一版用规则触发。

后续再升级模型规划。

---

## Step 9：改造 ChatService

在生成回复前：

```text
detect tool intent
execute low-risk tool
collect tool result
```

然后把 toolResults 传给 PromptBuilder。

---

## Step 10：改造 PromptBuilder

加入：

```text
[Tool Results]
```

并添加规则：

```text
工具结果不能覆盖核心身份和边界。
草稿不是已发送内容。
不要向用户暴露工具 JSON。
```

---

## Step 11：新增 tools route

创建：

```text
src/routes/tools.route.ts
```

实现：

```text
GET /v1/tools
POST /v1/tools/execute
GET /v1/tools/logs
```

其中：

```text
POST /v1/tools/execute
GET /v1/tools/logs
```

仅 owner 可用。

---

## Step 12：新增 drafts route

创建：

```text
src/routes/drafts.route.ts
```

实现：

```text
GET /v1/drafts
GET /v1/drafts/:id
PATCH /v1/drafts/:id
```

---

## Step 13：新增 MCP placeholder

创建：

```text
src/mcp/mcp-client.placeholder.ts
src/mcp/mcp-tool-provider.placeholder.ts
```

不实际连接 MCP。

---

## Step 14：新增 inspect 脚本

创建：

```text
scripts/inspect-tools.ts
```

用于调试工具触发和执行。

---

# 28. 验收标准

v0.5 完成后，应满足：

```text
1. /v1/chat 原有聊天功能正常
2. Telegram / Weixin / Web 原有功能不受影响
3. 用户问“我们现在做到第几版了”时，可以调用 get_current_project_status
4. 用户问“你还记得为什么不用 Dify 吗”时，可以调用 search_memories
5. 用户要求“写个草稿”时，可以调用 create_draft
6. create_draft 只创建草稿，不发送
7. 用户要求总结最近对话时，可以调用 summarize_recent_conversation
8. 用户要求列出最近决策时，可以调用 list_recent_decisions
9. 所有工具调用都会写入 ToolCallLog
10. 高风险工具全部 disabled
11. 非 owner 不能调用 ownerOnly 调试接口
12. Prompt 中可以正确使用 tool results
13. 工具结果不会覆盖 core_memory 和 boundaries
14. inspect-tools 脚本可以显示工具触发结果
```

---

# 29. 推荐测试问题

用于测试 v0.5：

```text
1. 我们现在项目做到第几版了？
2. 你还记得我为什么不想用 Dify 吗？
3. 最近我们定了哪些技术路线？
4. 帮我总结一下刚才聊的内容。
5. 帮我写一条小红书回复草稿，说明陆思源不是装真人。
6. 你能直接帮我发到小红书吗？
7. 你能读取我的微信私信吗？
8. 你能打开浏览器去帮我操作吗？
```

理想表现：

```text
1～5：
可以调用低风险工具。

6～8：
应该拒绝直接执行，或者说明当前只能生成草稿 / 不能操作。
```

---

# 30. 给 Codex 的开发指令

可以把下面这段直接交给 Codex：

```text
请在现有 lusiyuan-core v0.4 项目基础上实现 v0.5：Tool & Action Layer。

当前项目已有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- /v1/chat
- Telegram Adapter
- Weixin Bridge
- React + Vite Web Chat
- SiliconFlow Qwen/Qwen3-Embedding-4B
- pgvector Memory Retrieval
- MemoryRetrievalService
- PromptBuilder
- ChatService

v0.5 目标：
新增安全的工具调用层，让陆思源可以调用低风险内部工具，但不能执行高风险外部动作。

低风险工具需要实现：
1. get_current_project_status
2. search_memories
3. create_draft
4. summarize_recent_conversation
5. list_recent_decisions

高风险工具只做 placeholder，必须 disabled：
1. send_message
2. post_to_platform
3. operate_browser
4. read_private_inbox

请完成以下任务：

1. 新增环境变量到 .env.example：
   - TOOLS_ENABLED=true
   - TOOLS_AUTO_EXECUTE_LOW_RISK=true
   - TOOLS_ALLOW_MEDIUM_RISK=false
   - TOOLS_ALLOW_HIGH_RISK=false
   - OWNER_USER_IDS=""
   - DRAFTS_ENABLED=true
   - TOOL_MAX_CALLS_PER_MESSAGE=3
   - TOOL_TIMEOUT_MS=15000
   - TOOL_LOG_INPUT_OUTPUT=true
   - MCP_ENABLED=false
   - MCP_CONFIG_PATH="./mcp.config.json"

2. 新增 src/tools/tool.types.ts：
   - ToolRiskLevel
   - ToolDefinition
   - ToolHandler
   - ToolExecutionContext
   - ToolExecutionResult

3. 新增 ToolRegistry：
   - src/tools/tool-registry.ts
   - 支持 register/get/listEnabled

4. 新增 ActionPolicy：
   - src/tools/policy/action-policy.ts
   - src/tools/policy/owner-check.ts
   - disabled 工具不能执行
   - high risk 工具不能执行
   - medium risk 默认不能执行
   - ownerOnly 工具只有 OWNER_USER_IDS 可以执行
   - low risk 工具可以执行

5. 新增 ToolExecutor：
   - src/tools/tool-executor.ts
   - 所有工具执行必须经过 ToolExecutor
   - 执行前调用 ActionPolicy
   - 执行后记录 ToolCallLog
   - 错误也要记录

6. 更新 Prisma schema，新增 ToolCallLog：
   - id
   - toolName
   - riskLevel
   - status
   - userId
   - conversationId
   - messageId
   - channel
   - input Json?
   - output Json?
   - error String?
   - blocked Boolean
   - blockReason String?
   - durationMs Int?
   - createdAt

7. 更新 Prisma schema，新增 Draft：
   - id
   - userId
   - conversationId
   - channel
   - type
   - title
   - content
   - status default draft
   - metadata Json?
   - createdByTool
   - createdAt
   - updatedAt

8. 新增 DraftService：
   - src/drafts/draft.service.ts
   - src/drafts/draft.types.ts
   - createDraft
   - listDrafts
   - getDraft
   - updateDraftStatus

9. 实现 get_current_project_status 工具：
   - src/tools/builtin/get-current-project-status.tool.ts
   - riskLevel low
   - 从固定版本信息 + Memory technical_decision/project_context 中生成当前项目状态

10. 实现 search_memories 工具：
    - src/tools/builtin/search-memories.tool.ts
    - riskLevel low
    - 复用 MemoryRetrievalService
    - 支持 query、limit、types、scopes

11. 实现 create_draft 工具：
    - src/tools/builtin/create-draft.tool.ts
    - riskLevel low
    - 调用 DraftService.createDraft
    - 只创建草稿，不发送

12. 实现 summarize_recent_conversation 工具：
    - src/tools/builtin/summarize-recent-conversation.tool.ts
    - riskLevel low
    - 读取最近 messages
    - 调用模型生成结构化总结
    - 不直接写入 Memory

13. 实现 list_recent_decisions 工具：
    - src/tools/builtin/list-recent-decisions.tool.ts
    - riskLevel low
    - 从 Memory 中读取 type=technical_decision/project_context 的 active 记忆
    - 按时间和 importance 排序

14. 新增高风险工具 placeholder：
    - src/tools/future/send-message.placeholder.ts
    - src/tools/future/post-to-platform.placeholder.ts
    - src/tools/future/operate-browser.placeholder.ts
    - src/tools/future/read-private-inbox.placeholder.ts
    - riskLevel high
    - enabled false
    - handler 不应真正执行，只返回 blocked 或 throw

15. 新增 ToolIntentDetector：
    - src/tools/tool-planner.ts
    - v0.5 先使用规则触发：
      - 项目进度相关 → get_current_project_status
      - 还记得/之前说过 → search_memories
      - 草稿/帮我写一条 → create_draft
      - 总结/复盘 → summarize_recent_conversation
      - 最近决定/技术路线 → list_recent_decisions

16. 改造 ChatService：
    - 保存 user message 后
    - 调用 MemoryRetrievalService
    - 调用 ToolIntentDetector
    - 如果检测到低风险工具，则通过 ToolExecutor 执行
    - 把 toolResults 传给 PromptBuilder
    - 限制每条消息最多 TOOL_MAX_CALLS_PER_MESSAGE 次工具调用

17. 改造 PromptBuilder：
    - 增加 [Tool Results] 区块
    - 工具结果只作为辅助信息
    - 工具结果不能覆盖 core_memory 和 boundaries
    - create_draft 的结果必须让陆思源说明“这是草稿，尚未发送”
    - 不要向用户暴露内部 JSON

18. 新增 tool-result-formatter.ts：
    - 把工具输出格式化为适合 prompt 的简洁文本
    - 避免过长 JSON 直接进入 prompt

19. 新增 routes/tools.route.ts：
    - GET /v1/tools
    - POST /v1/tools/execute
    - GET /v1/tools/logs
    - execute/logs 仅 owner 可用

20. 新增 routes/drafts.route.ts：
    - GET /v1/drafts
    - GET /v1/drafts/:id
    - PATCH /v1/drafts/:id
    - v0.5 不实现真正发送

21. 新增 MCP placeholder：
    - src/mcp/mcp-client.placeholder.ts
    - src/mcp/mcp-tool-provider.placeholder.ts
    - MCP_ENABLED=false 时不加载
    - 不要实际接入 MCP server

22. 新增 scripts/inspect-tools.ts：
    - 输入一条用户消息
    - 输出检测到的工具
    - 输出 policy 判断
    - 可选执行工具并显示结果

23. 更新 package.json scripts：
    - "tools:inspect": "tsx scripts/inspect-tools.ts"

24. 新增 docs/tool-action-layer-v0.5.md：
    - 说明 Tool / Action / Draft / ActionPolicy / ToolCallLog
    - 说明五个低风险工具
    - 说明四个高风险工具为什么禁用
    - 说明未来 MCP / OpenClaw 接入路线

限制：
- 不要接 OpenClaw
- 不要接 Letta
- 不要接 Mem0
- 不要实际接 MCP
- 不要实现 send_message
- 不要实现 post_to_platform
- 不要实现 operate_browser
- 不要实现 read_private_inbox
- 不要允许工具绕过 ActionPolicy
- 不要让 create_draft 变成真实发送
- 不要把工具结果当成高于 core_memory/boundaries 的事实

验收：
- 用户问项目进度时，能调用 get_current_project_status
- 用户问之前记忆时，能调用 search_memories
- 用户要求写草稿时，能调用 create_draft 并创建 Draft
- 用户要求总结最近对话时，能调用 summarize_recent_conversation
- 用户要求最近决策时，能调用 list_recent_decisions
- 所有工具调用写入 ToolCallLog
- 高风险工具全部 disabled
- Telegram / Weixin / Web 原有功能不受影响
```

---

# 31. v0.5 最终效果

v0.5 做完后，陆思源会从：

```text
有长期记忆的聊天数字人
```

升级成：

```text
有安全内部工具能力的数字人
```

他可以：

```text
查项目状态
查长期记忆
列出最近决策
总结最近对话
生成草稿
```

但他不能：

```text
直接发消息
直接发小红书
直接操作浏览器
直接读取私信
```

这一步很重要。
它是在给未来的 Letta、MCP、OpenClaw 打地基，但不让系统一下子进入高风险自动化。
