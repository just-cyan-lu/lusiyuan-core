# lusiyuan-core

陆思源数字人的后端核心服务。

它负责接收聊天消息、读取人设和记忆、准备聊天上下文、调用大模型、执行工具、保存对话，并在空闲时推进 Dream 和自主任务。

## IP 与角色授权声明

本仓库中的程序代码按 GNU Affero General Public License v3.0 or later（AGPL-3.0-or-later）授权，完整条款见 `LICENSE`。

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

## 项目介绍

这个项目是陆思源的后台工作室。你可以把它理解成一个“数字人的控制台”：这里能看他现在的状态，整理他记住了什么，查看他和谁聊过，也能教他以后怎么表达。

Admin 后台目前主要有这些菜单：

- **总览**：一进门先看这里。它会告诉你当前模型、渠道、配置和系统状态有没有明显问题。
- **运行态**：看陆思源现在有没有劲、状态怎么样，以及他空闲时正在推进哪些自己的小任务。
- **关系**：管理“陆思源认识的人”。这里能看每个人的好感度、用户介绍、关系摘要、互动风格，也能把同一个人在不同平台的账号合并到一起。
- **记忆**：陆思源的长期便签盒。这里放的是事实、偏好、项目背景和反复出现的话题；你可以查看、修改、归档，也能追到这些记忆来自哪些聊天。
- **对话**：按现实身份查看聊天记录。适合回头翻“这个人之前都和思源聊过什么”。
- **表达学习**：教陆思源“像你一样回复”。可以手动教学，也可以做练习题，把好的回复经验保存下来。
- **Web Chat**：网页聊天入口。适合在浏览器里直接和陆思源测试聊天，也可以选择继续某个 web 对话。
- **梦境**：陆思源的睡后整理。它会把一段时间的聊天拿去复盘，整理关系、记忆、信号和日记。
- **运维台**：后台任务观察台。这里能看正在运行的任务，也可以停止卡住的聊天或后台任务。
- **Skills**：能力管理。用来查看和调整项目里注册的能力入口。
- **平台**：外部平台工作台。目前主要放小红书等平台相关能力，比如导入帖子、评论和后续回复流程。
- **工具**：查看工具调用和工具日志。适合排查“他刚刚到底用了什么能力”。
- **配置**：项目设置中心。模型、渠道、记忆检索、Dream、网页能力、代理等配置都在这里改。

简单说：

- 想看他“现在怎么样”，去 **总览** 和 **运行态**。
- 想看他“认识谁、记住了什么”，去 **关系**、**记忆**、**对话**。
- 想教他说话，去 **表达学习**。
- 想排查后台，去 **梦境**、**运维台**、**工具**。
- 想接平台或改模型，去 **平台** 和 **配置**。

---

## 安装与启动

下面是本地开发最短启动路径。

### 1. 准备环境

需要先装好：

- Node.js 22 或更高版本。
- pnpm。
- Docker，用来启动本地 PostgreSQL + pgvector 数据库。

如果你的 Node 自带 Corepack，可以这样启用 pnpm：

```bash
corepack enable
```

### 2. 拉代码并安装依赖

```bash
git clone <repo-url>
cd lusiyuan-core
pnpm install
```

### 3. 准备配置文件

```bash
cp .env.example .env
cp web/.env.example web/.env
```

至少建议先改 `.env` 里的这些：

- `ADMIN_API_TOKEN`：后台管理密码。打开 Admin 后填这个。
- `OPENAI_API_KEY` / `MINIMAX_API_KEY` / `KIMI_API_KEY` 等：选择你要用的模型供应商后，填对应 key。
- `WEB_ORIGIN`：默认是 `http://localhost:64111`，本地开发一般不用改。

如果只是先打开后台看看，可以先只填 `ADMIN_API_TOKEN`。要真正聊天，就需要配置可用的大模型 key。

### 4. 启动数据库

```bash
docker compose up -d
```

默认数据库地址已经写在 `.env.example` 里：

```text
postgresql://lusiyuan:password@localhost:5432/lusiyuan_core
```

### 5. 初始化数据库结构

```bash
pnpm db:generate
pnpm db:push
```

`db:push` 会把 Prisma 数据结构推到本地数据库，也会补 pgvector 相关索引。

### 6. 启动后端

```bash
pnpm dev
```

后端默认地址：

```text
http://localhost:64100
```

