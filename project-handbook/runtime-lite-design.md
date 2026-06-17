# Runtime Lite Design

这是陆思源运行体的正式版骨架设计。目标是稳，不是炫。

## 为什么要做

现在聊天已经不是简单的“完整人设 + 用户消息”。项目里已经有：

- persona 完整人设
- chat_profiles 聊天投影
- 长期记忆
- 最近对话
- Reflection
- Dream Cycle
- 工具系统

现在已经落地了三块数据库能力：

- 全局 `RuntimeState`：保存当前心情、精力、压力、社交电量、当前目标、最近关注和正在做的事。
- `RuntimeEvent`：记录陆思源经历过什么，普通聊天也会进入这里。
- `RelationshipState`：保存陆思源和每个现实身份之间的关系状态。

还缺的是更细的长期目标、自我叙事拆分，以及更完整的 RuntimeEvent 内部过程。

Runtime Lite 要解决这个问题。

## 核心原则

**MD 定义陆思源。**

`persona/` 负责稳定设定和表达规则。

**DB 延续陆思源。**

实时变化的状态、关系、最近事件必须进数据库。

**代码控制陆思源。**

程序决定使用哪个聊天投影、哪些状态能更新、哪些内容不能保存。

**LLM 帮陆思源理解和表达。**

LLM 可以提议状态变化，但不能直接改状态。

## 三张核心表

第一期只做三张表，不做十几张表。

### RuntimeState

陆思源整体当前状态。

当前已实现第一版：全局一份 `RuntimeState`，key 为 `global`。

重要规则：普通聊天不直接修改 `RuntimeState`。它只写入 `RuntimeEvent`，等复盘、梦境或自启动整理时再决定是否影响长期状态。

现在允许修改 `RuntimeState` 的入口是：

- owner 对话
- Reflection 复盘
- Dream Cycle 梦境整理
- autonomy tick 自启动检查
- admin 手动调整

更新策略仍然保留：`rules` 是规则校准，`llm` 是 LLM 提议 statePatch 后由程序校验。但这个策略只在上面这些允许入口生效。

为了避免一开始拆太多表，更细的内在状态先放在 `metadata`：内在天气、情绪色调、当前需要、内部张力、还在想的问题、关系信号和话题信号。

可以包含：

- 当前心情
- 精力
- 当前说话模式
- 当前关注点
- 当前目标
- 未解决问题
- 最近发生的事
- 最近 Dream 摘要
- 最近 Reflection 摘要
- 自我叙事摘要

### RelationshipState

陆思源面对某个用户时的关系状态。

当前已实现第一版：每个现实身份一份 `RelationshipState`。普通聊天默认先写 `chat_relationship_signal`，不直接改变最终关系；信号积累到阈值或 admin 手动点击复盘后，程序会写入一次 `relationship_review_update`。旧的每轮聊天直接更新模式还保留在配置里，方便测试和回退。

admin 仍然可以手动修正、复盘、重置，或审核身份怀疑后把多个渠道账号绑定成同一个现实身份。

它和 `RuntimeState` 的区别很重要：

- `RuntimeState`：陆思源整体现在怎么样。
- `RelationshipState`：陆思源和这个用户之间现在是什么关系。

所以普通聊天不会乱改全局心情；关系也不是一句话一变，而是先沉淀信号，再按一段连续互动慢慢变化。

可以包含：

- 熟悉度
- 信任度
- 亲近感
- 最近张力
- 互动风格
- 关系摘要
- 对方长期偏好摘要

不要保存敏感隐私原文，只保存低敏、有用、可解释的关系摘要。正式长期记忆仍然走 MemoryProposal；RelationshipState 只是关系温度和互动方式。

### User / PersonIdentity / IdentityLink

`User` 是渠道账号，比如 `telegram:123`、`weixin:abc`、`web:uuid`。

`PersonIdentity` 是现实层面的同一个人。新用户会先自动拥有一个只包含自己的 PersonIdentity。

`IdentityLinkProposal` 是“身份怀疑”。如果用户明确说“我是某某”，或显示名和已有身份很像，系统会把怀疑提交给 admin。

`IdentityLink` 负责把 User 连接到 PersonIdentity。只有 owner/admin 明确确认时，才把多个 User 绑定到同一个 PersonIdentity。

这避免了误合并：昵称相似、说话像、头像像，都不能自动合并。当前系统最多只会怀疑，审核通过才会合并关系状态。

### RuntimeEvent

每次事件的处理记录。

可以包含：

