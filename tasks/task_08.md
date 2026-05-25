下面是 **陆思源 Core API v0.8：OpenClaw Action Gateway 技术开发文档**。
这一版的核心目标是：**让陆思源开始“看见外部世界”，但不允许他失控地自动发送、发布、点击、读取隐私。**

OpenClaw 在这里不是陆思源的大脑，而是外部行动网关。OpenClaw 官方对自己的定位是 self-hosted gateway，用来连接聊天应用、channel surfaces 和 AI agents；Gateway 是通道、路由和常驻 assistant 的桥接层。([OpenClaw][1])

---

# 陆思源 Core API 技术方案文档 v0.8：OpenClaw Action Gateway

## 1. v0.8 目标

前面版本已经规划了：

```text
v0.1：Lusiyuan Core API
v0.2：Telegram + Weixin 接入
v0.3：Web Chat 网页入口
v0.4：SiliconFlow Qwen/Qwen3-Embedding-4B + pgvector 记忆检索
v0.5：Tool & Action Layer
v0.6：Letta Creator Assistant
v0.7：Letta Reflection Agent
```

v0.8 的目标是：

```text
让陆思源通过 OpenClaw 接触外部世界。
```

但这个“接触”在第一版里只包括：

```text
1. 读取外部信息
2. 收集外部 inbox / 评论 / 消息摘要
3. 浏览网页并提取内容
4. 生成回复草稿
5. 生成运营日报
6. 等待人工审核
```

v0.8 不允许：

```text
1. 自动发送私信
2. 自动发布小红书 / B站 / 微博 / X / 网站内容
3. 自动点击危险按钮
4. 自动删除、提交、购买、付款
5. 自动读取未授权私密信息
6. 自动绕过平台规则
7. 自动修改陆思源核心人设
8. 自动写入正式长期记忆
```

v0.8 的一句话目标：

```text
OpenClaw 负责“看见和搬运外部信息”，Lusiyuan Core API 负责“理解、判断、生成草稿和审批流”。
```

---

# 2. OpenClaw 在本项目里的定位

OpenClaw 官方文档提到，它的 Gateway 配置常用于连接 channels、控制谁能给 bot 发消息、设置 models / tools / sandboxing / automation、调整 sessions / media / networking / UI 等。([OpenClaw][2])
OpenClaw 的 plugin 文档也说明，plugins 可以扩展 channels、model providers、agent harnesses、tools、skills、speech、media understanding、web fetch、web search 等运行时能力。([OpenClaw][3])

所以在陆思源项目里，OpenClaw 适合做：

```text
1. 外部 channel / inbox 连接层
2. 浏览器 / 网页读取层
3. 自动化触发层
4. 定时任务层
5. 外部工具运行层
6. 未来的 MCP / skill / browser 操作桥
```

但它不适合做：

```text
1. 陆思源主脑
2. 陆思源核心人格系统
3. 陆思源正式长期记忆主库
4. 陆思源对外说话的最终决策者
```

正确架构是：

```text
Lusiyuan Core API = 大脑 / 人格 / 记忆 / 审核 / 决策
OpenClaw = 外部行动网关 / 手脚 / 外部世界连接器
```

不要变成：

```text
OpenClaw = 陆思源本人
```

---

# 3. v0.8 核心边界

v0.8 必须遵守：

```text
1. OpenClaw 不直接回复普通用户，除非 Core API 明确返回可发送内容。
2. OpenClaw 不直接写入 Memory 表。
3. OpenClaw 不直接修改 persona/*.md。
4. OpenClaw 不绕过 v0.5 ActionPolicy。
5. OpenClaw 不执行 high-risk action。
6. 所有外部动作必须有 ExternalActionRequest。
7. 所有外部动作必须有 ExternalActionLog。
8. 所有需要外部影响的动作必须进入 ApprovalQueue。
```

尤其注意安全。OpenClaw 这类可访问文件、命令、浏览器、消息平台的 agent 工具，历史上已经出现过第三方 skill / extension 安全风险和恶意扩展问题；因此 v0.8 必须采用 allowlist、隔离运行、人工确认、日志审计这些保守设计。([The Verge][4])

---

# 4. v0.8 不做什么

v0.8 明确不做：

```text
1. 不允许自动 send_message
2. 不允许自动 post_to_platform
3. 不允许自动 operate_browser 执行写操作
4. 不允许自动 read_private_inbox 全量读取
5. 不接未经审核的第三方 OpenClaw skills
6. 不允许 OpenClaw 直接访问数据库写入 Memory
7. 不允许 OpenClaw 直接改 Draft 状态为 sent
8. 不允许 OpenClaw 直接调用高风险工具
9. 不允许 OpenClaw 直接操作小红书发布
10. 不允许 OpenClaw 自动回复微信私信
```

v0.8 只做：

```text
1. Inbox / comment / webpage 的受控读取
2. 信息归档
3. 摘要生成
4. 草稿生成
5. 人工审核
6. 审计日志
```

---

# 5. 总体架构

v0.7 后：

```text
Web / Telegram / Weixin
↓
Lusiyuan Core API
├── ChatService
├── MemoryRetrievalService
├── Tool & Action Layer
├── Letta Creator Assistant
└── Letta Reflection Agent
```

v0.8 新增：

```text
OpenClaw Gateway
↓
OpenClaw Bridge
↓
Lusiyuan Core API
├── ExternalInboxService
├── ExternalActionService
├── ApprovalService
├── OpenClawActionGateway
├── OpenClawAuditService
└── DraftService
```

核心流向有两条。

---

## 5.1 外部信息进入 Core API

```text
OpenClaw 收集外部信息
↓
POST /v1/openclaw/events
↓
ExternalInboxItem 入库
↓
Core API 生成摘要 / 草稿
↓
Draft 表保存
↓
等待人工审核
```

例如：

```text
OpenClaw 读取小红书评论
↓
发给 Lusiyuan Core API
↓
系统保存 ExternalInboxItem
↓
陆思源生成回复草稿
↓
你审核
```

---

## 5.2 Core API 请求 OpenClaw 执行动作

```text
用户 / 管理员 / Tool Layer 发起动作请求
↓
ActionPolicy 判断风险
↓
ExternalActionRequest 入库
↓
需要审核则进入 ApprovalQueue
↓
审核通过后
↓
OpenClawActionGateway 调 OpenClaw
↓
OpenClaw 执行
↓
回写 ExternalActionLog
```

v0.8 默认只允许执行低风险动作：

```text
read_page
collect_inbox_summary
fetch_comments
capture_page_snapshot
```

不允许执行：

```text
send_message
publish_post
click_submit
delete_item
read_full_private_inbox
```

---

# 6. 推荐目录结构

在现有项目基础上新增：