### 7. 启动前端

另开一个终端：

```bash
pnpm web:dev
```

前端默认地址：

```text
http://localhost:64111/admin
```

Web Chat 地址：

```text
http://localhost:64111/admin/chat
```

打开后台后，把 `.env` 里的 `ADMIN_API_TOKEN` 填到左侧的 Admin Token 输入框里，就可以开始使用后台页面。

---

## 先看这里

如果你只是想知道项目现在有哪些部分，建议先看：

- `AGENTS.md`：代码代理在本项目里的长期工作规则。
- `project-handbook/README.md`：项目手册入口，适合快速定位当前模块。
- `project-handbook/project-map.md`：模块地图。
- `project-handbook/flows.md`：消息、工具、后台任务怎么流动。
- `project-handbook/data-map.md`：数据库表的简单解释。
- `project-handbook/configuration.md`：运行时配置和 `.env` 配置的边界。
- `project-handbook/expression-learning.md`：表达学习的当前说明。
- `docs/settings-config-audit-2026-06-25.md`：设置页面审计记录。
- `docs/runtime-autonomous-activity-2026-06-29.md`：运行态与自主活动重构记录。
- `docs/memory-redesign-2026-07-01.md`：记忆系统重构记录。

`docs/` 里多数是临时任务文档和专题设计；`project-handbook/` 更适合作为当前项目地图。

---

## 一条聊天消息的链路

一条文字消息发给陆思源后，后端大致会按下面这条链路处理。

1. **渠道接收消息**

   消息可能来自 Web Chat、Telegram、微信桥接，或者以后接入的其他平台。不同渠道会先把自己的消息格式整理成统一的聊天输入：谁发的、从哪个渠道来、属于哪个对话、正文是什么、有没有外部消息 ID。

2. **确认用户和对话**

   系统会找到或创建对应的 `User`，再把它绑定到一个现实身份 `PersonIdentity`。如果这个人已经从别的平台出现过，之后可以在 Admin 关系页合并身份。

   同时，系统会确认这条消息属于哪个 `Conversation`。Web Chat 可以选择继续某个 `web:...` 对话；微信这种只有名字的渠道，会用名字生成稳定的渠道用户。

3. **保存用户消息**

   用户这句话会先写入消息表。这样就算后面模型调用失败，也能知道这轮对话发生过什么。

4. **准备回复资料包**

   在真正调用模型前，系统会并行准备几类资料：

   - 陆思源的人设和当前聊天投影。
   - 当前用户的关系档案：好感度、用户介绍、关系摘要、互动风格。
   - 运行态：心力、状态标签、最近状态备注。
   - 最近原文热区、较早对话摘要、相关旧原文窗口。
   - 和当前话题相关的记忆。

   这些资料会一起组装成 prompt，让模型不是凭空回复，而是在“陆思源是谁、对方是谁、刚刚聊到哪、以前记住了什么”的基础上回复。

5. **判断这一轮要不要给工具**

   普通聊天不会默认把所有工具都开放给模型。系统会先看用户这句话有没有明显工具意图：

   - 问“还记得吗”“之前聊过什么”：开放 `search_memories`。
   - 说“搜一下”“查一下最新”：开放 `web_search`。
   - 发 URL 或让他看网页/帖子/文章：开放 `read_page`。

   如果没有明显需要工具，就直接进入普通模型回复，少走一轮工具判断。

6. **调用模型生成回复**

   如果这一轮没有工具，模型会直接根据 prompt 生成最终回复。

   如果这一轮有工具，模型可以先发起工具调用。工具执行完成后，工具结果会回到模型上下文里，再由模型生成最终回复。

   Web Chat 等待时只会显示等待气泡；工具执行中会显示类似“正在搜索网页…”“正在读取页面…”的状态，不会额外发送固定中间回复。

7. **整理最终回复并投递**

   模型的最终回复会先经过输出清理，再根据回复投递配置决定是一条发出，还是自然拆成几条气泡。拆分后的每一条最终回复都会写入消息表。

8. **维护后续索引和关系信号**

   回复完成后，系统会在后台维护一些后续材料：

   - 给新消息维护聊天上下文索引。
   - 记录身份线索，方便以后判断同一个人是否跨平台出现。
   - 观察这轮聊天对关系档案有没有整理价值。
   - Dream 稍后会按时间窗口统一整理关系、记忆和日记。

