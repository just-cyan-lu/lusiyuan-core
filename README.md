# lusiyuan-core

陆思源数字人的后端核心服务。

它负责接收聊天消息、读取人设和记忆、准备聊天上下文、调用大模型、执行工具、保存对话，并在空闲时推进 Dream 和自主任务。

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

如果你只是想知道项目现在有哪些部分，建议先看：

- `AGENTS.md`：代码代理在本项目里的长期工作规则。
- `project-handbook/README.md`：项目手册入口，适合快速定位当前模块。
- `project-handbook/project-map.md`：模块地图。
- `project-handbook/flows.md`：消息、工具、后台任务怎么流动。
- `project-handbook/data-map.md`：数据库表的简单解释。
- `project-handbook/configuration.md`：运行时配置和 `.env` 配置的边界。
- `project-handbook/expression-learning.md`：表达学习的当前说明。
- `docs/settings-config-audit-2026-06-25.md`：设置页面审计和后续可选项。
- `docs/runtime-autonomous-activity-2026-06-29.md`：运行态与自主活动重构记录。

`docs/` 里多数是临时任务文档和专题设计；`project-handbook/` 更适合作为当前项目地图。

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
- `src/dream/dream-relationship-review-organizer.ts`：Dream 关系复盘。
- `src/dream/dream-prompts.ts`：关系复盘 prompt。
- `src/routes/admin.route.ts`：关系模块 Admin API。
- `web/src/components/admin/RelationshipStatePage.tsx`：Admin 关系页面。
- `web/src/components/admin/StateChangeDetail.tsx`：关系变更详情展示。
- `web/src/api/lusiyuan-api.ts`：前端 API 类型和请求。
