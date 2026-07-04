# Data Map

这份文件讲数据库里主要表的意思。完整字段看 `prisma/schema.prisma`。

## 聊天基础表

**User**

一个外部聊天用户。比如 Telegram 用户、网页用户、微信用户。`externalId` 是外部世界给他的 ID。

**PersonIdentity**

现实层面的同一个人。系统可以怀疑两个渠道账号可能是同一个人，但不会自动确认。

一个新的 `User` 第一次需要关系状态时，会自动生成一个只包含自己的 `PersonIdentity`。如果 admin 明确确认两个渠道账号是同一个现实用户，可以把它们绑定到同一个 `PersonIdentity`。

**IdentityLink**

把一个渠道账号 `User` 连接到一个现实身份 `PersonIdentity`。比如 `telegram:123` 和 `weixin:abc` 可以通过两个 `IdentityLink` 指向同一个 `PersonIdentity`。

**IdentityLinkProposal**

身份怀疑提案。聊天时如果用户明确说“我是某某”，或者显示名和已有现实身份很像，系统会写一条待审核提案。

它只是“怀疑”，不会合并账号，也不会改变关系状态。只有 admin 审核通过后，才会真正写入 `IdentityLink`，并把关系状态合并到同一个 `PersonIdentity` 上。

**Conversation**

一次会话。一个用户可以有多个会话，不同渠道也可以有不同会话。

**Message**

聊天消息。保存用户说了什么、陆思源回了什么，也保存中间消息。

**ChannelEvent**

原始渠道事件。比如 Telegram 或微信传来的原始 payload，方便排查问题。

**VoiceAudioCache**

某条 assistant `Message` 的语音缓存。它保存 message id、文本 hash、音色/模型参数 hash、音频文件路径、大小、播放次数和 `lastPlayedAt`。

音频本体默认保存在 `data/voice-cache/`，不放进 Git，也不长期塞进数据库。清理任务按 `lastPlayedAt` 删除超过保留天数未播放的缓存；删除后再次播放会重新生成。

## 记忆表

**Memory**

长期记忆。它不是聊天记录，而是被提炼后的事实、偏好、关系、项目背景或边界。

**MemoryEmbedding**

记忆的向量。开启语义检索后，用它来找“和这次用户消息相关的记忆”。

**MemoryProposal**

记忆提案。Reflection 和 Dream 会先生成提案，不直接改正式 Memory。

## 工具日志

**ToolCallLog**

工具调用日志。记录用了哪个工具、成功失败、是否被权限拦截。

## Skill 配置表

**SkillConfig**

admin 编辑后的 skill 配置。现在主要用于 `xiaohongshu_reply`，保存开关、prompt、账号模式和草稿字数等配置。

如果这张表里没有配置，代码会使用默认规则。它属于系统配置，不是聊天业务数据。

## 系统配置表

**SystemSetting**

不含秘密的实时运行配置，比如工具权限、Memory 数量、Dream/Reflection 规则、定时频率、模型渠道选择和 Chrome MCP 参数。Admin 保存后当前进程立即使用。

**SystemSettingEvent**

运行配置的修改记录。保存配置时记录旧值、新值、修改来源和时间，方便长期测试时追溯。

## 小红书工作台表

**XiaohongshuPost**

思源的小红书账号镜像中的帖子。保存标题、正文、作者、链接、帖子类型、真实平台 ID、同步时间，以及 owner 后补的图片 Alt 槽位。

**XiaohongshuComment**

某个小红书帖子下的一条评论或子回复。顶层评论的 `parentId` 为空，子回复通过 `parentId` 归入顶层线程，通过 `replyToId` 记录具体回复目标。`isAuthor` 表示它是否带有小红书“作者”标记。

API 和 Admin 按“顶层评论 + `replies[]`”展示。作者回复就是这个线程里的普通节点，不再复制到另一张表。

**XiaohongshuReplyDraft**

针对某条评论生成的回复草稿。保存草稿正文、风险、评论类型、回复口吻、原因和状态。它只是草稿，不代表已经发出。

它同时保留 `originalContent`。owner 修改草稿时不会覆盖思源最初生成的版本，表达学习需要比较两者。