```text
src/
├── openclaw/
│   ├── openclaw-client.ts
│   ├── openclaw-config.ts
│   ├── openclaw.types.ts
│   ├── openclaw-event-normalizer.ts
│   ├── openclaw-action-gateway.ts
│   ├── openclaw-inbox.service.ts
│   ├── openclaw-browser.service.ts
│   ├── openclaw-audit.service.ts
│   ├── openclaw-security.ts
│   └── openclaw-signature.ts
│
├── external-actions/
│   ├── external-action.service.ts
│   ├── external-action.types.ts
│   ├── external-action-policy.ts
│   ├── external-action-runner.ts
│   └── external-action-result-handler.ts
│
├── approvals/
│   ├── approval.service.ts
│   ├── approval.types.ts
│   └── approval-policy.ts
│
├── external-inbox/
│   ├── external-inbox.service.ts
│   ├── external-inbox.types.ts
│   ├── external-inbox-deduper.ts
│   └── external-inbox-summarizer.ts
│
├── routes/
│   ├── openclaw.route.ts
│   ├── external-actions.route.ts
│   ├── external-inbox.route.ts
│   └── approvals.route.ts
│
├── scripts/
│   ├── inspect-openclaw-events.ts
│   ├── inspect-external-actions.ts
│   ├── run-openclaw-digest.ts
│   └── test-openclaw-bridge.ts
│
└── docs/
    └── openclaw-action-gateway-v0.8.md
```

---

# 7. 环境变量设计

`.env.example` 增加：

```env
# OpenClaw
OPENCLAW_ENABLED=false
OPENCLAW_BASE_URL="http://localhost:7331"
OPENCLAW_API_KEY=""
OPENCLAW_BRIDGE_SECRET=""
OPENCLAW_WEBHOOK_SECRET=""
OPENCLAW_ALLOWED_EVENT_TYPES="inbox_message,comment,page_snapshot,browser_read_result"

# OpenClaw Safety
OPENCLAW_ALLOW_READ_ONLY=true
OPENCLAW_ALLOW_BROWSER_WRITE=false
OPENCLAW_ALLOW_SEND_MESSAGE=false
OPENCLAW_ALLOW_PUBLISH=false
OPENCLAW_ALLOW_PRIVATE_INBOX_FULL_READ=false

# External Actions
EXTERNAL_ACTIONS_ENABLED=true
EXTERNAL_ACTIONS_REQUIRE_APPROVAL=true
EXTERNAL_ACTIONS_AUTO_RUN_LOW_RISK=false
EXTERNAL_ACTIONS_MAX_PER_HOUR=20
EXTERNAL_ACTION_TIMEOUT_MS=30000

# Approval
APPROVAL_ENABLED=true
APPROVAL_OWNER_ONLY=true
APPROVAL_EXPIRES_HOURS=72

# External Inbox
EXTERNAL_INBOX_ENABLED=true
EXTERNAL_INBOX_AUTO_SUMMARIZE=true
EXTERNAL_INBOX_AUTO_CREATE_DRAFT=true
EXTERNAL_INBOX_MAX_ITEMS_PER_SYNC=50

# Browser read-only
BROWSER_READ_ONLY_ENABLED=true
BROWSER_CAPTURE_SCREENSHOT=false
BROWSER_MAX_PAGE_TEXT_CHARS=12000

# Security
OPENCLAW_REQUIRE_SIGNATURE=true
OPENCLAW_REJECT_UNKNOWN_SOURCES=true
OPENCLAW_LOG_RAW_PAYLOAD=true
```

说明：

```text
OPENCLAW_ENABLED：
是否启用 OpenClaw 集成。

OPENCLAW_BRIDGE_SECRET：
OpenClaw 调 Core API 时必须携带的 secret。

OPENCLAW_ALLOW_BROWSER_WRITE=false：
v0.8 禁止浏览器写操作。

OPENCLAW_ALLOW_SEND_MESSAGE=false：
v0.8 禁止自动发消息。

OPENCLAW_ALLOW_PUBLISH=false：
v0.8 禁止自动发布。

EXTERNAL_ACTIONS_REQUIRE_APPROVAL=true：
所有外部动作默认进入审核。

EXTERNAL_ACTIONS_AUTO_RUN_LOW_RISK=false：
即使低风险动作，v0.8 也建议先手动触发，稳定后再打开。
```

---

# 8. OpenClaw 安装与连接说明

## 8.1 OpenClaw Gateway

OpenClaw 是一个自托管 gateway，你可以在自己的机器或服务器上运行单个 Gateway process，把消息平台和 AI assistant 连接起来。([OpenClaw][1])

v0.8 文档中只要求：

```text
1. OpenClaw Gateway 可运行
2. Core API 可以访问 OpenClaw Gateway
3. OpenClaw 可以向 Core API 发送 event webhook
4. OpenClaw 的危险 skills / plugins 不默认启用
```

---

## 8.2 WeChat / Weixin 插件

你前面已经提到微信插件安装命令。OpenClaw 官方 WeChat 文档和 Tencent/openclaw-weixin 仓库都列出了 quick install：

```bash
npx -y @tencent-weixin/openclaw-weixin-cli install
```

以及手动安装：

```bash
openclaw plugins install "@tencent-weixin/openclaw-weixin"
openclaw config set plugins.entries.openclaw-weixin.enabled true
openclaw gateway restart
```

官方文档也说明安装后需要重启 Gateway。([OpenClaw][5])

但 v0.8 里要注意：

```text
Weixin 插件只负责接入微信通道。
是否回复、如何回复，必须由 Lusiyuan Core API 决定。
```

---

## 8.3 Hooks / Automation

OpenClaw hooks 是 Gateway 内部发生事件时运行的小脚本，官方文档说 hooks 可以从目录中发现，并用 `openclaw hooks` 检查。([OpenClaw][6])
v0.8 可以利用 hooks 做：

```text
1. 收到外部消息后转发给 Core API
2. 定时收集摘要
3. 浏览器读取结果回传
```

但 v0.8 不建议用 hooks 直接执行高风险动作。

---

# 9. 数据库设计

v0.8 需要新增四类核心表：

```text
ExternalInboxItem
ExternalActionRequest
ExternalActionLog
ApprovalRequest
```

可选新增：

```text
OpenClawEventLog
OpenClawAccount
ExternalSource
```

---

## 9.1 ExternalInboxItem

用于保存从外部平台收集到的消息、评论、通知、网页内容等。

```prisma
model ExternalInboxItem {
  id                String   @id @default(cuid())

  source            String
  sourceAccountId   String?
  sourceUserId      String?
  sourceUserName    String?

  externalItemId    String?
  externalThreadId  String?
  externalUrl       String?

  itemType          String
  title             String?
  content           String
  summary           String?

  rawPayload        Json?
  metadata          Json?

  status            String   @default("new")
  riskLevel         String   @default("low")

  linkedDraftId     String?
  linkedConversationId String?

  receivedAt        DateTime @default(now())
  processedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([source])
  @@index([itemType])
  @@index([status])
  @@index([externalItemId])
  @@index([externalThreadId])
  @@index([receivedAt])
}
```

字段说明：

```text
source：
来源平台，例如 xiaohongshu、weixin、telegram、web、browser、website。

itemType：
comment、private_message、mention、page_snapshot、notification、search_result。

status：
new、summarized、draft_created、ignored、archived、error。

riskLevel：
low、medium、high。
```

