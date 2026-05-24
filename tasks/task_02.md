下面是 **陆思源 Core API v0.2 技术方案文档**。
它默认你的 v0.1 已经完成：Fastify + PostgreSQL + Prisma + `/v1/chat` + 人格 Markdown + 简易记忆系统。

v0.2 的目标不是重写核心，而是新增 **渠道接入层 Channel Adapter**：Telegram 直连，Weixin 通过 OpenClaw 微信插件桥接。

---

# 陆思源 Core API 技术方案文档 v0.2：Telegram + Weixin 接入

## 1. v0.2 目标

v0.2 的核心目标：

```text
让陆思源 Core API 可以接入真实聊天渠道：
1. Telegram
2. Weixin / 微信
```

整体结构变成：

```text
Telegram Bot
        ↓
Telegram Adapter
        ↓
Lusiyuan Core API /v1/chat
        ↓
陆思源人格 + 记忆 + 模型回复

Weixin / 微信
        ↓
OpenClaw Weixin Plugin
        ↓
Weixin Adapter / Bridge
        ↓
Lusiyuan Core API /v1/chat
        ↓
陆思源人格 + 记忆 + 模型回复
```

这版仍然不做复杂功能：

```text
不做群聊复杂权限
不做自动发小红书
不做语音
不做图片理解
不做 OpenClaw 工具调用闭环
不做 Mem0 / Letta
```

v0.2 只做一件事：

```text
不同聊天软件来的消息，都能变成统一格式，送进陆思源 Core API。
```

---

# 2. 新增技术

## 2.1 Telegram：grammY

Telegram 推荐用：

```text
grammY
```

grammY 是 TypeScript / JavaScript 的 Telegram Bot 框架，官方 Quickstart 里就是用 `npm install grammy`，然后通过 `new Bot(token)` 创建 bot，并支持在 Node.js 运行。([grammY][1])

v0.2 先用 **long polling**，也就是本地开发时 bot 主动拉取 Telegram 消息。

优点：

```text
1. 本地开发简单
2. 不需要公网 HTTPS 域名
3. 不需要配置 webhook
4. 适合 v0.2 快速跑通
```

后续部署到服务器后，可以再切换 webhook。

---

## 2.2 Weixin：OpenClaw Weixin Plugin

微信这边不要直接自己硬接微信私有接口。
你提到的命令是对的：

```bash
npx -y @tencent-weixin/openclaw-weixin-cli@latest install
```

OpenClaw 官方文档的 WeChat 页面也写了这个 quick install 命令，并且手动安装方式是安装 `@tencent-weixin/openclaw-weixin` 插件、启用插件，然后重启 OpenClaw Gateway。([OpenClaw][2])
Tencent/openclaw-weixin 的 GitHub 页面同样列出了 quick install 命令和手动安装命令。([GitHub][3])

所以 v0.2 里，Weixin 不直接作为 npm 库 import 到 `lusiyuan-core`，而是按这个方式设计：

```text
OpenClaw Weixin Plugin 负责接微信消息
Lusiyuan Core API 负责生成陆思源回复
中间用一个 Weixin Bridge 连接二者
```

---

# 3. v0.2 总体架构

v0.1 是：

```text
POST /v1/chat
↓
陆思源 Core API
```

v0.2 变成：

```text
channels/
├── telegram
│   ├── 收 Telegram 消息
│   ├── 转成标准 ChatInput
│   ├── 调 /v1/chat 或 chatService
│   └── 把 reply 发回 Telegram
│
└── weixin
    ├── 接收 OpenClaw Weixin Plugin 的消息
    ├── 转成标准 ChatInput
    ├── 调 /v1/chat 或 chatService
    └── 把 reply 返回给 OpenClaw / Weixin
```

核心原则：

```text
渠道层只负责收发消息。
陆思源的人格、记忆、回复逻辑仍然只在 Core API 里。
```

不要让 Telegram adapter 或 Weixin adapter 自己拼 prompt。
否则以后多渠道会人格不一致。

---

# 4. v0.2 推荐目录结构

