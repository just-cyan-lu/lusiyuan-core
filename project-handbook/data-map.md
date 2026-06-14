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

目前是全局一份状态，key 是 `global`。普通聊天不会直接改它。允许修改它的入口是 owner 对话、Reflection 复盘、Dream Cycle 梦境整理、autonomy tick 自启动检查和 admin 手动修正。

`metadata` 用来保存更细的内在详情，比如内在天气、情绪色调、当前需要、内部张力、还在想的问题、关系信号和话题信号。

**RuntimeEvent**

陆思源经历过的事件日志。普通聊天、owner 对话、复盘、梦境、自启动检查都会写到这里。

它回答的是“发生了什么”，不代表状态一定变了。里面会保存事件类型、来源、摘要、重要度、主题、情绪/精力/压力/社交信号，以及这件事是否有资格影响长期状态。

**RuntimeStateEvent**

运行态变化记录。比如 owner 对话校准、复盘更新、梦境更新、自启动更新、手动调整、重置。它保存变化摘要、patch、变化前后快照和来源信息。

区别很重要：

- `RuntimeEvent`：发生了什么。
- `RuntimeStateEvent`：长期状态真的什么时候变了。

**RelationshipState**

陆思源面对某个现实身份时的关系状态。每个 `PersonIdentity` 一份。

它保存熟悉度、信任度、亲近感、关系张力、互动风格、关系摘要和最近信号。普通聊天可以让程序直接小幅更新它，不需要 admin 审核；admin 仍然可以手动修改、重置，或审核身份怀疑后把其他渠道账号绑定进同一个现实身份。

它不等于长期记忆。长期记忆仍然走 MemoryProposal；RelationshipState 只是“这段关系现在怎么相处”的状态。

**RelationshipStateEvent**

关系状态变化记录。比如聊天更新、手动调整、重置。它保存变化摘要、patch、变化前后快照和来源信息。

## 还没有展开的结构

现在已有的 `RuntimeEvent` 还是第一版，perception、statePatch、stance、expressionPlan、afterthought 这些更细结构还没有完全展开。