重要约束建议：

```text
source + externalItemId 应尽量唯一，避免重复入库。
```

---

## 9.2 ExternalActionRequest

用于保存准备交给 OpenClaw 执行的动作请求。

```prisma
model ExternalActionRequest {
  id              String   @id @default(cuid())

  actionType      String
  source          String?
  target          String?
  title           String?
  description     String?

  input           Json
  plannedOutput   Json?
  riskLevel       String

  status          String   @default("pending_approval")
  requiresApproval Boolean @default(true)

  requestedBy     String?
  requestedFrom   String?
  relatedDraftId  String?
  relatedInboxItemId String?

  approvedBy      String?
  approvedAt      DateTime?
  rejectedBy      String?
  rejectedAt      DateTime?
  rejectReason    String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  executedAt      DateTime?
  completedAt     DateTime?

  logs            ExternalActionLog[]

  @@index([actionType])
  @@index([status])
  @@index([riskLevel])
  @@index([createdAt])
}
```

`actionType` 示例：

```text
read_page
fetch_comments
collect_inbox_summary
capture_page_snapshot
create_reply_draft
send_message
publish_post
browser_click
browser_fill_form
```

v0.8 允许：

```text
read_page
fetch_comments
collect_inbox_summary
capture_page_snapshot
create_reply_draft
```

v0.8 禁止：

```text
send_message
publish_post
browser_click
browser_fill_form
```

---

## 9.3 ExternalActionLog

记录外部动作执行结果。

```prisma
model ExternalActionLog {
  id              String   @id @default(cuid())

  actionRequestId String
  status          String

  provider        String   @default("openclaw")
  requestPayload  Json?
  responsePayload Json?
  error           String?

  startedAt       DateTime?
  completedAt     DateTime?
  durationMs      Int?

  createdAt       DateTime @default(now())

  actionRequest   ExternalActionRequest @relation(fields: [actionRequestId], references: [id], onDelete: Cascade)

  @@index([actionRequestId])
  @@index([status])
  @@index([createdAt])
}
```

`status`：

```text
queued
running
success
failed
blocked
timeout
```

---

## 9.4 ApprovalRequest

统一审核队列。

```prisma
model ApprovalRequest {
  id              String   @id @default(cuid())

  targetType      String
  targetId        String

  title           String?
  description     String?
  riskLevel       String

  status          String   @default("pending")

  requestedBy     String?
  approvedBy      String?
  approvedAt      DateTime?
  rejectedBy      String?
  rejectedAt      DateTime?
  rejectReason    String?

  expiresAt       DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([targetType])
  @@index([targetId])
  @@index([status])
  @@index([riskLevel])
  @@index([createdAt])
}
```

`targetType`：

```text
external_action
draft
memory_proposal
reflection_proposal
```

v0.8 主要用于：

```text
external_action
draft
```

---

## 9.5 OpenClawEventLog

建议新增，用于保存 OpenClaw 原始事件。

```prisma
model OpenClawEventLog {
  id              String   @id @default(cuid())

  eventType       String
  source          String?
  externalEventId String?

  payload         Json
  normalized      Json?
  status          String   @default("received")
  error           String?

  receivedAt      DateTime @default(now())
  processedAt     DateTime?

  @@index([eventType])
  @@index([source])
  @@index([externalEventId])
  @@index([status])
  @@index([receivedAt])
}
```

作用：

```text
1. 调试 OpenClaw 事件
2. 幂等处理
3. 排查重复消息
4. 安全审计
```

---

# 10. OpenClaw Event 设计

OpenClaw 进入 Core API 的事件统一走：

```http
POST /v1/openclaw/events
```

请求 header：

```http
X-Lusiyuan-OpenClaw-Secret: <secret>
X-Lusiyuan-OpenClaw-Signature: <signature>
```

v0.8 至少实现 secret 校验。
如果时间允许，实现 HMAC signature。

---

## 10.1 Event 格式

```ts
export interface OpenClawIncomingEvent {
  event_id?: string;
  event_type:
    | "inbox_message"
    | "comment"
    | "page_snapshot"
    | "browser_read_result"
    | "search_result"
    | "notification";

  source: string;
  source_account_id?: string;

  external_user_id?: string;
  external_user_name?: string;
  external_item_id?: string;
  external_thread_id?: string;
  external_url?: string;

  title?: string;
  text?: string;
  html?: string;
  screenshot_url?: string;

  raw?: unknown;
  metadata?: Record<string, unknown>;

  occurred_at?: string;
}
```

---

## 10.2 示例：评论事件

```json
{
  "event_id": "xhs_comment_001",
  "event_type": "comment",
  "source": "xiaohongshu",
  "source_account_id": "lusiyuan_official",
  "external_user_id": "user_123",
  "external_user_name": "某个用户",
  "external_item_id": "comment_123",
  "external_thread_id": "post_456",
  "external_url": "https://example.com/post/456",
  "text": "这个陆思源是真人吗？",
  "metadata": {
    "post_title": "我创造了一个 AI 数字人"
  }
}
```

处理后：

```text
1. 写入 OpenClawEventLog
2. 归一化成 ExternalInboxItem
3. 保存 ExternalInboxItem
4. 可选生成摘要
5. 可选生成 Draft
```

---

## 10.3 示例：网页读取事件

```json
{
  "event_id": "browser_read_001",
  "event_type": "page_snapshot",
  "source": "browser",
  "external_url": "https://example.com/article",
  "title": "某篇文章",
  "text": "网页正文内容……",
  "metadata": {
    "captured_by": "openclaw",
    "read_mode": "text"
  }
}
```

处理后：

```text
1. 保存为 ExternalInboxItem itemType=page_snapshot
2. 自动摘要
3. 不写入 Memory
4. 不自动发布任何内容
```

---

# 11. OpenClaw Client 设计

`openclaw-client.ts` 封装和 OpenClaw 的通信。
由于 OpenClaw 具体工具调用方式可能随版本变化，v0.8 不要把调用方式写死在业务层。

接口：

```ts
export interface OpenClawClient {
  health(): Promise<OpenClawHealth>;

  runReadOnlyAction(input: OpenClawReadOnlyActionInput): Promise<OpenClawActionResult>;

  runBrowserRead(input: OpenClawBrowserReadInput): Promise<OpenClawActionResult>;

  fetchChannelItems(input: OpenClawFetchChannelItemsInput): Promise<OpenClawActionResult>;
}
```

v0.8 不实现：

```ts
sendMessage()
publishPost()
browserClick()
browserFillForm()
```

即使写 placeholder，也必须 throw：

```ts
throw new Error("High-risk OpenClaw action is disabled in v0.8");
```

---

# 12. ExternalActionPolicy

v0.5 已经有 ActionPolicy。
v0.8 新增更具体的 ExternalActionPolicy。

输入：

```ts
export interface ExternalActionPolicyInput {
  actionType: string;
  source?: string;
  riskLevel: "low" | "medium" | "high";
  input: unknown;
  requestedBy?: string;
  isOwner: boolean;
}
```

输出：

