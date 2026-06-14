# lusiyuan-core

陆思源数字人的后端核心服务。

它负责接收聊天消息、读取人设和记忆、调用大模型、执行工具、保存对话、运行 Reflection 和 Dream 等后台整理流程。

## IP 与角色授权声明

本仓库中的程序代码按 Apache-2.0 License 授权。

但“陆思源 / Lu Siyuan”这一原创数字人角色，包括但不限于名称、人格设定、角色经历、视觉形象、图片、视频、音色、说话风格、世界观、数据集、模型权重及相关创作素材，均不随代码协议开放商业使用权。

未经授权，不得将“陆思源 / Lu Siyuan”用于：

- 商业产品或商业服务
- 付费聊天机器人、虚拟主播、数字人服务
- 商品、周边、广告、营销活动
- 模型训练、LoRA 训练、音色克隆、数据集制作
- 冒充官方账号或暗示与原作者有关联
- 出售、分发、再授权相关角色素材或衍生模型

如需商业授权，请联系作者。

---

## 先看这里

如果你只是想知道项目有哪些部分，建议先看：

- `project-handbook/README.md`：项目手册入口。
- `project-handbook/project-map.md`：模块地图。
- `project-handbook/flows.md`：消息和后台任务怎么流动。
- `project-handbook/data-map.md`：数据库表的简单解释。
- `project-handbook/runtime-lite-design.md`：陆思源运行体正式版设计。

`docs/` 里是更细的旧版专题文档；`tasks/` 里是历史任务和未来设想。以后项目结构变化时，请同步更新 `project-handbook/`。

---

## 给技术入门者的整体理解

可以把这个项目理解成陆思源的“后台大脑”。

用户可能从网页、Telegram、微信桥接等地方发消息。不同入口收到消息后，都会把消息交给 `lusiyuan-core`。后端会查数据库、读人设、找记忆、调用大模型，再把陆思源的回复发回去。

```text
用户
↓
网页 / Telegram / 微信桥接
↓
lusiyuan-core 后端
↓
数据库 + persona + 记忆 + 工具 + 大模型
↓
陆思源回复
```

这个项目不是只有聊天。它还包括：

- 记忆系统：让陆思源以后能想起重要信息。
- 工具系统：让陆思源可以查项目状态、搜索记忆、读网页、生成草稿。
- Reflection：复盘历史对话，生成记忆提案。
- Dream Cycle：闲时整理最近发生的事，生成笔记、信号和内在日记。
- 管理接口和网页前端：方便查看、审核、配置。

---

## 一条聊天消息怎么走

这是最重要的主链路。

```text
1. 用户发消息
2. 渠道层接收消息
3. 后端做安全检查
4. 保存用户消息
5. 读取陆思源 persona
6. 检索相关长期记忆
7. 读取最近对话
8. 选择聊天投影
9. 编译 prompt
10. 调用大模型
11. 如果需要工具，就执行工具后继续生成
12. 清理模型输出
13. 保存陆思源回复
14. 返回给用户
```

对应代码：

- `src/core/chat.service.ts`：聊天主流程。
- `src/core/prompt-builder.ts`：组装给模型看的内容。
- `src/core/persona-projection.ts`：选择本轮聊天投影和人设切片。
- `src/routes/chat.route.ts`：HTTP 聊天入口。

---

## 重要概念：它们有什么区别

### Persona

`persona/` 是陆思源的完整设定资料。

它回答的是：

```text
陆思源是谁？
他是什么性格？
他说话是什么味道？
他的边界是什么？
```

主要文件：

- `persona/identity.md`：核心身份。
- `persona/personality.md`：深层性格。
- `persona/speaking_style.md`：说话风格。
- `persona/boundaries.md`：边界。
- `persona/examples.md`：回复示例。
- `persona/runtime/core.md`：每轮聊天固定带上的常驻核心。
- `persona/slices/`：按问题检索的人设切片。

`personality.md` 是完整依据，不会在日常聊天里整篇塞给模型。实际聊天时，会固定带上常驻核心，再按本轮问题挑少量相关切片。

### Chat Profile

`persona/chat_profiles/` 是聊天投影。

它回答的是：

```text
这次在这个场景里，陆思源应该怎么说话？
```

比如：

- 默认聊天
- 创造者 / 协作者讨论
- 情绪陪伴
- 严肃讨论
- 熟人朋友
- 公开账号

它不是另一份完整人设，而是“场景表达规则”。

### Runtime State

Runtime State 是陆思源的当前状态。

比如：

- 今天心情怎么样
- 精力高不高
- 最近关注什么
- 当前目标是什么
- 最近发生过什么

当前项目已经有数据库里的真实 `RuntimeState`。`persona/runtime/default_state.md` 只是默认状态种子，用来兜底和初始化。

普通聊天不会直接改这个状态；它会先写入 `RuntimeEvent`。真正能改长期状态的入口是 owner 对话、Reflection 复盘、Dream Cycle 梦境整理、autonomy tick 自启动检查和 admin 手动调整。

正式设计见 `project-handbook/runtime-lite-design.md`。

### Relationship State