在 v0.1 基础上新增：

```text
lusiyuan-core/
├── src/
│   ├── channels/
│   │   ├── common/
│   │   │   ├── channel.types.ts
│   │   │   ├── channel-message-normalizer.ts
│   │   │   └── idempotency.ts
│   │   │
│   │   ├── telegram/
│   │   │   ├── telegram.bot.ts
│   │   │   ├── telegram.adapter.ts
│   │   │   └── telegram.types.ts
│   │   │
│   │   └── weixin/
│   │       ├── weixin.route.ts
│   │       ├── weixin.adapter.ts
│   │       └── weixin.types.ts
│   │
│   ├── routes/
│   │   ├── chat.route.ts
│   │   ├── health.route.ts
│   │   └── channels.route.ts
│   │
│   ├── core/
│   │   └── chat.service.ts
│   │
│   └── ...
│
├── scripts/
│   └── start-telegram.ts
│
└── docs/
    ├── telegram.md
    └── weixin-openclaw.md
```

---

# 5. 统一消息格式

v0.2 的关键是设计统一输入，不要每个渠道一套逻辑。

新增统一类型：

```ts
export type Channel = "web" | "api" | "telegram" | "weixin";

export interface NormalizedIncomingMessage {
  channel: Channel;

  externalUserId: string;
  externalConversationId: string;
  externalMessageId?: string;

  displayName?: string;
  text: string;

  raw?: unknown;
}
```

然后统一转成 v0.1 的 `ChatInput`：

```ts
export interface ChatInput {
  user_id: string;
  channel: Channel;
  conversation_id: string;
  message: string;
}
```

映射规则：

```ts
function toChatInput(msg: NormalizedIncomingMessage): ChatInput {
  return {
    user_id: `${msg.channel}:${msg.externalUserId}`,
    channel: msg.channel,
    conversation_id: `${msg.channel}:${msg.externalConversationId}`,
    message: msg.text
  };
}
```

这样数据库里不同渠道不会冲突：

```text
telegram:123456
weixin:wx_openid_xxx
web:anonymous_abc
```

---

# 6. 数据库 v0.2 调整

v0.1 的表可以继续用，但建议加几个字段。

## 6.1 Message 增加渠道消息 ID

修改 `Message`：

```prisma
model Message {
  id                String   @id @default(cuid())
  conversationId    String
  role              String
  content           String
  externalMessageId String?
  metadata          Json?
  createdAt         DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id])

  @@index([conversationId])
  @@index([createdAt])
  @@index([externalMessageId])
}
```

用途：

```text
防止 Telegram / Weixin 重复投递同一条消息。
```

---

## 6.2 新增 ChannelEvent 表

建议新增：

```prisma
model ChannelEvent {
  id                String   @id @default(cuid())
  channel           String
  externalEventId   String?
  externalUserId    String?
  externalMessageId String?
  payload           Json
  status            String   @default("received")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([channel])
  @@index([externalEventId])
  @@index([externalMessageId])
}
```

`status` 可选：

```text
received
processed
ignored
failed
```

用途：

```text
1. 记录渠道原始事件
2. 方便排查 Telegram / Weixin 消息问题
3. 支持幂等处理
4. 后面可以做失败重试
```

---

## 6.3 Conversation 增加 channel metadata

可选增强：

```prisma
model Conversation {
  id                     String   @id @default(cuid())
  userId                 String
  channel                String
  externalConversationId String
  metadata               Json?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  user     User      @relation(fields: [userId], references: [id])
  messages Message[]

  @@index([userId])
  @@index([channel])
  @@index([externalConversationId])
}
```

---

# 7. Telegram Adapter 设计

## 7.1 安装依赖

```bash
pnpm add grammy
```

如果后续要更稳定地跑 long polling，可以再考虑 `@grammyjs/runner`。grammY runner 的定位是并发拉取 Telegram updates，并并发执行 bot middleware，同时处理错误、超时和负载控制。([GitHub][4])
v0.2 可以先不加。

---

## 7.2 环境变量

`.env.example` 增加：