```ts
export interface ExternalActionPolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}
```

---

## 12.1 v0.8 策略

允许：

```text
read_page
fetch_comments
collect_inbox_summary
capture_page_snapshot
create_reply_draft
```

必须审核：

```text
任何会产生外部影响的动作
任何 medium risk 动作
任何 source = private_inbox 的动作
```

禁止：

```text
send_message
publish_post
browser_click
browser_fill_form
browser_submit
delete_item
purchase
payment
read_private_inbox_full
```

伪代码：

```ts
if (!OPENCLAW_ENABLED) deny("OpenClaw disabled");

if (riskLevel === "high") deny("High-risk external actions disabled in v0.8");

if (actionType in ["send_message", "publish_post", "browser_click", "browser_fill_form"]) {
  deny("Write actions are disabled in v0.8");
}

if (actionType === "read_private_inbox_full") {
  deny("Full private inbox read is disabled in v0.8");
}

if (riskLevel === "medium") {
  return { allowed: true, requiresApproval: true };
}

if (riskLevel === "low") {
  return {
    allowed: true,
    requiresApproval: EXTERNAL_ACTIONS_REQUIRE_APPROVAL
  };
}
```

---

# 13. ExternalInboxService

负责处理外部消息 / 评论 / 网页内容。

方法：

```ts
export class ExternalInboxService {
  async ingestOpenClawEvent(event: OpenClawIncomingEvent): Promise<ExternalInboxItem>;

  async summarizeItem(itemId: string): Promise<ExternalInboxItem>;

  async createDraftForItem(itemId: string): Promise<Draft>;

  async listItems(input: ListExternalInboxItemsInput): Promise<ExternalInboxItem[]>;

  async markIgnored(itemId: string): Promise<void>;

  async archiveItem(itemId: string): Promise<void>;
}
```

---

## 13.1 ingestOpenClawEvent

流程：

```text
1. 校验 event_type 是否允许
2. 写入 OpenClawEventLog
3. 检查 external_item_id 是否重复
4. 归一化为 ExternalInboxItem
5. 保存
6. 如果 EXTERNAL_INBOX_AUTO_SUMMARIZE=true，生成 summary
7. 如果 EXTERNAL_INBOX_AUTO_CREATE_DRAFT=true 且 itemType 是 comment/message，生成 Draft
```

---

## 13.2 summarizeItem

使用 ModelProvider 生成摘要。

Prompt：

```text
请总结这条外部信息。不要回复对方，不要生成发送内容。
只输出：
1. 主要内容
2. 用户意图
3. 是否需要回复
4. 风险等级
5. 建议动作
```

输出保存到：

```text
ExternalInboxItem.summary
ExternalInboxItem.riskLevel
```

---

## 13.3 createDraftForItem

调用 v0.5 的 DraftService。

例如评论：

```text
“陆思源是真人吗？”
```

生成草稿：

```text
谢谢你认真看完。陆思源不是在装真人，他是一个原创 AI 数字人。我更希望大家把他当作一个被认真塑造的数字人来看，而不是一个假装真人的账号。
```

注意：

```text
这里只创建 Draft。
不发送。
不发布。
不调用 OpenClaw 写操作。
```

---

# 14. ExternalActionService

负责创建和管理外部动作请求。

方法：

```ts
export class ExternalActionService {
  async createActionRequest(input: CreateExternalActionRequestInput): Promise<ExternalActionRequest>;

  async approveAction(actionId: string, reviewerId: string): Promise<ExternalActionRequest>;

  async rejectAction(actionId: string, reviewerId: string, reason?: string): Promise<ExternalActionRequest>;

  async runApprovedAction(actionId: string): Promise<ExternalActionLog>;

  async listActions(input: ListExternalActionsInput): Promise<ExternalActionRequest[]>;
}
```

---

## 14.1 createActionRequest

流程：

```text
1. 根据 actionType 判断 riskLevel
2. 调 ExternalActionPolicy
3. 如果 denied，创建 blocked log 或直接返回错误
4. 如果 requiresApproval，创建 ApprovalRequest
5. 保存 ExternalActionRequest
```

---

## 14.2 runApprovedAction

流程：

```text
1. 检查 ExternalActionRequest.status
2. 必须是 approved 或 low-risk allowed
3. 再次调用 ExternalActionPolicy
4. 调 OpenClawActionGateway
5. 写 ExternalActionLog
6. 更新 ExternalActionRequest.status
```

---

# 15. OpenClawActionGateway

这是 Core API 和 OpenClaw 执行层之间的核心桥。

```ts
export class OpenClawActionGateway {
  async execute(action: ExternalActionRequest): Promise<ExternalActionLog> {
    switch (action.actionType) {
      case "read_page":
        return this.runReadPage(action);

      case "fetch_comments":
        return this.runFetchComments(action);

      case "collect_inbox_summary":
        return this.runCollectInboxSummary(action);

      case "capture_page_snapshot":
        return this.runCapturePageSnapshot(action);

      default:
        throw new Error(`Unsupported or disabled action: ${action.actionType}`);
    }
  }
}
```

v0.8 中所有写操作都不进入 switch。

---

# 16. 支持的低风险 Action

## 16.1 read_page

用途：

```text
读取网页正文。
```

输入：

```json
{
  "url": "https://example.com/article",
  "mode": "text"
}
```

输出：

```json
{
  "title": "网页标题",
  "text": "网页正文",
  "url": "https://example.com/article"
}
```

限制：

```text
1. 不点击按钮
2. 不登录
3. 不提交表单
4. 不读取需要授权的页面
```

---

## 16.2 fetch_comments

用途：

```text
读取某个平台帖子下面的评论。
```

输入：

```json
{
  "platform": "xiaohongshu",
  "post_url": "https://example.com/post/123",
  "limit": 20
}
```

输出：

```json
{
  "comments": [
    {
      "external_id": "comment_1",
      "author": "用户A",
      "text": "这个是真人吗？"
    }
  ]
}
```

限制：

```text
1. 只读
2. 不回复
3. 不点赞
4. 不删除
5. 不关注
```

---

## 16.3 collect_inbox_summary

用途：

```text
收集 inbox 摘要。
```

v0.8 只允许摘要，不允许读取完整私信长期保存。

输入：

```json
{
  "platform": "weixin",
  "mode": "summary",
  "limit": 20
}
```

输出：

```json
{
  "summary": "今天有 3 条与陆思源是否真人有关的消息，1 条询问合作，2 条普通互动。",
  "items_count": 6
}
```

限制：

```text
1. 不保存完整私信正文，除非明确授权
2. 不自动回复
3. 不把隐私写入 Memory
```

---

## 16.4 capture_page_snapshot

用途：

```text
保存网页快照或截图信息。
```

v0.8 默认：

```env
BROWSER_CAPTURE_SCREENSHOT=false
```

如果开启，也只用于调试和人工查看。

---

## 16.5 create_reply_draft

用途：

```text
为 ExternalInboxItem 创建回复草稿。
```

这个动作其实可以完全在 Core API 内执行，不一定调用 OpenClaw。

输入：

