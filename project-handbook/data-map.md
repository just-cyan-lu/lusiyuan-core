# Data Map

这份文件讲数据库里主要表的意思。完整字段看 `prisma/schema.prisma`。

## 聊天基础表

**User**

一个外部聊天用户。比如 Telegram 用户、网页用户、微信用户。`externalId` 是外部世界给他的 ID。

**Conversation**

一次会话。一个用户可以有多个会话，不同渠道也可以有不同会话。

**Message**

聊天消息。保存用户说了什么、陆思源回了什么，也保存中间消息。

**ChannelEvent**

原始渠道事件。比如 Telegram 或微信传来的原始 payload，方便排查问题。

## 记忆表

**Memory**

长期记忆。它不是聊天记录，而是被提炼后的事实、偏好、关系、项目背景或边界。

**MemoryEmbedding**

记忆的向量。开启语义检索后，用它来找“和这次用户消息相关的记忆”。

**MemoryProposal**

记忆提案。Reflection 和 Dream 会先生成提案，不直接改正式 Memory。

## 工具和草稿

**ToolCallLog**

工具调用日志。记录用了哪个工具、成功失败、是否被权限拦截。

**Draft**

草稿。比如回复草稿、文章草稿、脚本草稿。草稿不会自动发送。

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

陆思源当前整体状态，比如心情、精力、压力、社交电量、当前目标、最近关注、正在做的事和最近事件。

目前是全局一份状态，key 是 `global`。聊天可以用规则轻量更新，也可以切到 LLM 提议 statePatch 后由程序校验写入；admin 也可以手动修正。

`metadata` 用来保存更细的内在详情，比如内在天气、情绪色调、当前需要、内部张力、还在想的问题、关系信号和话题信号。

**RuntimeStateEvent**

运行态变化记录。比如规则观察、LLM 观察、手动调整、重置。它保存变化摘要、patch、变化前后快照和来源信息。

## 还没有实现但计划中的表

Runtime Lite 后续还建议新增：

**RelationshipState**

陆思源面对某个用户时的关系状态，比如熟悉度、信任度、互动风格、关系摘要。

**RuntimeEvent**

进入陆思源系统的完整事件日志。它可以保存 perception、statePatch、stance、expressionPlan、afterthought 等内部结构。

现在已有的 `RuntimeStateEvent` 只记录运行态变化，不等于完整 RuntimeEvent。