如果要看每个阶段具体耗时，可以看后端终端里的聊天 trace 日志，格式类似：

```text
[chat:trace] turn=... stage=prepare_prompt_materials stageMs=...
```

这些日志会显示存消息、准备上下文、embedding、模型调用、工具调用、分条、落库分别花了多久。

---

## 1. 聊天上下文

陆思源每次回复前会准备一个分层资料包：最近原文、较早摘要、相关历史原文窗口。这样他既能接住刚刚发生的事，也能在需要时想起更早聊过的内容。

### 第一层：最近原文热区

系统会从当前对话里取最近的原文聊天，但不是按条数取，而是按字符预算取。

相关配置：

- `CHAT_CONTEXT_RECENT_MAX_CHARS`：最近原文热区预算。
- `CHAT_CONTEXT_MAX_CHARS`：全部上下文总预算。

读取时会做整理：

- 过滤工具调用前的临时中间消息。
- 如果陆思源一次最终回复被拆成多条气泡，会按 `replyGroupId` 合并回一条完整回复。
- 排除本轮刚写入数据库的用户消息，避免同一句话在 prompt 里重复出现。

这层负责让陆思源知道“刚刚聊到哪里了”。

### 第二层：较早对话摘要

离当前较远的对话不会一直完整塞进 prompt。系统会在后台把热区之外的历史聊天压缩成摘要，存到 `conversation_context_summaries`。

摘要会保留来源范围，比如从哪条消息到哪条消息、时间范围、消息数量。以后要审计、导出或重新生成，都还有依据。

相关配置：

- `CHAT_CONTEXT_COMPACT_ENABLED`：是否自动压缩较早聊天。
- `CHAT_CONTEXT_SUMMARY_MAX_CHARS`：摘要最多放入多少字符；`0` 表示不放摘要。

这层负责保留更早的事实、约定、偏好和未完成事项，同时减少噪声。

### 第三层：相关历史原文窗口

如果开启 `CHAT_CONTEXT_RECALL_ENABLED`，系统会把当前问题做向量检索，从历史消息里找到语义相关的消息。

命中后，它不是只给模型一句模糊摘要，而是把命中消息前后的原文窗口放进 prompt。这样当用户问“我们以前是不是说过这个”时，陆思源能看到当时附近的真实对话。

相关配置：

- `CHAT_CONTEXT_RECALL_ENABLED`：是否开启历史原文向量召回。
- `CHAT_CONTEXT_RECALL_MAX_CHARS`：召回窗口最多放入多少字符。

历史消息需要先有 embedding。可以用：

```bash
npm run context:index
```

给历史聊天补索引。新消息会在聊天后自动维护索引。

### 相关代码

- `src/core/conversation-context.service.ts`：三层上下文总调度。
- `src/core/chat-context.ts`：最近原文热区整理和裁剪。
- `src/core/conversation-context-summary.service.ts`：较早对话压缩摘要。
- `src/core/conversation-recall.service.ts`：历史原文窗口召回。
- `src/core/message-embedding.service.ts`：聊天消息 embedding 维护。
- `src/core/prompt-builder.ts`：把上下文、人设、记忆、运行态组装成 prompt。

---

## 2. 运行态与自主活动

运行态负责保存陆思源当前的心力和最近状态；自主任务系统负责记录和推进他正在做的事，并把每次推进产出的内容落库。

### 运行态只管心力和最近状态

`runtime_states` 当前只保留：

- `energyLevel`：心力，0-100，表示陆思源当前有没有劲。
- `moodLabel`：状态标签，由 `energyLevel` 自动映射。
- `recentEventSummary`：最近一次状态相关事件。
- `statusNote`：状态备注。
- `metadata`：最近 Dream、自主检查等结构化附加信息。

### 心力如何映射状态标签

`moodLabel` 不手动填写，而是根据 `energyLevel` 自动映射：

- `0-15`：很低电
- `16-30`：安静，需要缓一缓
- `31-45`：有点累，但稳定
- `46-65`：平稳在线
- `66-80`：被点亮了一点
- `81-100`：兴致很高

### 哪些入口会影响运行态

现在能写运行态的入口只有：

- Admin 手动调整。
- Dream 完成后写入整理摘要和元数据。
- 自主检查根据聊天密度调整心力。

单轮聊天不会直接改运行态。Dream 需要整理时会读取对应时间窗口内的聊天原文；自主检查统计聊天密度时直接读取消息表。