```json
{
  "inbox_item_id": "external_inbox_xxx",
  "tone": "natural"
}
```

输出：

```json
{
  "draft_id": "draft_xxx",
  "content": "..."
}
```

---

# 17. API 设计

## 17.1 OpenClaw event webhook

```http
POST /v1/openclaw/events
```

用途：

```text
OpenClaw 把外部事件推给 Core API。
```

请求：

```json
{
  "event_id": "comment_001",
  "event_type": "comment",
  "source": "xiaohongshu",
  "external_item_id": "comment_123",
  "external_thread_id": "post_456",
  "external_user_name": "用户A",
  "text": "陆思源是真人吗？",
  "raw": {}
}
```

响应：

```json
{
  "ok": true,
  "inbox_item_id": "ext_inbox_xxx",
  "draft_created": true,
  "draft_id": "draft_xxx"
}
```

---

## 17.2 查看外部 inbox

```http
GET /v1/external-inbox
```

query：

```text
source
itemType
status
riskLevel
limit
```

响应：

```json
{
  "items": [
    {
      "id": "ext_inbox_xxx",
      "source": "xiaohongshu",
      "itemType": "comment",
      "content": "陆思源是真人吗？",
      "summary": "用户询问陆思源是否是真人。",
      "status": "draft_created"
    }
  ]
}
```

owner only。

---

## 17.3 查看单个 inbox item

```http
GET /v1/external-inbox/:id
```

---

## 17.4 为 inbox item 创建草稿

```http
POST /v1/external-inbox/:id/create-draft
```

请求：

```json
{
  "tone": "natural",
  "instruction": "解释陆思源是原创 AI 数字人，不装真人。"
}
```

响应：

```json
{
  "draft_id": "draft_xxx",
  "content": "..."
}
```

---

## 17.5 创建外部动作请求

```http
POST /v1/external-actions
```

请求：

```json
{
  "action_type": "read_page",
  "source": "browser",
  "target": "https://example.com/article",
  "input": {
    "url": "https://example.com/article",
    "mode": "text"
  }
}
```

响应：

```json
{
  "action_id": "action_xxx",
  "status": "pending_approval",
  "requires_approval": true
}
```

---

## 17.6 批准外部动作

```http
POST /v1/external-actions/:id/approve
```

owner only。

---

## 17.7 拒绝外部动作

```http
POST /v1/external-actions/:id/reject
```

请求：

```json
{
  "reason": "这个动作涉及登录态页面，暂不允许。"
}
```

---

## 17.8 运行已批准动作

```http
POST /v1/external-actions/:id/run
```

要求：

```text
1. action.status = approved
2. actionType 在 v0.8 allowlist 内
3. ExternalActionPolicy 再次通过
```

---

## 17.9 查看外部动作日志

```http
GET /v1/external-actions/:id/logs
```

---

## 17.10 审核队列

```http
GET /v1/approvals
POST /v1/approvals/:id/approve
POST /v1/approvals/:id/reject
```

---

# 18. 与 v0.5 Tool Layer 的关系

v0.8 不应该绕过 v0.5 的 Tool & Action Layer。

v0.5 已经有：

```text
ToolRegistry
ToolExecutor
ActionPolicy
DraftService
ToolCallLog
```

v0.8 应该新增外部工具，但仍纳入这套体系。

新增低风险工具：

```text
openclaw_read_page
openclaw_fetch_comments
openclaw_collect_inbox_summary
openclaw_create_reply_draft
```

这些工具应该：

```text
1. 注册到 ToolRegistry
2. riskLevel = low 或 medium
3. 经过 ActionPolicy
4. 写 ToolCallLog
5. 如果涉及外部动作，创建 ExternalActionRequest
```

不要让 ChatService 直接调用 OpenClawClient。

错误：

```ts
await openClawClient.runBrowserRead(...)
```

正确：

```ts
await toolExecutor.execute({
  toolName: "openclaw_read_page",
  input,
  context
});
```

---

# 19. 与 v0.7 Reflection Agent 的关系

Reflection Agent 可以读取：

```text
ExternalInboxItem
ExternalActionRequest
ExternalActionLog
Draft
```

用于复盘：

```text
1. 外部评论里是否有人误解陆思源是真人
2. 草稿是否符合人设
3. 是否出现越权动作请求
4. 是否有平台风险
5. 是否需要新增 persona_feedback 或 technical_decision proposal
```

但 Reflection Agent 不能：

```text
1. 自动批准 ExternalActionRequest
2. 自动发送草稿
3. 自动发布内容
```

---

# 20. 与 v0.6 Creator Assistant 的关系

Creator Assistant 可以帮助你查看外部运营情况。

例如你问：

```text
最近外部评论主要在问什么？
```

它可以基于 ExternalInboxItem 总结：

```text
最近评论主要集中在：
1. 陆思源是否是真人
2. 数字人如何制作
3. 图像是否 AI 生成
4. 后续是否会有声音
```

这对运营非常有用。

---

# 21. Web 管理页设计

v0.8 建议新增管理页面：

```text
/admin/openclaw
/admin/external-inbox
/admin/external-actions
/admin/approvals
```

如果不想拆很多页面，可以先做一个：

```text
/admin/action-gateway
```

页面结构：

```text
/admin/action-gateway

┌─────────────────────────────────┐
│ OpenClaw Action Gateway          │
│ 状态：connected / disabled       │
├─────────────────────────────────┤
│ External Inbox                   │
│ - 评论                           │
│ - 私信摘要                       │
│ - 网页快照                       │
├─────────────────────────────────┤
│ Drafts                           │
│ - 回复草稿                       │
│ - 内容草稿                       │
├─────────────────────────────────┤
│ Approval Queue                   │
│ - 待批准外部动作                 │
├─────────────────────────────────┤
│ Action Logs                      │
└─────────────────────────────────┘
```

v0.8 前端必做：

```text
1. 查看 external inbox
2. 查看 draft
3. 查看 approval queue
4. approve / reject
5. 查看 action logs
```

v0.8 前端不做：

```text
1. 直接发送
2. 直接发布
3. 浏览器实时远程控制台
```

---

# 22. 安全设计

## 22.1 OpenClaw 运行隔离

建议：

```text
1. OpenClaw 单独运行在隔离用户下
2. 不要给 OpenClaw 访问整个主机文件系统
3. 不要安装来源不明的 skills/plugins
4. 不要把生产 API key 放进 OpenClaw 可读取的目录
5. OpenClaw 和 Core API 用最小权限 token 通信
```

第三方 OpenClaw skills 曾被报道存在恶意代码、窃取凭据等风险，因此不要随便安装社区 skill，也不要让 skill 获得过大的本机权限。([The Verge][4])

---

## 22.2 Bridge secret

所有 OpenClaw → Core API 请求必须带：

```http
X-Lusiyuan-OpenClaw-Secret
```

Core API 校验：

```ts
if (secret !== env.OPENCLAW_BRIDGE_SECRET) {
  return reply.code(401).send({ error: "Unauthorized" });
}
```

---

## 22.3 Signature

