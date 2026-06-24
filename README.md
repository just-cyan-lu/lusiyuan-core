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
- 工具系统：让陆思源可以查项目状态、搜索记忆、读网页。
- Skill 系统：把“小红书回复”这类平台工作流做成可配置能力。
- 表达学习：从 owner 的最终回复和不回复决定中学习怎样表达。
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

普通聊天默认不会立刻改 Relationship State，而是先写入一条“关系信号”。当信号积累到一定数量，或 admin 手动点击复盘时，程序会把一段连续互动归纳成一次关系更新。旧的每轮聊天直接更新模式仍然保留，可以在配置里切换。

admin 可以在后台查看、复盘、修改和重置关系状态。

跨渠道身份不会自动确认。`telegram:123`、`weixin:abc`、`web:uuid` 默认是不同渠道账号；如果用户明确说自己是谁，或显示名很像已有身份，系统只会提交一条“身份怀疑”给 admin。只有 admin 审核通过后，才会共享同一个现实身份和同一份关系状态。

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

对应代码：

- `src/tools/`
- `src/tools/builtin/`

### Skill

Skill 是项目内部的一套可复用能力。

它和 Tool 不一样：

- Tool 偏向“模型在聊天中临时调用一个外部能力”。
- Skill 偏向“系统里某类正式工作流程”，会有自己的规则、开关、入口和输出约束。

现在已有的 skill 是 `xiaohongshu_reply`。它负责小红书帖子、评论和待审核回复草稿。

它会让 LLM 根据小红书帖子语境和评论内容判断：

- 这是不是该回复
- 评论属于什么类型
- 有没有私联、边界、攻击、技术问题等风险
- 是否必须交给 owner 审核
- 应该用思源口吻、创作者口吻还是混合口吻
- 最终草稿应该怎么写

admin 里可以编辑小红书回复 skill 的 prompt 规范。帖子、评论和草稿保存在数据库里；草稿是可直接修改的普通文本，回复永远不会自动发送。

### Expression Learning

Expression Learning 是通用表达学习模块。

它记录一次回复里的四样东西：当时发生了什么、思源原本怎么回、owner 最终怎么处理、这次可以学到什么。owner 可以直接采用草稿、修改后发布、完全自己写，或者决定不回复。

这些经验不会写进 Persona 或 Memory。生成新回复时，系统只检索少量同平台、同场景的相似经验，帮助思源逐渐接近 owner 的判断和表达习惯。

当前首先接入小红书；以后 B站、Twitter/X 和聊天可以复用同一套底层。具体设计见 `project-handbook/expression-learning.md`。

对应代码：

- `src/skills/xiaohongshu-reply/`
- `web/src/components/admin/SkillsAdminPage.tsx`

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
| 配置系统 | 数据库实时运行配置、校验和变更通知 | `src/config/`, `web/src/components/admin/ConfigCenterPage.tsx` |
| 记忆系统 | 记忆读写和检索 | `src/core/memory.service.ts` |
| 向量检索 | 用 embedding 和 pgvector 找相关记忆 | `src/embeddings/`, `src/vector-index/` |
| Reflection | 复盘并生成记忆提案 | `src/reflection/` |
| Dream | 闲时整理、内在日记、信号提取 | `src/dream/` |
| 工具系统 | 让模型调用外部能力 | `src/tools/` |
| Skill 系统 | 管理小红书回复这类平台工作流 | `src/skills/`, `web/src/components/admin/SkillsAdminPage.tsx` |
| 表达学习 | 从 owner 最终回复中形成可检索经验 | `src/expression-learning/`, `web/src/components/admin/ExpressionLearningPage.tsx` |
| 对话追溯 | 按现实身份查看渠道账号、会话和消息 | `web/src/components/admin/ConversationHistoryPage.tsx`, `src/routes/admin.route.ts` |
| 网页读取 | 读 URL、页面、浏览器内容 | `src/page-reader/`, `src/mcp/chrome-devtools-mcp.service.ts` |
| 搜索 | Tavily 网页搜索 | `src/web-search/` |
| 外部 inbox | 同步外部平台消息 | `src/external-inbox/` |
| Telegram | Telegram Bot 接入 | `src/channels/telegram/` |
| 微信桥接 | 微信入口 | `src/channels/weixin/` |
| 管理接口 | 管理记忆、运行状态、配置、Reflection、Dream 等 | `src/routes/admin.route.ts`, `src/routes/reflection.route.ts`, `src/routes/dream.route.ts` |
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

至少需要配置启动安全信息和一个模型连接：

```env
DATABASE_URL="postgresql://lusiyuan:password@localhost:5432/lusiyuan_core"
ADMIN_API_TOKEN="change-this-to-a-long-random-string"

OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_API_KEY="your-api-key"
OPENAI_MODEL="gpt-4.1-mini"
```

也可以配置 Qwen、DeepSeek、GLM、MiniMax、Kimi、Anthropic 等连接。启动后在 Admin“配置 / 运行配置”里选择当前模型渠道，保存后下一次模型调用立即使用。

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

开发期也可以在 admin 的“配置中心”里清空数据库业务数据。这个按钮需要 Admin Token、`.env` 里的 `ADMIN_DATABASE_CLEAR_PASSWORD`，还要输入确认文字。它只清聊天、用户、记忆、运行态、关系状态、Dream/Reflection 产物和工具日志；数据库运行配置、Skill 配置、配置变更记录、`.env`、persona、项目文档和 Prisma migration 会保留。

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

在 `.env` 配置 `EMBEDDING_API_KEY`，再在 Admin 运行配置里开启“记忆检索”。

给历史记忆补 embedding：

```bash
pnpm embeddings:backfill
```

### 工具调用

在 Admin 的“工具”或“配置 / 运行配置”页面开启工具层和具体工具访问模式，保存后立即生效。