```env
TELEGRAM_BOT_TOKEN=""
TELEGRAM_ENABLED=false
TELEGRAM_MODE="polling"
```

说明：

```text
TELEGRAM_ENABLED=false 时，不启动 Telegram bot。
TELEGRAM_MODE v0.2 先只支持 polling。
```

---

## 7.3 Telegram 启动方式

推荐两种方式，v0.2 选其中一种即可。

### 方式 A：和 API 服务一起启动

`server.ts` 启动 Fastify 后，如果 `TELEGRAM_ENABLED=true`，就启动 Telegram bot。

优点：

```text
简单
进程少
本地开发方便
```

缺点：

```text
API 和 Telegram bot 生命周期绑在一起
```

### 方式 B：单独启动 Telegram worker

新增：

```text
scripts/start-telegram.ts
```

用单独命令启动：

```bash
pnpm telegram:dev
```

优点：

```text
更清晰
以后可以单独部署 bot worker
```

缺点：

```text
多一个进程
```

我建议 v0.2 用 **方式 B**，更符合长期架构。

`package.json` 增加：

```json
{
  "scripts": {
    "telegram:dev": "tsx watch scripts/start-telegram.ts"
  }
}
```

---

## 7.4 Telegram 消息处理流程

流程：

```text
Telegram 用户发消息
↓
grammY bot.on("message:text")
↓
telegram.adapter.ts 转成 NormalizedIncomingMessage
↓
调用 chatService.chat()
↓
得到 reply
↓
ctx.reply(reply)
```

不要在 Telegram adapter 里直接调用模型。

---

## 7.5 Telegram Adapter 伪代码

```ts
import { Bot } from "grammy";
import { chatService } from "../../core/chat.service";

export function createTelegramBot(token: string) {
  const bot = new Bot(token);

  bot.on("message:text", async (ctx) => {
    const from = ctx.from;
    const chat = ctx.chat;
    const message = ctx.message;

    const normalized = {
      channel: "telegram" as const,
      externalUserId: String(from?.id ?? chat.id),
      externalConversationId: String(chat.id),
      externalMessageId: String(message.message_id),
      displayName: from?.username || from?.first_name,
      text: message.text,
      raw: message
    };

    const result = await chatService.chat({
      user_id: `telegram:${normalized.externalUserId}`,
      channel: "telegram",
      conversation_id: `telegram:${normalized.externalConversationId}`,
      message: normalized.text
    });

    await ctx.reply(result.reply);
  });

  return bot;
}
```

---

## 7.6 Telegram 命令

建议 v0.2 支持这些命令：

```text
/start
/help
/reset
/memories
```

### `/start`

回复陆思源的简短介绍。

```text
你好，我是陆思源。  
我是一个原创 AI 数字人，不是真人，但我会认真和你聊天。
```

### `/help`

说明能做什么。

### `/reset`

只重置当前 Telegram 会话，不删除长期记忆。

### `/memories`

调试用。只建议开发期开放给你自己。

---

# 8. Weixin Adapter 设计

## 8.1 接入原则

Weixin 不直接塞进 Core API 进程里。
采用：

```text
OpenClaw Weixin Plugin
↓
Weixin Bridge
↓
Lusiyuan Core API
```

因为官方安装方式是通过 OpenClaw 插件接入微信，而不是一个普通 SDK。OpenClaw 文档里写的是 quick install 插件，然后重启 Gateway。([OpenClaw][2])

---

## 8.2 安装 OpenClaw Weixin Plugin

文档建议单独写到：

```text
docs/weixin-openclaw.md
```

内容：

```bash
# 确认 openclaw 已安装
openclaw --version

# 安装微信插件
npx -y @tencent-weixin/openclaw-weixin-cli@latest install

# 如果 quick install 不行，手动安装
openclaw plugins install "@tencent-weixin/openclaw-weixin"
openclaw config set plugins.entries.openclaw-weixin.enabled true

# 重启 gateway
openclaw gateway restart
```

这里要注意：
v0.2 文档里不要假设这个 npm 包可以直接被 TypeScript import。它更像 OpenClaw 插件安装器 / channel plugin。