可选增强 HMAC：

```text
signature = hmac_sha256(raw_body, OPENCLAW_WEBHOOK_SECRET)
```

请求头：

```http
X-Lusiyuan-OpenClaw-Signature
```

---

## 22.4 Event allowlist

只接受：

```text
inbox_message
comment
page_snapshot
browser_read_result
search_result
notification
```

其他 event_type 直接拒绝。

---

## 22.5 Action allowlist

v0.8 只允许：

```text
read_page
fetch_comments
collect_inbox_summary
capture_page_snapshot
create_reply_draft
```

其他全部拒绝。

---

## 22.6 Private inbox 限制

`read_private_inbox` 在 v0.8 不开放。

可以做：

```text
collect_inbox_summary
```

但不做：

```text
read_private_inbox_full
```

并且摘要不能包含敏感隐私。

---

## 22.7 草稿提示

任何由外部信息生成的 Draft，陆思源必须明确：

```text
这是草稿，尚未发送。
```

不能说：

```text
我已经帮你回复了。
```

---

# 23. 典型流程

## 23.1 小红书评论 → 回复草稿

```text
1. OpenClaw 读取评论
2. OpenClaw POST /v1/openclaw/events
3. Core API 保存 ExternalInboxItem
4. ExternalInboxService 生成摘要
5. DraftService 创建回复草稿
6. 管理页显示草稿
7. 创作者审核
8. v0.8 到此结束，不发送
```

---

## 23.2 网页读取 → 项目摘要

```text
1. Creator Assistant 请求读取网页
2. Core API 创建 ExternalActionRequest actionType=read_page
3. ApprovalRequest 创建
4. owner 批准
5. Core API 调 OpenClawActionGateway
6. OpenClaw 读取网页
7. 回传 page_snapshot
8. Core API 生成摘要
9. Creator Assistant 使用摘要整理文档
```

---

## 23.3 每日运营摘要

```text
1. 手动或定时触发 run-openclaw-digest
2. OpenClaw 收集外部 inbox summary
3. Core API 保存 ExternalInboxItem
4. Creator Assistant 生成运营摘要
5. DraftService 保存日报草稿
```

v0.8 可以手动触发。
v0.8.1 再考虑定时。

---

# 24. 开发步骤

## Step 1：新增数据表

Prisma 新增：

```text
ExternalInboxItem
ExternalActionRequest
ExternalActionLog
ApprovalRequest
OpenClawEventLog
```

执行 migration。

---

## Step 2：新增 OpenClaw 配置

创建：

```text
src/openclaw/openclaw-config.ts
```

读取：

```text
OPENCLAW_ENABLED
OPENCLAW_BASE_URL
OPENCLAW_API_KEY
OPENCLAW_BRIDGE_SECRET
OPENCLAW_* safety flags
```

---

## Step 3：实现 OpenClaw webhook route

创建：

```text
src/routes/openclaw.route.ts
```

实现：

```text
POST /v1/openclaw/events
GET /v1/openclaw/status
```

---

## Step 4：实现 OpenClawEventNormalizer

创建：

```text
src/openclaw/openclaw-event-normalizer.ts
```

将 OpenClaw event 转为：

```text
ExternalInboxItem
```

---

## Step 5：实现 ExternalInboxService

创建：

```text
src/external-inbox/external-inbox.service.ts
```

实现：

```text
ingestOpenClawEvent
summarizeItem
createDraftForItem
listItems
markIgnored
archiveItem
```

---

## Step 6：实现 ExternalActionPolicy

创建：

```text
src/external-actions/external-action-policy.ts
```

实现 action allowlist / denylist。

---

## Step 7：实现 ExternalActionService

创建：

```text
src/external-actions/external-action.service.ts
```

实现：

```text
createActionRequest
approveAction
rejectAction
runApprovedAction
listActions
```

---

## Step 8：实现 ApprovalService

创建：

```text
src/approvals/approval.service.ts
```

实现统一审核队列。

---

## Step 9：实现 OpenClawClient

创建：

```text
src/openclaw/openclaw-client.ts
```

封装：

```text
health
runReadOnlyAction
runBrowserRead
fetchChannelItems
```

v0.8 不实现高风险写操作。

---

## Step 10：实现 OpenClawActionGateway

创建：

```text
src/openclaw/openclaw-action-gateway.ts
```

只支持：

```text
read_page
fetch_comments
collect_inbox_summary
capture_page_snapshot
```

---

## Step 11：注册 OpenClaw 工具

新增工具：

```text
openclaw_read_page
openclaw_fetch_comments
openclaw_collect_inbox_summary
openclaw_create_reply_draft
```

全部经过 ToolExecutor。

---

## Step 12：新增 routes

```text
routes/external-inbox.route.ts
routes/external-actions.route.ts
routes/approvals.route.ts
```

实现相关 API。

---

## Step 13：新增 scripts

```text
scripts/test-openclaw-bridge.ts
scripts/inspect-openclaw-events.ts
scripts/inspect-external-actions.ts
scripts/run-openclaw-digest.ts
```

---

## Step 14：新增管理页

Web 新增：

```text
/admin/action-gateway
```

实现：

```text
External Inbox
Drafts
Approval Queue
Action Logs
```

---

# 25. package.json scripts

新增：

```json
{
  "scripts": {
    "openclaw:test-bridge": "tsx scripts/test-openclaw-bridge.ts",
    "openclaw:inspect-events": "tsx scripts/inspect-openclaw-events.ts",
    "actions:inspect": "tsx scripts/inspect-external-actions.ts",
    "openclaw:digest": "tsx scripts/run-openclaw-digest.ts"
  }
}
```

---

# 26. 验收标准

v0.8 完成后应满足：

```text
1. OPENCLAW_ENABLED=false 时，系统正常运行，不影响原功能
2. /v1/openclaw/events 可以接收合法 OpenClaw event
3. 非法 secret 请求被拒绝
4. 未知 event_type 被拒绝
5. OpenClawEventLog 正常记录原始事件
6. ExternalInboxItem 正常入库
7. comment 类型 item 可以生成 summary
8. comment 类型 item 可以生成 Draft
9. Draft 明确是未发送状态
10. ExternalActionRequest 可以创建
11. 高风险 action 会被拒绝
12. 低风险 action 默认进入审批
13. owner 可以 approve / reject action
14. approved read_page action 可以执行
15. send_message / publish_post / browser_click 在 v0.8 全部禁用
16. 所有外部动作有 ExternalActionLog
17. 管理页可以查看 inbox / draft / approval / log
18. Reflection Agent 可以读取 ExternalInboxItem 做复盘
19. Creator Assistant 可以总结外部评论情况
20. Telegram / Weixin / Web 原有功能不受影响
```

---

# 27. 推荐测试场景

## 27.1 测试 webhook secret

无 secret：

```text
POST /v1/openclaw/events
→ 401
```

正确 secret：

```text
POST /v1/openclaw/events
→ 200
```

---

## 27.2 测试评论入库

发送事件：