### 自主任务系统

“陆思源正在做什么”由自主任务系统负责。

相关表：

- `autonomous_tasks`：长期任务，比如读一本书、整理游戏攻略、准备小红书内容。
- `autonomous_task_runs`：某一次推进记录。
- `autonomous_artifacts`：某次推进留下的产物，比如笔记、草稿、计划、反思。

当前任务类型：

- `reading`：读书/资料。
- `game_research`：游戏研究。
- `content_creation`：内容创作。
- `self_growth`：自我整理。
- `open_research`：开放研究。
- `custom`：自定义。

每次推进只做一小步，避免 AI 一口气把长期任务全部“想完”。一次推进会要求模型输出：

- 本轮摘要。
- 本轮计划。
- 本轮产物。
- 当前进度。
- 下一步。
- 是否完成。

### 自主检查

自主检查负责判断陆思源空闲时能不能做自己的事。

规则：

- 最近 2 小时聊天轮数达到 `RUNTIME_AUTONOMY_HIGH_CHAT_COUNT`：心力下降，暂停闲时任务。
- 最近 2 小时聊天轮数小于等于 `RUNTIME_AUTONOMY_LOW_CHAT_COUNT`：心力缓慢恢复，并尝试推进一个 active 自主任务。
- 中间区间：只记录检查结果，不额外推进任务。

相关配置：

- `RUNTIME_STATE_AUTO_UPDATE_ENABLED`：控制 Dream 和自主检查是否能自动写入心力/最近状态。
- `RUNTIME_AUTONOMY_AUTO_RUN`：是否按 cron 自动运行自主检查。
- `RUNTIME_AUTONOMY_CRON`：自主检查频率。
- `RUNTIME_AUTONOMY_LOW_CHAT_COUNT`：低聊天阈值。
- `RUNTIME_AUTONOMY_HIGH_CHAT_COUNT`：高聊天阈值。

### Admin 页面

Admin 的运行态页面现在包括：

- 心力和状态标签。
- 最近事件和状态备注。
- 自主任务列表。
- 新建任务。
- 暂停、继续、完成、放弃任务。
- 手动推进任务一步。
- 查看最近产物。
- 查看状态变更审计和来源消息。

### 相关代码

- `src/runtime/runtime-state.service.ts`：运行态、状态变更、自主检查。
- `src/runtime/autonomous-task.service.ts`：自主任务、推进记录、产物生成。
- `src/runtime/runtime-autonomy-scheduler.ts`：自主检查定时器。
- `src/routes/admin.route.ts`：运行态和自主任务 Admin API。
- `web/src/components/admin/RuntimeStatePage.tsx`：Admin 运行态页面。
- `web/src/api/lusiyuan-api.ts`：前端 API 类型和请求。

---

## 3. 关系复盘与关系档案

关系模块负责维护陆思源对每个现实身份的长期认识。每个现实身份只有一份关系档案，Dream 会在一段时间后做整体关系复盘，再决定要不要更新档案。

### 身份和渠道账号

系统区分两个概念：

- `User`：某个渠道上的账号，比如 web 用户、小红书用户、Telegram 用户。
- `PersonIdentity`：现实里的同一个人，可以绑定多个渠道账号。

一个人可能先在 web 聊天，后来又从小红书、B 站、微信出现。系统会先为每个渠道账号建 `User`，再通过 `IdentityLink` 绑定到同一个 `PersonIdentity`。

Admin 关系页支持：

- 查看每个现实身份绑定了哪些渠道账号。
- 修改身份名称。
- 修改渠道账号昵称。
- 合并两个身份。
- 从一个身份里拆分部分渠道账号。
- 查看身份怀疑，并由 admin 决定是否合并。

### 用户自助绑定身份

除了 Admin 手动合并，聊天里也支持用户自助绑定不同平台账号。

当用户明确说想绑定身份、换平台了、自己是之前某个平台聊过的人，或者发送类似“我是 xxx”的明确身份提示时，系统会先生成一个短时间有效的绑定码，比如 `CYAN-8K2Q7M`。陆思源会让用户去另一个平台也发送同一个绑定码。

另一个平台收到同一个绑定码后，系统会确认两个 `User` 属于同一个现实身份，然后复用关系合并逻辑，把当前账号所在的 `PersonIdentity` 合并到发码账号对应的 `PersonIdentity`。这样两边后续共享同一份关系档案和个人记忆归属。