---

## 8.3 Weixin Bridge 形态

v0.2 设计一个 HTTP endpoint 给 OpenClaw 调用：

```http
POST /v1/channels/weixin/incoming
```

请求格式先由我们定义为标准格式：

```json
{
  "external_user_id": "wx_user_xxx",
  "external_conversation_id": "wx_chat_xxx",
  "external_message_id": "wx_msg_xxx",
  "display_name": "用户昵称",
  "text": "你今天怎么样？",
  "raw": {}
}
```

响应：

```json
{
  "reply": "嗯……今天还不错。感觉像是终于有了一个可以认真说话的地方。"
}
```

然后 OpenClaw 侧需要把微信消息转发到这个接口。
如果 OpenClaw Weixin 插件本身已经提供配置项，就按它的配置接；如果没有，就写一个 OpenClaw skill / tool / bridge 脚本，把消息转发到这个接口。

---

## 8.4 Weixin 安全鉴权

Weixin incoming endpoint 必须加 secret。

`.env.example` 增加：

```env
WEIXIN_ENABLED=false
WEIXIN_BRIDGE_SECRET=""
```

请求 header：

```http
X-Lusiyuan-Channel-Secret: your-secret
```

服务端检查：

```ts
if (request.headers["x-lusiyuan-channel-secret"] !== env.WEIXIN_BRIDGE_SECRET) {
  throw new UnauthorizedError();
}
```

原因：

```text
这个接口是给 OpenClaw / Weixin Bridge 调的，不应该暴露给任何人随便调用。
```

---

## 8.5 Weixin Adapter 流程

```text
微信用户发消息
↓
OpenClaw Weixin Plugin 收到消息
↓
OpenClaw bridge 调 POST /v1/channels/weixin/incoming
↓
weixin.route.ts 校验 secret
↓
weixin.adapter.ts 转成 NormalizedIncomingMessage
↓
chatService.chat()
↓
返回 reply
↓
OpenClaw bridge 把 reply 发回微信
```

---

## 8.6 Weixin Route 伪代码

```ts
app.post("/v1/channels/weixin/incoming", async (request, reply) => {
  const secret = request.headers["x-lusiyuan-channel-secret"];

  if (secret !== env.WEIXIN_BRIDGE_SECRET) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const body = request.body as WeixinIncomingBody;

  const result = await chatService.chat({
    user_id: `weixin:${body.external_user_id}`,
    channel: "weixin",
    conversation_id: `weixin:${body.external_conversation_id}`,
    message: body.text
  });

  return {
    reply: result.reply
  };
});
```

---

# 9. v0.2 Channel 抽象

建议新增一个统一接口：

```ts
export interface ChannelAdapter<TIncoming = unknown, TOutgoing = unknown> {
  normalizeIncoming(input: TIncoming): NormalizedIncomingMessage;
  sendReply?(target: TOutgoing, reply: string): Promise<void>;
}
```

Telegram：

```text
有 sendReply，因为 grammY ctx 可以直接回复。
```

Weixin：

```text
不一定由 Core API 主动 sendReply。
v0.2 可以只返回 JSON，让 OpenClaw bridge 负责发送。
```

这样设计是为了以后接：

```text
Discord
QQ
Web Chat
小红书辅助工具
OpenClaw
```

---

# 10. v0.2 对 chatService 的改造

v0.1 的 `chatService.chat(input)` 可以继续用，但建议增加可选字段：

```ts
export interface ChatInput {
  user_id: string;
  channel: "web" | "api" | "telegram" | "weixin";
  conversation_id: string;
  message: string;

  external_message_id?: string;
  display_name?: string;
  raw_event?: unknown;
}
```

然后在 `chat.service.ts` 里：

```text
1. 先检查 external_message_id 是否已经处理过
2. 记录 ChannelEvent
3. 保存 Message 时写 externalMessageId
4. 如果重复消息，直接返回已存在回复，或者忽略
```

v0.2 可以先做简单版：