```json
{
  "event_type": "comment",
  "source": "xiaohongshu",
  "external_item_id": "comment_test_001",
  "text": "陆思源是真人吗？"
}
```

期望：

```text
ExternalInboxItem 创建
summary 生成
Draft 创建
Draft.status = draft
```

---

## 27.3 测试高风险动作拒绝

请求：

```json
{
  "action_type": "send_message",
  "input": {
    "target": "someone",
    "content": "hello"
  }
}
```

期望：

```text
blocked
reason = High-risk external actions disabled in v0.8
```

---

## 27.4 测试 read_page 审批

请求：

```json
{
  "action_type": "read_page",
  "target": "https://example.com",
  "input": {
    "url": "https://example.com"
  }
}
```

期望：

```text
ExternalActionRequest.status = pending_approval
ApprovalRequest 创建
owner approve 后才能 run
```

---

# 28. 给 Codex 的开发指令

可以把下面这段交给 Codex：

```text
请在现有 lusiyuan-core v0.7 项目基础上实现 v0.8：OpenClaw Action Gateway。

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
- Letta Creator Assistant
- Letta Reflection Agent

v0.8 目标：
接入 OpenClaw 作为外部行动网关。OpenClaw 不是陆思源的大脑，只负责外部信息收集、网页读取、评论/消息摘要和低风险只读动作。所有外部动作必须经过 Core API 的 ActionPolicy / ExternalActionPolicy / ApprovalService。

请注意：
- 不要让 OpenClaw 直接回复用户。
- 不要让 OpenClaw 直接修改 Memory。
- 不要让 OpenClaw 直接修改 persona 文件。
- 不要让 OpenClaw 绕过 ActionPolicy。
- 不要实现自动发送和自动发布。
- v0.8 只做只读、摘要、草稿、审核。

请完成以下任务：

1. 更新 .env.example，增加：
   - OPENCLAW_ENABLED=false
   - OPENCLAW_BASE_URL="http://localhost:7331"
   - OPENCLAW_API_KEY=""
   - OPENCLAW_BRIDGE_SECRET=""
   - OPENCLAW_WEBHOOK_SECRET=""
   - OPENCLAW_ALLOWED_EVENT_TYPES="inbox_message,comment,page_snapshot,browser_read_result"
   - OPENCLAW_ALLOW_READ_ONLY=true
   - OPENCLAW_ALLOW_BROWSER_WRITE=false
   - OPENCLAW_ALLOW_SEND_MESSAGE=false
   - OPENCLAW_ALLOW_PUBLISH=false
   - OPENCLAW_ALLOW_PRIVATE_INBOX_FULL_READ=false
   - EXTERNAL_ACTIONS_ENABLED=true
   - EXTERNAL_ACTIONS_REQUIRE_APPROVAL=true
   - EXTERNAL_ACTIONS_AUTO_RUN_LOW_RISK=false
   - EXTERNAL_ACTIONS_MAX_PER_HOUR=20
   - EXTERNAL_ACTION_TIMEOUT_MS=30000
   - APPROVAL_ENABLED=true
   - APPROVAL_OWNER_ONLY=true
   - APPROVAL_EXPIRES_HOURS=72
   - EXTERNAL_INBOX_ENABLED=true
   - EXTERNAL_INBOX_AUTO_SUMMARIZE=true
   - EXTERNAL_INBOX_AUTO_CREATE_DRAFT=true
   - EXTERNAL_INBOX_MAX_ITEMS_PER_SYNC=50
   - BROWSER_READ_ONLY_ENABLED=true
   - BROWSER_CAPTURE_SCREENSHOT=false
   - BROWSER_MAX_PAGE_TEXT_CHARS=12000
   - OPENCLAW_REQUIRE_SIGNATURE=true
   - OPENCLAW_REJECT_UNKNOWN_SOURCES=true
   - OPENCLAW_LOG_RAW_PAYLOAD=true

2. 新增 Prisma models：
   - ExternalInboxItem
   - ExternalActionRequest
   - ExternalActionLog
   - ApprovalRequest
   - OpenClawEventLog

3. ExternalInboxItem 字段：
   - id
   - source
   - sourceAccountId
   - sourceUserId
   - sourceUserName
   - externalItemId
   - externalThreadId
   - externalUrl
   - itemType
   - title
   - content
   - summary
   - rawPayload Json?
   - metadata Json?
   - status default new
   - riskLevel default low
   - linkedDraftId
   - linkedConversationId
   - receivedAt
   - processedAt
   - createdAt
   - updatedAt

4. ExternalActionRequest 字段：
   - id
   - actionType
   - source
   - target
   - title
   - description
   - input Json
   - plannedOutput Json?
   - riskLevel
   - status default pending_approval
   - requiresApproval default true
   - requestedBy
   - requestedFrom
   - relatedDraftId
   - relatedInboxItemId
   - approvedBy
   - approvedAt
   - rejectedBy
   - rejectedAt
   - rejectReason
   - createdAt
   - updatedAt
   - executedAt
   - completedAt

5. ExternalActionLog 字段：
   - id
   - actionRequestId
   - status
   - provider default openclaw
   - requestPayload Json?
   - responsePayload Json?
   - error
   - startedAt
   - completedAt
   - durationMs
   - createdAt

6. ApprovalRequest 字段：
   - id
   - targetType
   - targetId
   - title
   - description
   - riskLevel
   - status default pending
   - requestedBy
   - approvedBy
   - approvedAt
   - rejectedBy
   - rejectedAt
   - rejectReason
   - expiresAt
   - createdAt
   - updatedAt

7. OpenClawEventLog 字段：
   - id
   - eventType
   - source
   - externalEventId
   - payload Json
   - normalized Json?
   - status default received
   - error
   - receivedAt
   - processedAt

8. 新增 src/openclaw/：
   - openclaw-client.ts
   - openclaw-config.ts
   - openclaw.types.ts
   - openclaw-event-normalizer.ts
   - openclaw-action-gateway.ts
   - openclaw-inbox.service.ts
   - openclaw-browser.service.ts
   - openclaw-audit.service.ts
   - openclaw-security.ts
   - openclaw-signature.ts

9. 新增 src/external-inbox/：
   - external-inbox.service.ts
   - external-inbox.types.ts
   - external-inbox-deduper.ts
   - external-inbox-summarizer.ts

10. 新增 src/external-actions/：
    - external-action.service.ts
    - external-action.types.ts
    - external-action-policy.ts
    - external-action-runner.ts
    - external-action-result-handler.ts

11. 新增 src/approvals/：
    - approval.service.ts
    - approval.types.ts
    - approval-policy.ts

12. 实现 POST /v1/openclaw/events：
    - 校验 X-Lusiyuan-OpenClaw-Secret
    - 可选校验 X-Lusiyuan-OpenClaw-Signature
    - 只接受 OPENCLAW_ALLOWED_EVENT_TYPES
    - 写 OpenClawEventLog
    - 调 OpenClawEventNormalizer
    - 写 ExternalInboxItem
    - 如果 EXTERNAL_INBOX_AUTO_SUMMARIZE=true，则生成 summary
    - 如果 EXTERNAL_INBOX_AUTO_CREATE_DRAFT=true，且适合回复，则调用 DraftService 创建草稿
    - 返回 inbox_item_id / draft_id

13. 实现 GET /v1/openclaw/status：
    - 返回 OpenClaw 配置状态
    - 不暴露密钥

14. 实现 ExternalInboxService：
    - ingestOpenClawEvent()
    - summarizeItem()
    - createDraftForItem()
    - listItems()
    - markIgnored()
    - archiveItem()

15. 实现 ExternalActionPolicy：
    - v0.8 允许 read_page / fetch_comments / collect_inbox_summary / capture_page_snapshot / create_reply_draft
    - v0.8 禁止 send_message / publish_post / browser_click / browser_fill_form / browser_submit / delete_item / purchase / payment / read_private_inbox_full
    - medium risk 需要审核
    - high risk 直接拒绝

16. 实现 ExternalActionService：
    - createActionRequest()
    - approveAction()
    - rejectAction()
    - runApprovedAction()
    - listActions()

17. 实现 ApprovalService：
    - createApproval()
    - approve()
    - reject()
    - listPending()
    - getApproval()

18. 实现 OpenClawClient：
    - health()
    - runReadOnlyAction()
    - runBrowserRead()
    - fetchChannelItems()
    - 不实现 sendMessage / publishPost / browserClick / browserFillForm
    - 如果这些方法存在，必须 throw disabled error

19. 实现 OpenClawActionGateway：
    - 只支持 read_page / fetch_comments / collect_inbox_summary / capture_page_snapshot
    - 所有动作写 ExternalActionLog
    - 错误和 timeout 也写日志

20. 注册 v0.8 OpenClaw 工具到 ToolRegistry：
    - openclaw_read_page
    - openclaw_fetch_comments
    - openclaw_collect_inbox_summary
    - openclaw_create_reply_draft
    - 全部必须经过 ToolExecutor
    - 不允许 ChatService 直接调用 OpenClawClient

21. 新增 routes：
    - routes/openclaw.route.ts
    - routes/external-inbox.route.ts
    - routes/external-actions.route.ts
    - routes/approvals.route.ts

22. external-inbox routes：
    - GET /v1/external-inbox
    - GET /v1/external-inbox/:id
    - POST /v1/external-inbox/:id/create-draft
    - POST /v1/external-inbox/:id/ignore
    - POST /v1/external-inbox/:id/archive
    - owner only

23. external-actions routes：
    - POST /v1/external-actions
    - GET /v1/external-actions
    - GET /v1/external-actions/:id
    - POST /v1/external-actions/:id/approve
    - POST /v1/external-actions/:id/reject
    - POST /v1/external-actions/:id/run
    - GET /v1/external-actions/:id/logs
    - owner only

24. approvals routes：
    - GET /v1/approvals
    - POST /v1/approvals/:id/approve
    - POST /v1/approvals/:id/reject
    - owner only

25. 新增 scripts：
    - scripts/test-openclaw-bridge.ts
    - scripts/inspect-openclaw-events.ts
    - scripts/inspect-external-actions.ts
    - scripts/run-openclaw-digest.ts

26. 更新 package.json scripts：
    - "openclaw:test-bridge": "tsx scripts/test-openclaw-bridge.ts"
    - "openclaw:inspect-events": "tsx scripts/inspect-openclaw-events.ts"
    - "actions:inspect": "tsx scripts/inspect-external-actions.ts"
    - "openclaw:digest": "tsx scripts/run-openclaw-digest.ts"

27. 可选 Web 管理页：
    - /admin/action-gateway
    - 展示 External Inbox
    - 展示 Drafts
    - 展示 Approval Queue
    - 展示 External Action Logs
    - 支持 approve / reject
    - 不支持直接发送和直接发布

28. 新增 docs/openclaw-action-gateway-v0.8.md：
    - 说明 OpenClaw 定位
    - 说明为什么 OpenClaw 不是陆思源主脑
    - 说明 webhook event 格式
    - 说明 ExternalInboxItem / ExternalActionRequest / ApprovalRequest
    - 说明只读动作和高风险动作
    - 说明安全策略
    - 说明如何安装 OpenClaw / Weixin plugin
    - 说明如何测试 webhook
    - 说明未来 v0.8.1 / v1.1 可以扩展什么

限制：
- 不要让 OpenClaw 直接回复普通用户
- 不要让 OpenClaw 直接写 Memory
- 不要让 OpenClaw 修改 persona files
- 不要绕过 ActionPolicy
- 不要实现 send_message
- 不要实现 publish_post
- 不要实现 browser_click
- 不要实现 browser_fill_form
- 不要实现 read_private_inbox_full
- 不要自动发布任何内容
- 不要自动发送任何消息
- 不要默认安装或信任第三方 OpenClaw skills
- 不要把 OpenClaw API key 暴露到前端

验收：
- OPENCLAW_ENABLED=false 时系统正常运行
- /v1/openclaw/events 可以接收合法事件
- 错误 secret 被拒绝
- 未知 event_type 被拒绝
- OpenClawEventLog 正常写入
- ExternalInboxItem 正常写入
- 评论类 item 可以生成摘要和草稿
- Draft 明确为未发送
- ExternalActionRequest 可以创建
- 高风险 action 被拒绝
- 低风险 action 默认进入审批
- owner 可以 approve/reject
- approved read_page 可以执行
- 所有外部动作都有 ExternalActionLog
- 管理页可以查看 inbox / drafts / approvals / logs
- 原有 /v1/chat、Telegram、Weixin、Web、Creator Assistant、Reflection Agent 不受影响
```