查看工具：

```bash
pnpm tools:inspect
```

### 小红书回复 Skill

默认是 owner/admin 可用，只生成待审核草稿，不自动发送。访问模式和 prompt 都在 Admin“Skills”页面修改并立即生效。

也可以在 admin 的“Skills”页面查看和编辑 prompt 规范，在“小红书工作台”里维护账号镜像、生成草稿、记录真实最终回复或不回复决定。每次最终决定会进入通用表达学习模块。

小红书工作台可以直接粘贴帖子 URL。系统通过 `chrome-devtools-mcp` 读取已登录 Chrome 当前加载的标题、文案和评论线程，并写入账号镜像；读取后的页面不会自动关闭。

Chrome MCP 开关、连接方式、15 秒新开冷却和 3–5 秒稳定等待都在 Admin 运行配置里修改。

自动连接模式需要先在 Chrome 的 `chrome://inspect/#remote-debugging` 开启远程调试。也可以把连接方式改为 `browser_url`，再配置本地调试地址。

同一 URL 会优先复用现有页面；新开页面至少间隔 15 秒，读取前会随机等待 3–5 秒让页面稳定。导入不会刷新或滚动，只会有限点击当前已加载评论里的“展开 N 条回复”。程序直接按 DOM 还原“顶层评论 + replies”，记录具体回复目标和“作者”标记，不让 LLM 猜评论关系。

### Reflection

Reflection 开关和规则在 Admin 运行配置里修改，保存后立即生效。

运行一次：

```bash
pnpm reflection:run --daily
```

也可以在 admin 的“Reflection”页面手动运行并查看报告详情。

### Dream Cycle

Dream 开关和规则在 Admin 运行配置里修改。

运行一次：

```bash
pnpm dream:run
```

也可以在 admin 的“Dream”页面手动运行，并查看作业状态、Morning Brief、Deep Sleep、Daily Note、Signal 和 Dream Diary。

Dream 自动运行、Cron 和时区保存后会立即停止旧定时器并重新排程。

### Telegram

在 `.env` 配置 `TELEGRAM_BOT_TOKEN`；Telegram 开关在 Admin 运行配置里修改，可以即时启动或停止。

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
- `SystemSetting` / `SystemSettingEvent`：实时运行配置和每次修改记录。
- `SkillConfig`：admin 编辑后的 skill 开关和 prompt 配置。
- `XiaohongshuPost` / `XiaohongshuComment` / `XiaohongshuReplyDraft`：小红书帖子、二维评论线程和草稿；真实作者回复也是评论线程中带 `isAuthor` 的节点，不重复存表。
- `ExpressionLearningExample` / `ExpressionLearningEmbedding`：owner 表达决定和对应的相似案例向量。
- `ToolCallLog`：工具调用日志。
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
6. 改运行配置来源或即时重载方式时，同步更新 `project-handbook/configuration.md`。

---

## 当前 Runtime 状态

项目已经有 Runtime Lite 的第一块正式能力：

- `persona/chat_profiles/`：稳定聊天投影。
- `persona/runtime/core.md`：每轮聊天固定带上的常驻核心。
- `persona/runtime/default_state.md`：默认运行态种子。
- `src/core/persona-projection.ts`：选择聊天投影和人设切片。
- `RuntimeState`：数据库里的全局当前状态。
- `RuntimeEvent`：记录聊天、复盘、梦境、自启动这些发生过的事。
- `RuntimeStateEvent`：记录真正写入 RuntimeState 的状态变化，并保存它来自哪些运行事件和消息；一次变化可以对应多条 message ID。
- `PersonIdentity` / `IdentityLink`：把多个渠道账号绑定到同一个现实身份。
- `IdentityLinkProposal`：系统怀疑相似用户时写入的待审核提案，审核通过后才会合并。
- `RelationshipState`：记录陆思源和每个现实身份之间的关系状态。
- `RelationshipStateEvent`：记录关系信号和关系状态每次为什么变化。
- 运行态更新策略：支持规则校准，也支持 LLM 提议 statePatch 后由程序校验写入；只在 owner、复盘、梦境、自启动和 admin 这些受控入口生效。
- `web/src/components/admin/RuntimeStatePage.tsx`：admin 里的运行态可视化、事件日志、状态变更和自启动控制页面。
- `web/src/components/admin/RuntimeStateSourceMaterials.tsx`：admin 里查看一次状态变化背后的运行事件和消息来源。
- `web/src/components/admin/RelationshipStatePage.tsx`：admin 里的现实身份关系状态和身份怀疑审核页面。
- `web/src/components/admin/ConversationHistoryPage.tsx`：admin 里的现实身份对话追溯页，从现实身份查看渠道账号、会话和消息；只看证据，不修改关系。
- `web/src/components/admin/OpsPage.tsx`：admin 里的 Reflection / Dream 工作台，可以手动触发复盘或梦境循环，并查看报告、作业、Morning Brief、Deep Sleep、Daily Note、Signal 和内在日记。
- `web/src/components/admin/RuntimeEventDetail.tsx`：admin 里的运行事件解释组件，用来看事件有没有资格影响长期状态。
- `web/src/components/admin/StateChangeDetail.tsx`：admin 里的状态变化解释组件，用同一套方式展示变化前后、写入原因和原始记录。
- `web/src/components/admin/AdminDetailPrimitives.tsx`：admin 详情页共用展示组件，避免运行事件详情和状态变化详情重复造一套 UI。

还没有完成的正式 Runtime：

- 更细的 RuntimeEvent 内部过程，比如 perception、stance、expressionPlan、afterthought。
- 更细的长期目标、未解决问题、自我叙事拆分。

正式设计看 `project-handbook/runtime-lite-design.md`。