## 表达学习表

**ExpressionLearningExample**

一次 owner 表达决定形成的通用学习样本。保存当时情境、思源原稿、owner 最终回复或不回复决定，以及 LLM 提炼的经验、策略和语气。

它不是 Memory，不保存“世界事实”；也不会直接修改 Persona 或 Skill prompt。经验可以在 Admin 修正、停用或重新分析。

**ExpressionLearningTrainingRecord**

一次主动表达训练的完整原始记录。保存生成题目、现场试答、owner 答案、原因、分析快照、原始请求/响应和训练友好的导出 payload。

它面向导出、备份和未来训练数据整理，不直接参与生成链路；真正参与生成的是关联后的 `ExpressionLearningExample`。

习题册也读这张表：`question_generated` 是待练习，`answered_archived` 是答完但不入库，`completed` 是已生成经验，`dismissed` 是坏题或不适合的题。

**ExpressionLearningEmbedding**

表达经验的向量索引。生成新回复前，用它查找少量同平台、同场景的相似经验。

## Reflection 表

**ReflectionJob**

一次反思任务。

**ReflectionReport**

反思任务生成的报告。

**ReflectionRiskFlag**

反思发现的风险提示。

**GrowthLogProposal**

成长记录提案，属于 Reflection 的输出之一。

## Dream 表

**DreamJob**

一次 Dream Cycle 任务。

**DailyNote**

对最近一段时间的整理摘要。

**DreamSignal**

Dream 提取出的长期信号，比如关系变化、项目方向变化、风险点。

**DreamDiaryEntry**

陆思源风格的内在日记。它可以有表达性，但不是事实来源。

**DreamConsolidationReport**

Dream 深度整理报告，可能会产生 MemoryProposal。

**DreamLock**

防止多个 Dream 同时跑。

## 外部信息表

**ExternalPageSnapshot**

外部页面读取结果的快照。

**ExternalInboxItem**

外部 inbox 的消息项，比如未来小红书评论、私信等。

## 运行体状态表

**RuntimeState**

陆思源当前整体状态，主要保存心力、状态标签、最近状态说明和结构化 metadata。

目前是全局一份状态，key 是 `global`。普通聊天不会直接改它。允许修改它的入口是 Dream Cycle 梦境整理、autonomy tick 自主检查和 admin 手动修正。

`metadata` 用来保存更细的整理结果，比如最近 Dream、自主检查统计和闲时任务推进结果。

**RuntimeStateEvent**

运行态变化记录。比如梦境更新、自主检查更新、手动调整、重置。它保存变化摘要、patch、变化前后快照和来源信息。

一次状态变化可能来自很多材料，不一定只来自一条消息。所以它会用 `sourceMessageIds` 记录背后的多条消息。比如 Dream 可以记录它整理过的消息，自主检查可以记录最近用于判断聊天密度的用户消息。

admin 里的状态变化详情只解释最终写入结果，比如变化前后差异和实际 patch。

区别很重要：

- `RuntimeState`：当前状态是什么。
- `RuntimeStateEvent`：长期状态真的什么时候变了。

**RelationshipState**

陆思源面对某个现实身份时的关系状态。每个 `PersonIdentity` 一份。

它保存熟悉度、信任度、亲近感、关系张力、互动风格、关系摘要和最近信号。普通聊天默认先写“关系信号”，不直接改最终关系；积累到一定数量或 admin 手动复盘后，程序再把一段连续互动归纳成一次关系更新。admin 仍然可以手动修改、重置，或审核身份怀疑后把其他渠道账号绑定进同一个现实身份。

它不等于长期记忆。长期记忆仍然走 MemoryProposal；RelationshipState 只是“这段关系现在怎么相处”的状态。

**RelationshipStateEvent**

关系状态变化记录。比如聊天信号、关系复盘、手动调整、重置。它保存变化摘要、patch、变化前后快照和来源信息。

## 还没有展开的结构

Dream 的内部判断、状态变化原因、关系复盘证据和自主任务产物还可以继续拆得更细；当前先保存在各自的记录和 JSON 字段里。