---

# 29. v0.8 最终效果

v0.8 做完后，陆思源会拥有第一版“外部世界感知能力”。

他可以：

```text
1. 接收外部评论
2. 读取网页内容
3. 整理外部 inbox 摘要
4. 生成回复草稿
5. 生成运营日报草稿
6. 等待你审核
```

但他仍然不能：

```text
1. 自己发私信
2. 自己发小红书
3. 自己点浏览器按钮
4. 自己读完整私密 inbox
5. 自己发布内容
```

这一步很关键。
它让陆思源从“只在自己的窗口里聊天”，走向“能看见外部世界”，但仍然处在安全可控的边界内。

[1]: https://docs.openclaw.ai/?utm_source=chatgpt.com "OpenClaw - OpenClaw"
[2]: https://docs.openclaw.ai/gateway/configuration?utm_source=chatgpt.com "Configuration - OpenClaw"
[3]: https://docs.openclaw.ai/tools/plugin?utm_source=chatgpt.com "Plugins - OpenClaw"
[4]: https://www.theverge.com/news/874011/openclaw-ai-skill-clawhub-extensions-security-nightmare?utm_source=chatgpt.com "OpenClaw's AI 'skill' extensions are a security nightmare"
[5]: https://docs.openclaw.ai/channels/wechat?utm_source=chatgpt.com "WeChat - OpenClaw"
[6]: https://docs.openclaw.ai/automation/hooks?utm_source=chatgpt.com "Hooks - OpenClaw"