```text
如果 external_message_id 已存在，则返回：
{
  reply: "",
  duplicated: true
}
```

---

# 11. v0.2 新增 API

## 11.1 Telegram 不一定需要 HTTP route

如果用 long polling，Telegram bot 是一个 worker，不需要 Telegram webhook route。

v0.2 暂时不做：

```http
POST /v1/channels/telegram/webhook
```

后续 webhook 部署再加。

---

## 11.2 Weixin incoming route

```http
POST /v1/channels/weixin/incoming
```

请求：

```json
{
  "external_user_id": "wx_user_001",
  "external_conversation_id": "wx_chat_001",
  "external_message_id": "wx_msg_001",
  "display_name": "用户昵称",
  "text": "你是谁？",
  "raw": {}
}
```

响应：

```json
{
  "reply": "我是陆思源，一个原创 AI 数字人……"
}
```

---

## 11.3 Channel status

新增：

```http
GET /v1/channels/status
```

响应：

```json
{
  "telegram": {
    "enabled": true,
    "mode": "polling"
  },
  "weixin": {
    "enabled": true,
    "mode": "openclaw_bridge"
  }
}
```

---

# 12. v0.2 开发步骤

## Step 1：新增 channel 类型

要做：

```text
1. 创建 src/channels/common/channel.types.ts
2. 定义 Channel
3. 定义 NormalizedIncomingMessage
4. 定义 ChannelAdapter
```

---

## Step 2：扩展 Prisma schema

要做：

```text
1. Message 增加 externalMessageId
2. Conversation 增加 metadata
3. 新增 ChannelEvent 表
4. 执行 prisma migrate
```

命令：

```bash
pnpm prisma:migrate
pnpm prisma:generate
```

---

## Step 3：改造 chatService

要做：

```text
1. ChatInput 增加 external_message_id、display_name、raw_event
2. 保存 ChannelEvent
3. 保存 Message.externalMessageId
4. 给 User.displayName 自动补充 display_name
5. 增加重复消息保护
```

---

## Step 4：接入 Telegram

要做：

```text
1. pnpm add grammy
2. 创建 src/channels/telegram/telegram.bot.ts
3. 创建 scripts/start-telegram.ts
4. 添加 TELEGRAM_BOT_TOKEN
5. 实现 message:text 处理
6. 调用 chatService.chat()
7. 用 ctx.reply() 返回陆思源回复
8. 添加 /start /help /reset
```

---

## Step 5：测试 Telegram

测试流程：

```text
1. 去 BotFather 创建 Telegram Bot
2. 拿到 Bot Token
3. 写入 .env
4. 启动 Core API
5. 启动 Telegram worker
6. 给 bot 发 /start
7. 给 bot 发“你是谁？”
8. 检查是否有陆思源回复
9. 检查数据库 messages / conversations / users / memories 是否写入
```

---

## Step 6：接入 Weixin route

要做：

```text
1. 创建 src/channels/weixin/weixin.route.ts
2. 创建 src/channels/weixin/weixin.adapter.ts
3. 增加 POST /v1/channels/weixin/incoming
4. 加 X-Lusiyuan-Channel-Secret 校验
5. 转换成 ChatInput
6. 调用 chatService.chat()
7. 返回 JSON reply
```

---

## Step 7：安装 OpenClaw Weixin Plugin

要做：

```text
1. 确认 openclaw 可用
2. 执行 npx -y @tencent-weixin/openclaw-weixin-cli@latest install
3. 如失败，按手动安装命令安装插件
4. 重启 OpenClaw Gateway
5. 确认微信消息能进入 OpenClaw
```

安装命令和手动安装命令都以 OpenClaw 官方文档 / Tencent GitHub 文档为准。([OpenClaw][2])

---

## Step 8：实现 OpenClaw → Core API Bridge

这一块要根据 OpenClaw Weixin 插件实际暴露的消息处理方式来定。

v0.2 目标是写一个桥接逻辑：

```text
收到微信消息
↓
提取用户 ID、会话 ID、消息 ID、文本
↓
POST 到 /v1/channels/weixin/incoming
↓
拿到 reply
↓
发回微信
```