- 事件类型
- 来源渠道
- 用户和会话
- perception：这是什么事件
- statePatch：建议怎么改状态
- stance：陆思源怎么看
- expressionPlan：这次准备怎么说
- afterthought：回复后的总结
- replyMessageId：对应的可见回复

这些先放在 JSON 字段里，不一开始拆成很多表。

当前已实现第一版 `RuntimeEvent`：它记录聊天、复盘、梦境和自启动检查。

目前它先保存事件摘要、来源、重要度、主题、情绪/精力/压力/社交信号、是否允许影响长期状态，以及原始材料摘要。perception、stance、expressionPlan、afterthought 这些更细的内部过程还没有完全展开，后续可以继续放进 JSON 字段。

`RuntimeStateEvent` 仍然保留，但它只表示“长期状态真的被改过”。所以：

- `RuntimeEvent`：发生了什么。
- `RuntimeStateEvent`：状态什么时候、为什么变了。

## 聊天流程

```text
用户消息
↓
读取 RuntimeState
↓
读取 RelationshipState
↓
检索长期记忆
↓
程序选择 chat_profile
↓
编译 prompt
↓
LLM 生成回复
↓
输出边界检查
↓
保存回复
↓
写 RuntimeEvent：记录这次发生了什么
↓
对于 RuntimeState：如果是普通聊天，到这里结束，等待复盘或梦境整理
↓
同时写 RelationshipStateEvent：chat_relationship_signal
↓
如果关系信号达到阈值，或 admin 手动复盘：更新 RelationshipState，并写 relationship_review_update
↓
如果是 owner / reflection / dream / autonomy：必要时提议 statePatch
↓
程序校验后更新 RuntimeState，并写 RuntimeStateEvent
```

## 哪些状态可以自动更新

可以由受控入口自动小幅更新：

- 心情
- 精力
- 当前关注点
- 最近事件
- 当前说话模式
- 关系熟悉度和信任度的小幅变化

谨慎更新：

- 自我叙事
- 长期目标
- 关系摘要
- 和用户有关的稳定判断

不能自动更新：

- 核心身份
- 边界
- 完整 persona
- 正式长期记忆
- 现实身份、住址、证件、真实学校等不可编造信息

普通聊天不能直接更新全局 `RuntimeState`。正式长期记忆仍然走 MemoryProposal 审核流。

## 和 chat_profiles 的关系

`chat_profiles` 不是实时状态。

它们是稳定表达规则：

- 默认聊天
- 创造者 / 协作者模式
- 情绪陪伴
- 严肃讨论
- 熟人朋友
- 公开账号

RuntimeState 告诉系统“陆思源现在怎么样”；chat_profile 告诉系统“这个场景该怎么说话”。

## 和 persona slices 的关系

`persona/slices/` 是稳定人设切片，不是实时状态。

它们负责把完整人设拆成一小段一小段的“可召回材料”。比如用户聊情绪，就带上情感切片；聊规则和自由，就带上价值观切片；聊真实存在，就带上存在感切片。

RuntimeState 负责“现在的陆思源”；persona slices 负责“这类问题下，陆思源稳定是什么样”。

以后如果做向量检索，优先给 slices 建向量，而不是直接把完整人格整篇丢给模型。

## 和 Reflection / Dream 的关系

Reflection 是复盘员。它可以读 RuntimeEvent，判断陆思源最近有没有人格漂移、关系状态是否需要更新。现在 Reflection 完成后会记录运行事件，并在允许自动校准时小幅更新 `RuntimeState`。

Dream 是闲时整理。它可以把最近 RuntimeEvent 汇总成 DailyNote、DreamSignal、DreamDiary。现在 Dream Cycle 完成后会记录运行事件，并在允许自动校准时小幅更新 `RuntimeState`。

Autonomy tick 是自启动检查。它会看最近聊天密度和距离上次聊天的时间：聊太多会降低社交电量，安静太久会提高想说话的倾向。它可以在 admin 手动触发，也可以通过 `RUNTIME_AUTONOMY_AUTO_RUN=true` 开启定时运行。

二者都不能直接改核心 persona。

## 为什么不直接做完整 v1.5

`tasks/task_15_01.md` 里的完整 v1.5 有很多表和阶段。那套方向对，但现在直接做会太重。

Runtime Lite 的选择是：

- 先把状态和关系入库。
- 先把内部过程放到 RuntimeEvent 的 JSON 里。
- 等确实需要查询、统计、可视化时，再把某些 JSON 字段拆成独立表。

这样第一版就是正式骨架，不是临时拼凑；但它不会一上来压垮项目。