Relationship State 是陆思源和某个现实身份之间的关系状态。

比如：

- 熟悉度
- 信任度
- 亲近感
- 关系张力
- 互动风格
- 最近这段关系的信号

它和 Runtime State 不一样。Runtime State 是“陆思源整体现在怎么样”；Relationship State 是“陆思源和这个人现在是什么关系”。

普通聊天可以让程序直接小幅更新 Relationship State，不需要 admin 审核。admin 仍然可以在后台查看、修改和重置。

跨渠道身份不会自动猜测。`telegram:123`、`weixin:abc`、`web:uuid` 默认是不同渠道账号；只有 admin 明确绑定后，才会共享同一个现实身份和同一份关系状态。

### Memory

Memory 是长期记忆。

它不是聊天记录，而是从聊天记录里提炼出的长期信息。比如：

- 用户偏好
- 关系模式
- 项目背景
- 技术决定
- 重要边界

对应代码：

- `src/core/memory.service.ts`
- `src/core/memory-retrieval.service.ts`
- `prisma/schema.prisma` 里的 `Memory`

### Message

Message 是原始聊天记录。

用户说过什么、陆思源回过什么，都会存在 `Message` 表里。它比 Memory 更原始、更细碎。

### Reflection

Reflection 是复盘系统。

它会读取历史对话和已有记忆，分析有没有值得新增、更新或归档的记忆。它生成的是提案，不应该随便直接改正式记忆。

对应代码：

- `src/reflection/`
- `src/routes/reflection.route.ts`

### Dream Cycle

Dream Cycle 是闲时整理系统。

它不是实时聊天流程，而是在空闲时整理最近发生的事，生成：

- DailyNote：每日整理。
- DreamSignal：值得长期关注的信号。
- DreamDiary：陆思源风格的内在日记。
- MemoryProposal：可能要写入长期记忆的提案。

对应代码：

- `src/dream/`
- `src/routes/dream.route.ts`

### Tool

Tool 是模型可以调用的外部能力。

比如：

- 搜索记忆
- 读取网页
- 搜索网页
- 查看项目状态
- 总结最近对话
- 生成草稿

对应代码：

- `src/tools/`
- `src/tools/builtin/`

### Draft

Draft 是草稿。

草稿可以是回复、文案、脚本等。它只保存，不自动发送，需要人审核。

对应代码：

- `src/drafts/`
- `src/routes/drafts.route.ts`

---

## 当前模块地图

| 模块 | 做什么 | 入口 |
| --- | --- | --- |
| 服务启动 | 启动 Fastify 后端 | `src/server.ts` |
| App 注册 | 注册路由、前端静态文件、Telegram、Dream 定时任务 | `src/app.ts` |
| 聊天主流程 | 处理一条用户消息 | `src/core/chat.service.ts` |
| Prompt 编译 | 把人设、记忆、状态、对话变成模型输入 | `src/core/prompt-builder.ts` |
| Persona 投影 | 选择本轮聊天场景和相关人设切片 | `src/core/persona-projection.ts` |
| 模型调用 | 统一调用 OpenAI 兼容接口、Anthropic、MiniMax 等 | `src/core/model-provider.ts` |
| 记忆系统 | 记忆读写和检索 | `src/core/memory.service.ts` |
| 向量检索 | 用 embedding 和 pgvector 找相关记忆 | `src/embeddings/`, `src/vector-index/` |
| Reflection | 复盘并生成记忆提案 | `src/reflection/` |
| Dream | 闲时整理、内在日记、信号提取 | `src/dream/` |
| 工具系统 | 让模型调用外部能力 | `src/tools/` |
| 草稿 | 保存待审核内容 | `src/drafts/` |
| 网页读取 | 读 URL、页面、浏览器内容 | `src/page-reader/`, `src/cdp-browser/` |
| 搜索 | Tavily 网页搜索 | `src/web-search/` |
| 外部 inbox | 同步外部平台消息 | `src/external-inbox/` |
| Telegram | Telegram Bot 接入 | `src/channels/telegram/` |
| 微信桥接 | 微信入口 | `src/channels/weixin/` |
| 管理接口 | 管理记忆、运行状态、配置等 | `src/routes/admin.route.ts` |
| 网页前端 | 聊天页和管理页 | `web/` |
| 数据库结构 | 所有表定义 | `prisma/schema.prisma` |

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

至少需要配置：

```env
DATABASE_URL="postgresql://lusiyuan:password@localhost:5432/lusiyuan_core"
ADMIN_API_TOKEN="change-this-to-a-long-random-string"

ACTIVE_MODEL_PROVIDER="openai"
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_API_KEY="your-api-key"
OPENAI_MODEL="gpt-4.1-mini"
```

也可以使用 Qwen、DeepSeek、GLM、MiniMax、Anthropic 等提供商。具体配置看 `.env.example` 和 `src/utils/env.ts`。

### 3. 启动数据库

```bash
docker compose up -d
```

数据库使用 PostgreSQL + pgvector。

### 4. 初始化数据库

第一次启动或重建数据库时：

```bash
npx prisma migrate reset --force
```

日常 schema 变更时：

```bash
pnpm db:migrate
```