绑定码只用于确认“两个渠道账号是同一个人”。如果用户只是说了相似昵称但没有完成绑定码校验，系统仍然只会生成待审核的 `IdentityLinkProposal`，由 Admin 决定是否合并。

### 关系档案

每个 `PersonIdentity` 对应一条 `RelationshipState`。

当前主要字段：

- `affinity`：好感度，0-100，是唯一关系分数。
- `relationshipLabel`：由好感度映射出来的关系标签。
- `userIntroduction`：用户介绍，记录这个人在陆思源眼里是怎样的人。
- `summary`：关系摘要，记录两个人大概是什么关系、聊过什么。
- `interactionStyle`：互动风格，定义陆思源以后应该怎样和对方聊天。
- `statusNote`：admin 备注，只给后台看，不进入聊天 prompt。

聊天时会把好感度、用户介绍、关系摘要和互动风格放进 prompt；备注不会发给模型。

### Dream 关系复盘

Dream 现在有一个 `relationship_review` 阶段。

它会按现实身份分组读取当前 Dream 时间窗口内的聊天，结合当前关系档案和历史证据，生成一次整体复盘。

复盘不是只改好感度，而是一次性给出结构化 `proposedPatch`：

- 是否调整 `affinity`。
- 是否更新 `userIntroduction`。
- 是否更新 `summary`。
- 是否更新 `interactionStyle`。

好感度变化仍然走保守规则：

- 同频 trait 只加一次。
- 70 分以后上涨变慢。
- 30 分以下正向证据加分更明显。
- 客套、玩笑、偶尔一次的不明确表达不算证据。
- 负向证据包括明确敌意、否定陆思源价值、强价值冲突等。

### 自动维护和人工确认

每个身份都有“允许 Dream 自动维护”开关。

- 开启：Dream 复盘后自动应用到关系档案，并写入关系变更记录。
- 关闭：Dream 只生成待确认提案，显示在关系页的“待确认的关系复盘”里。

Admin 可以在“待确认的关系复盘”里应用或忽略提案。应用后才会真正修改关系档案。

### 关系变更

`RelationshipStateEvent` 是关系档案的审计流水。

它记录：

- 谁触发了变更，比如 `dream` 或 `admin`。
- 变更前快照。
- 准备写入的 patch。
- 变更后快照。
- 来源渠道、会话、用户等上下文。

关系页里的“关系变更”按时间线展示。点开一条记录后，右侧会展示实际改动和原始 JSON。

### 相关代码

- `src/runtime/relationship-state.service.ts`：关系档案、身份合并/拆分、复盘提案应用和关系变更记录。
- `src/runtime/identity-binding.service.ts`：聊天里的短时身份绑定码、发码和兑换。
- `src/core/chat.service.ts`：聊天入口会先识别绑定意图和绑定码，再决定是否走普通 LLM 回复。
- `src/dream/dream-relationship-review-organizer.ts`：Dream 关系复盘。
- `src/dream/dream-prompts.ts`：关系复盘 prompt。
- `src/routes/admin.route.ts`：关系模块 Admin API。
- `web/src/components/admin/RelationshipStatePage.tsx`：Admin 关系页面。
- `web/src/components/admin/StateChangeDetail.tsx`：关系变更详情展示。
- `web/src/api/lusiyuan-api.ts`：前端 API 类型和请求。

---

## 4. 记忆系统

记忆系统负责保存“以后聊天还可能用得上的事实、偏好、经历、项目背景和反复出现的话题”。它不是关系档案，也不是聊天原文备份。

三者边界是：

- 关系档案：记录这个人是谁、陆思源和这个人是什么关系、该怎么和这个人说话。
- 记忆：记录稳定事实、明确偏好、持续项目、反复出现的话题。
- 聊天上下文：记录当时具体怎么说的，尤其是相关历史原文窗口。

聊天时，关系档案会稳定进入 prompt；记忆只有和当前话题相关时才进入 prompt；原文窗口用于回答“我们之前具体怎么聊过”。

### 记忆归属

个人记忆绑定到 `PersonIdentity`，不是绑定到某个渠道账号。

这意味着同一个人如果有 web、微信、Telegram、小红书等多个渠道账号，只要这些账号合并到同一个身份，记忆也会跟着归到这个现实身份下面。