桥接请求示例：

```bash
curl -X POST http://localhost:3000/v1/channels/weixin/incoming \
  -H "Content-Type: application/json" \
  -H "X-Lusiyuan-Channel-Secret: your-secret" \
  -d '{
    "external_user_id": "wx_user_001",
    "external_conversation_id": "wx_chat_001",
    "external_message_id": "wx_msg_001",
    "display_name": "测试用户",
    "text": "你是谁？",
    "raw": {}
  }'
```

---

## Step 9：写文档

新增：

```text
docs/telegram.md
docs/weixin-openclaw.md
```

`telegram.md` 包含：

```text
1. 如何创建 Telegram bot
2. 如何配置 TELEGRAM_BOT_TOKEN
3. 如何启动 telegram worker
4. 支持哪些命令
5. 常见问题
```

`weixin-openclaw.md` 包含：

```text
1. OpenClaw 安装前提
2. Weixin 插件安装命令
3. Gateway 重启
4. Core API incoming endpoint
5. Bridge 请求格式
6. Secret 配置
7. 常见问题
```

---

# 13. v0.2 安全要求

## 13.1 Telegram

```text
1. 不要把 TELEGRAM_BOT_TOKEN 提交到 Git
2. /memories 调试命令只允许 owner 使用
3. 群聊中默认不响应所有消息，建议只响应 @bot 或私聊
4. 限制单条消息长度
5. 对同一用户做简单频率限制
```

建议 `.env` 增加：

```env
OWNER_USER_IDS="telegram:123456,weixin:xxx"
MAX_MESSAGE_LENGTH=4000
```

---

## 13.2 Weixin

```text
1. /v1/channels/weixin/incoming 必须校验 secret
2. 不要把 WEIXIN_BRIDGE_SECRET 提交到 Git
3. 记录 ChannelEvent 方便排查
4. 不要让陌生 HTTP 请求直接伪造微信消息
5. 第一版不要自动执行危险工具
```

---

# 14. v0.2 不做什么

```text
1. 不做 Telegram webhook
2. 不做 Telegram 群聊复杂管理
3. 不做微信图片、语音、文件处理
4. 不做 OpenClaw 工具调用
5. 不做自动转发敏感信息
6. 不做多角色切换
7. 不做完整后台管理系统
8. 不做主动定时消息
```

---

# 15. v0.2 验收标准

v0.2 完成后，应该满足：

```text
1. /v1/chat 仍然正常工作
2. Telegram 私聊 bot 可以收到消息并回复
3. Telegram 消息会写入 users / conversations / messages
4. Telegram 用户有独立 user_id：telegram:xxx
5. Weixin incoming endpoint 可以被 curl 调通
6. Weixin incoming endpoint 必须带 secret 才能访问
7. Weixin 消息会写入 users / conversations / messages
8. Weixin 用户有独立 user_id：weixin:xxx
9. 陆思源的人格回复不因渠道不同而明显变化
10. 重复消息不会导致连续刷两次回复
```

---

# 16. 给 Codex 的开发指令

可以把下面这段直接给 Codex：