### 5. 启动后端

```bash
pnpm dev
```

后端默认监听：

```text
http://localhost:64100
```

### 6. 启动网页前端

另开一个终端：

```bash
pnpm web:install
pnpm web:dev
```

前端默认监听：

```text
http://localhost:64111
```

---

## 常用命令

```bash
pnpm dev                 # 启动后端开发服务
pnpm build               # TypeScript 构建
pnpm test                # 跑测试
pnpm smoke               # 后端 smoke test
pnpm web:dev             # 启动前端
pnpm web:build           # 构建前端
pnpm db:generate         # 生成 Prisma Client
pnpm db:migrate          # 执行 Prisma migration
```

Reflection / Dream / 工具调试：

```bash
pnpm reflection:run
pnpm reflection:inspect
pnpm reflection:apply
pnpm dream:run
pnpm dream:inspect
pnpm dream:diary
pnpm tools:inspect
```

---

## API 简单示例

### 健康检查

```bash
curl http://localhost:64100/health
```

### 发送一条聊天消息

```bash
curl -X POST http://localhost:64100/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "creator_lu",
    "channel": "web",
    "conversation_id": "web_default",
    "message": "你是谁？"
  }'
```

### 查看用户记忆

```bash
curl http://localhost:64100/v1/users/creator_lu/memories \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

---

## 可选功能怎么打开

### 语义记忆检索

默认可以不用开。开启后，记忆检索会更像“按意思搜索”。

```env
EMBEDDING_API_KEY="your-siliconflow-api-key"
MEMORY_RETRIEVAL_ENABLED=true
```

给历史记忆补 embedding：

```bash
pnpm embeddings:backfill
```

### 工具调用

```env
TOOLS_ENABLED=true
```

查看工具：

```bash
pnpm tools:inspect
```

### Reflection

```env
REFLECTION_ENABLED=true
```

运行一次：

```bash
pnpm reflection:run --daily
```

### Dream Cycle

```env
DREAM_ENABLED=true
```

运行一次：

```bash
pnpm dream:run
```

定时运行：

```env
DREAM_AUTO_RUN=true
DREAM_CRON="30 3 * * *"
DREAM_TIMEZONE="Asia/Taipei"
```

### Telegram

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_MODE="polling"
```

启动：

```bash
pnpm telegram:dev
```

---

## 数据库里大概有什么

最核心的几类表：

- `User`：聊天用户。
- `Conversation`：一次会话。
- `Message`：原始聊天记录。
- `Memory`：长期记忆。
- `MemoryEmbedding`：记忆向量。
- `MemoryProposal`：待审核记忆提案。
- `ToolCallLog`：工具调用日志。
- `Draft`：草稿。
- `ReflectionJob` / `ReflectionReport`：反思任务和报告。
- `DreamJob` / `DailyNote` / `DreamSignal` / `DreamDiaryEntry`：Dream Cycle 产物。

更清楚的解释看 `project-handbook/data-map.md`。

---

## 开发时要注意

1. 改聊天主链路时，同步看 `src/core/chat.service.ts`、`src/core/prompt-builder.ts`、`src/core/persona-projection.ts`。
2. 改数据库时，同步更新 `prisma/schema.prisma`、migration、`project-handbook/data-map.md`。
3. 改项目结构时，同步更新 `project-handbook/project-map.md`。
4. 改调用流程时，同步更新 `project-handbook/flows.md`。
5. 改陆思源人设、聊天投影、运行体设计时，同步更新 `persona/README.md` 和 `project-handbook/runtime-lite-design.md`。

---

## 当前 Runtime 状态

项目已经有 Runtime Lite 的第一块正式能力：

- `persona/chat_profiles/`：稳定聊天投影。
- `persona/runtime/core.md`：每轮聊天固定带上的常驻核心。
- `persona/runtime/default_state.md`：默认运行态种子。
- `src/core/persona-projection.ts`：选择聊天投影和人设切片。
- `RuntimeState`：数据库里的全局当前状态。
- `RuntimeEvent`：记录聊天、复盘、梦境、自启动这些发生过的事。
- `RuntimeStateEvent`：记录真正写入 RuntimeState 的状态变化。
- `PersonIdentity` / `IdentityLink`：把多个渠道账号手动绑定到同一个现实身份。
- `RelationshipState`：记录陆思源和每个现实身份之间的关系状态。
- `RelationshipStateEvent`：记录关系状态每次为什么变化。
- 运行态更新策略：支持规则校准，也支持 LLM 提议 statePatch 后由程序校验写入；只在 owner、复盘、梦境、自启动和 admin 这些受控入口生效。
- `web/src/components/admin/RuntimeStatePage.tsx`：admin 里的运行态可视化、事件日志、状态变更和自启动控制页面。
- `web/src/components/admin/RelationshipStatePage.tsx`：admin 里的用户关系状态页面。

还没有完成的正式 Runtime：

- 更细的 RuntimeEvent 内部过程，比如 perception、stance、expressionPlan、afterthought。
- 更细的长期目标、未解决问题、自我叙事拆分。

正式设计看 `project-handbook/runtime-lite-design.md`。