记忆的 `scope` 有四类：

- `person`：某个具体身份的个人记忆。
- `global`：跨场景都可能有用的稳定背景。
- `project`：项目事实、技术决策、产品方向。
- `topic`：反复出现的公共话题或阶段性趋势。

个人资料、偏好和经历优先放 `person`；项目决策放 `project`；多人都在聊的公共话题可以整理成 `topic`；真正跨场景稳定成立的内容才放 `global`。

### 记忆写入来源

个人记忆主要由 Dream 在关系复盘时自动写入，不需要 Owner 逐条审核。

Dream 会按身份读取一段时间窗口内的聊天，结合当前关系档案和现有记忆，一次性输出关系档案更新和 `memoryChanges`。这样“用户介绍、关系摘要、互动风格、好感度、个人记忆”会在同一轮整理里互相对齐。

记忆动作包括：

- `create_memory`：新增记忆。
- `reinforce_memory`：内容不变，只表示这条已有记忆被真实再次提起。
- `update_memory`：改写已有记忆内容。
- `supersede_memory`：已有记忆过时，标记为 superseded，并新建替代记忆。
- `archive_memory`：归档不再适用的记忆。

系统会校验 Dream 的输出：

- 只能用本轮 user 消息作为个人记忆证据。
- `sourceMessageIds` 会保留下来，方便以后查看证据链。
- 引用已有记忆时，`targetMemoryId` 必须真实存在并且归属正确。
- 同一条已有记忆在同一次 Dream 里只会落一个最终动作。
- 重复 create 会被改成 reinforce 或 update。
- 纠错、偏好反转、新旧冲突会优先 update 或 supersede，避免 prompt 里同时留下相反结论。

Deep Sleep 也可以从 Dream Signal 里写入 `global`、`project`、`topic` 记忆。非个人记忆必须有明确来源和持续价值，不会因为“很多人聊过类似东西”就直接污染全局记忆。

### 记忆层级

个人记忆分四层：

| 层级 | 含义 | 升级 | 过期 |
| --- | --- | --- | --- |
| `temp` | 临时记忆，先暂存观察 | 后续有效提及 1 次，升为 `short` | 5 个活跃聊天日没有再提起则归档 |
| `short` | 短期记忆，开始有一点稳定性 | 当前层级累计 5 次有效提及，升为 `mid` | 10 个活跃聊天日没有再提起则降回 `temp` |
| `mid` | 中期记忆，已经多次出现 | 当前层级累计 5 次有效提及，升为 `long` | 60 个活跃聊天日没有再提起则降回 `short` |
| `long` | 长期记忆，较稳定 | 不再自动升级 | 365 个活跃聊天日没有再提起则降回 `mid` |

“活跃聊天日”按这个身份有 user 消息的日子计算。一个人十天没来聊天，这十天不会推进遗忘。

“有效提及”也不是关键词撞上就算。必须由 Dream/整理器根据上下文判断：用户确实再次说到同一个事实、偏好、项目或经历，或者明确纠正、确认、更新了它。同一天同一条记忆最多计 1 次。

### 聊天时检索记忆

如果 `MEMORY_RETRIEVAL_ENABLED` 开启，聊天时会按当前身份和当前消息做记忆检索。

检索范围：

- 当前 `PersonIdentity` 下 active 的 `person` 记忆。
- `personId=null` 且 active 的 `global`、`project`、`topic` 记忆。

检索流程：

1. 把当前用户消息生成 embedding。
2. 用 pgvector 找语义相关记忆。
3. 过滤分数太低的候选，非个人记忆阈值更高。
4. 按语义相关性、最近提及时间、记忆类型、scope、tier 做轻量排序。
5. 最多取 `MEMORY_FINAL_TOP_K` 条放进 prompt。

不会为了“看起来重要”或“最近刚写过”无脑塞记忆。所有进入 prompt 的记忆都要和当前话题有相关性。

prompt 里的记忆会带上 scope、tier、type 和更新时间。记忆之间冲突时，模型会被要求优先参考更新时间更新、证据更明确的记忆；但记忆不能覆盖核心人设、关系档案和当前对话。

### Admin 记忆库

Admin 记忆页以身份为核心展示和维护记忆。

当前支持：