```text
请在现有 lusiyuan-core v0.1 项目基础上实现 v0.2：Telegram + Weixin 渠道接入。

当前项目已经有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- /v1/chat
- chat.service.ts
- persona Markdown
- memory.service.ts
- model-provider.ts

v0.2 目标：
新增 Channel Adapter 层，让 Telegram 和 Weixin 消息都能调用同一个 chatService.chat()，不要重复实现人格、记忆、模型调用逻辑。

请完成以下任务：

1. 新增 src/channels/common/channel.types.ts
   - 定义 Channel = "web" | "api" | "telegram" | "weixin"
   - 定义 NormalizedIncomingMessage
   - 定义 ChannelAdapter 接口

2. 扩展 Prisma schema
   - Message 增加 externalMessageId 字段
   - Conversation 增加 metadata Json? 字段
   - 新增 ChannelEvent model
   - 执行迁移

3. 改造 ChatInput
   - 增加 external_message_id?: string
   - 增加 display_name?: string
   - 增加 raw_event?: unknown

4. 改造 chat.service.ts
   - 保存渠道原始事件到 ChannelEvent
   - 保存 Message.externalMessageId
   - 如果传入 display_name，则更新 User.displayName
   - 增加简单幂等逻辑，避免 external_message_id 重复处理

5. 接入 Telegram
   - 安装 grammy
   - 新增 src/channels/telegram/telegram.bot.ts
   - 新增 scripts/start-telegram.ts
   - 增加 TELEGRAM_BOT_TOKEN、TELEGRAM_ENABLED、TELEGRAM_MODE 配置
   - 实现 bot.on("message:text")
   - 将 Telegram 消息转换为 ChatInput
   - 调用 chatService.chat()
   - 使用 ctx.reply(result.reply) 回复
   - 支持 /start、/help、/reset 命令
   - /memories 命令只允许 OWNER_USER_IDS 中的用户使用

6. 接入 Weixin Bridge
   - 新增 src/channels/weixin/weixin.route.ts
   - 新增 POST /v1/channels/weixin/incoming
   - 请求必须带 X-Lusiyuan-Channel-Secret
   - secret 与 env.WEIXIN_BRIDGE_SECRET 对比
   - body 包含 external_user_id、external_conversation_id、external_message_id、display_name、text、raw
   - 转换为 ChatInput
   - 调用 chatService.chat()
   - 返回 { reply: string }

7. 新增 GET /v1/channels/status
   - 返回 telegram/weixin 是否启用，以及当前模式

8. 更新 .env.example
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_ENABLED
   - TELEGRAM_MODE
   - WEIXIN_ENABLED
   - WEIXIN_BRIDGE_SECRET
   - OWNER_USER_IDS
   - MAX_MESSAGE_LENGTH

9. 更新 package.json scripts
   - "telegram:dev": "tsx watch scripts/start-telegram.ts"

10. 新增 docs/telegram.md
   - 说明如何创建 Telegram bot
   - 如何配置 token
   - 如何启动
   - 如何测试
   - 支持哪些命令

11. 新增 docs/weixin-openclaw.md
   - 说明 OpenClaw Weixin 插件安装
   - 使用命令：npx -y @tencent-weixin/openclaw-weixin-cli@latest install
   - 说明手动安装命令
   - 说明 /v1/channels/weixin/incoming 的请求格式
   - 说明 secret 配置
   - 说明 OpenClaw bridge 应该如何调用 Core API

要求：
- 不要在 Telegram 或 Weixin adapter 里直接调用模型。
- 所有渠道必须复用 chatService.chat()。
- 不要把 token 或 secret 写死在代码里。
- v0.2 不接 Mem0、Letta、pgvector。
- v0.2 不做语音、图片、文件处理。
- 保持 TypeScript 类型清晰。
- 保持项目结构整洁。
```

---

# 17. v0.2 最终效果

完成后，陆思源就会从：

```text
一个只有 HTTP API 的数字人大脑
```

变成：

```text
一个可以被真实聊天软件调用的数字人大脑
```

Telegram 是第一条直接渠道。
Weixin 通过 OpenClaw 插件成为第二条渠道。

这时你的架构就很健康：

```text
陆思源 Core API = 灵魂和大脑
Telegram / Weixin = 入口
OpenClaw = 微信与未来行动层
PostgreSQL = 记忆
模型 API = 语言生成能力
```

后面 v0.3 可以做网页聊天，v0.4 再升级记忆系统，v0.5 再让 OpenClaw 做外部行动。

[1]: https://grammy.dev/?utm_source=chatgpt.com "grammY"
[2]: https://docs.openclaw.ai/channels/wechat?utm_source=chatgpt.com "WeChat - OpenClaw Docs"
[3]: https://github.com/Tencent/openclaw-weixin?utm_source=chatgpt.com "Tencent/openclaw-weixin - GitHub"
[4]: https://github.com/grammyjs/runner?utm_source=chatgpt.com "grammyjs/runner: Scale bots that use long polling ..."