- 按身份、scope、状态、类型、时间范围筛选。
- 查看记忆层级、本层有效提及次数、最近提及时间、访问次数。
- 新增、编辑、归档记忆。
- 修改身份归属、scope、tier、内容、摘要、来源消息。
- 查看记忆证据链，回到来源消息附近看当时的上下文。
- 从关系详情页跳转到这个身份的记忆筛选结果。

记忆污染时，可以在 Admin 里直接改、归档或调整 scope。

### 相关代码

- `src/core/memory.service.ts`：记忆服务入口、创建记忆、生成 embedding。
- `src/core/memory-retrieval.service.ts`：聊天时的相关记忆检索。
- `src/core/memory-reranker.ts`：记忆候选排序。
- `src/core/memory-budget.ts`：最终进入 prompt 的记忆数量控制。
- `src/memory/memory-lifecycle.ts`：记忆层级升降和活跃聊天日过期规则。
- `src/embeddings/embedding-text.ts`：记忆 embedding 文本构造。
- `src/vector-index/pgvector-memory-index.ts`：pgvector 记忆索引。
- `web/src/components/admin/MemoryLibraryPage.tsx`：Admin 记忆库页面。

## 5. Dream 系统

Dream 是离线整理系统，不参与单轮回复。它按时间窗口读取消息、记忆和工具事件，把零散互动整理成可审计的中间产物，再决定哪些内容应该影响关系、记忆、日记和运行态。

它和聊天上下文的边界很清楚：聊天上下文负责当下这一轮怎么接话；Dream 负责事后整理发生过什么，以及这些内容有没有资格留下来。

当前 Dream 主要阶段：

1. `intake`：收集时间窗口内的消息、记忆和工具调用。
2. `light_sleep`：生成 `DailyNote`，只做每日摘要、要点、风险和待确认问题，不直接写长期记忆。
3. `rem_sleep`：生成 `DreamSignal`，提取可能值得长期关注的信号。
4. `dream_diary`：生成 `DreamDiaryEntry`，作为陆思源内部日记，不作为事实证据单独写入记忆。
5. `deep_sleep`：从 Dream Signal 里整理 `global`、`project`、`topic` 记忆，也可能生成成长记录提案和风险项。
6. `relationship_review`：按 `PersonIdentity` 分组做关系复盘，更新关系档案，并整理这个身份的个人记忆。
7. `runtime_state`：Dream 完成后把本轮整理摘要写入运行态事件和元数据。

### 来源语境

Dream 会区分消息来源，不把所有互动都当成同一种亲密聊天：

- `private_chat`：普通连续私聊，关系和记忆权重最高。
- `platform_comment`：公开平台评论，不是连续私聊。可以作为互动证据，但关系加权更轻。
- `platform_thread_reply`：评论区来回互动，比单条评论强一点，但仍然不是私聊。

例如小红书评论会镜像进【对话追溯】，并参与 Dream；但它们会标记 `useAsChatContext: false` 和 `continuity: "threaded"`，所以不会进入聊天时的最近原文、较早摘要、相关历史原文。只有当 Dream 把评论里的稳定事实、明确偏好、持续关注或认真反馈整理成记忆后，这条记忆才可能在后续聊天里被检索出来。

### 写入结果

Dream 主要会写入或影响这些长期状态：

- 关系档案：`relationship_review` 根据一段时间内的互动整体判断关系变化。
- 个人记忆：`relationship_review` 在关系复盘时同步整理这个身份的 `person` 记忆。
- 非个人记忆：`deep_sleep` 从 Dream Signal 里整理 `global`、`project`、`topic` 记忆。
- 运行态：`runtime_state` 把本轮整理摘要写入运行态事件和元数据。
- 内部日记：`dream_diary` 保存陆思源的内部视角，不直接当作事实证据。

### 相关代码

- `src/dream/dream-context-builder.ts`：Dream 输入材料收集和来源语境分类。
- `src/dream/daily-note.service.ts`：Light Sleep 每日摘要。
- `src/dream/dream-signal-extractor.ts`：REM Sleep 信号提取。
- `src/dream/dream-diary-writer.ts`：梦境日记。
- `src/dream/dream-relationship-review-organizer.ts`：按身份做关系复盘和个人记忆整理。
- `src/dream/dream-consolidator.ts`：Deep Sleep 写入全局、项目、话题记忆。
- `src/dream/dream-prompts.ts`：Dream 整理、关系复盘和冲突处理 prompt。
