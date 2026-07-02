# Memory Redesign 2026-07-01

这份文档记录记忆模块当前实现和下一步设计。项目仍在开发期，可以直接清理旧结构，不需要为了旧测试数据保留兼容路径。

## 当前目标

记忆模块负责让陆思源长期理解世界、理解不同用户，并在聊天时自然延续重要事实和偏好。

核心目标：

- 个人记忆由 Dream 自动写入，Owner 不需要逐条审核。
- 全局、项目、话题记忆也不需要审核；Dream、Admin 或后续整理器都可以直接写入，发现污染后在 Admin 归档或修改。
- 关系档案负责“这个人是谁、我和这个人是什么关系、怎么和这个人说话”。
- 记忆负责“值得长期保留的事实、偏好、经历、项目决策、反复出现的话题”。
- 聊天上下文负责“我们当时具体怎么说的”，尤其是相关历史原文窗口。

## 边界

### 关系档案

关系档案绑定到 `PersonIdentity`，用于每个具体身份：

- 用户介绍：这个人在思源眼里是怎样的人，有哪些基本资料。
- 关系摘要：两个人大概是什么关系，聊过什么。
- 互动风格：思源应该怎么和这个人聊天。
- 好感度：思源对这个人的亲近程度。
- 备注：只给 Admin 看，不默认发给模型。

这些内容本身会进入聊天 prompt，因此不需要再用 `pinned/core` 类记忆重复携带身份信息。

### 个人记忆

个人记忆绑定到 `PersonIdentity`，保存某个人相关的长期事实和稳定偏好。

适合写入：

- 对方反复提到的兴趣、习惯、偏好。
- 对方的重要经历、长期目标、项目背景。
- 对方明确希望思源记住的内容。
- 一段时间内多次出现、可能持续影响聊天的话题。

不适合写入：

- 一次性的寒暄。
- 当前会话里的临时情绪，除非反复出现或对关系有持续影响。
- 已经应该放进关系档案的内容，比如“怎么和这个人说话”。

### 全局、项目、话题记忆

这些记忆不绑定具体身份。

- `global`：对陆思源整体都成立的信息，比如稳定设定、通用边界、全局事实。
- `project`：项目事实、技术决策、产品方向。
- `topic`：某个话题的阶段性整理，比如最近很多人聊到的热点、一个持续讨论的公共主题。

当前规则：不走审核流，直接写入。Admin 可以手动新增、修改、归档，也可以把某条关系/个人记忆改成全局、项目或话题记忆。

### 相关历史原文窗口

相关历史原文窗口不属于长期记忆。它解决的是“当时到底怎么聊的”。

逻辑是：

- 用户提到过去某个话题时，用消息 embedding 找到相关旧消息。
- 不只拿一条摘要，而是拉取当时前后几轮原文。
- 让模型能看懂具体上下文，而不是只知道模糊结论。

长期记忆可以帮助定位话题，但不能替代原文窗口。

## 已落地的数据结构

Memory 已经从 `userId` 迁移到 `personId`。个人记忆归属 `PersonIdentity`，渠道用户只是这个身份下面的身份链接。

当前核心字段：

- `personId`：个人记忆归属身份。全局、项目、话题记忆为 `null`。
- `scope`：`person` / `global` / `project` / `topic`。
- `tier`：`temp` / `short` / `mid` / `long`。
- `tierMentionCount`：当前层级内有效提及次数。
- `tierEnteredAt`：进入当前层级的时间。
- `content`：完整记忆内容。
- `summary`：可选短摘要。
- `status`：`active` / `archived` / `superseded` 等。
- `sourceMessageIds`：证据消息。
- `mentionDayKeys`：已经计数过的有效提及日期，避免同一天重复计数。
- `lastMentionedAt`：最后被有效提及时间。
- `lastAccessedAt` / `accessCount`：检索使用统计。

记忆库只保存会参与检索、展示和导出的核心信息，不再为审核、风险打分或重要度排序保留额外字段。

## 已落地的检索逻辑

聊天时的记忆检索现在按身份执行：

- 当前用户先解析到 `PersonIdentity`。
- 向量检索优先找这个身份的个人记忆，同时允许相关的全局、项目、话题记忆参与。
- 不再按重要度或最近时间无脑补记忆。
- 不再做本地关键词 rerank，也不按同会话补充旧记忆。
- prompt 里的记忆区域只叫“相关记忆”，不会把记忆当成关系档案。
- 检索排序会优先长期/中期记忆，短期次之，临时记忆权重最低；但所有层级都必须和当前话题相关才会进入 prompt。
- 每条记忆进 prompt 时会带更新时间；如果内容冲突，以更新时间更新、证据更明确的记忆为准。
- 设置页只保留 `MEMORY_RETRIEVAL_ENABLED` 和 `MEMORY_FINAL_TOP_K`。候选召回数量、语义阈值和最终上下文裁剪由系统内部固定策略处理。

## 已落地的 Dream 写入

Dream 的关系复盘已经可以在同一次身份整理里输出 `memoryChanges`。

当前策略：

- 个人记忆默认自动写入。
- 写入时保留来源消息、tier、tierMentionCount、mentionDayKeys 和 lastMentionedAt。
- create / update / supersede / archive 直接修改 Memory。
- 如果某个身份关闭“允许 Dream 自动维护”，关系档案不会自动改；个人记忆仍按当前自动写入策略执行。
- 全局、项目、话题记忆由 Deep Sleep 或 Admin 直接写入；后续如果发现污染，直接在记忆库归档或修改。
- Dream 每次处理某个身份前，会复查这个身份到期的个人记忆。到期后直接降级或归档，不再额外写审核记录。

## 记忆层级

记忆分四层，模拟“先暂存、再确认、再加深、再沉淀”的过程。

过期窗口不按自然日计算，而按“活跃聊天日”计算。如果某个人和思源十天没聊天，这十天不会推进遗忘计数。只有这个身份当天真的有 user 消息，才算一个活跃聊天日。

同一天同一条记忆最多只算 1 次有效提及。是否真的再次触发，必须由 Dream/整理器根据上下文判断，不能只靠关键词碰巧出现。

| tier | 窗口 | 升级 | 过期 |
| --- | --- | --- | --- |
| `temp` | 5 个活跃聊天日 | 后续被有效提及 1 次，升为 `short` | 没有再次有效提及则归档 |
| `short` | 10 个活跃聊天日 | 当前层级累计 5 次有效提及，升为 `mid` | 降回 `temp` |
| `mid` | 60 个活跃聊天日 | 当前层级累计 5 次有效提及，升为 `long` | 降回 `short` |
| `long` | 365 个活跃聊天日 | 不再自动升级 | 降回 `mid` |

新个人记忆默认从 `temp` 开始。首次写入不算“再次触发”，`tierMentionCount` 从 0 开始。

## 已落地的 Admin 入口

记忆页面已经改成身份视角：

- User ID 筛选改成身份筛选。
- 关系详情页增加“查看记忆”入口，跳到该身份的记忆筛选结果。
- 记忆列表展示身份、scope、tier、本层提及次数、最近提及时间。
- 支持归档记忆。
- 支持手动改身份、scope、tier、内容、摘要和来源消息。

## 已完成：冲突、去重、有效提及识别、写入流程

当前系统已经能在 Dream 关系复盘里处理记忆冲突和重复问题：不要重复写、不要把新旧矛盾都留着、不要靠关键词自动误判“再次提起”，并且同一次 Dream 里同一条旧记忆只会落一个最终动作。

### 目标

- 在 Dream 整理时，先判断新信息和旧记忆的关系，再决定 create / update / supersede / archive / reinforce。
- 对同一件事重复出现时，不新增重复记忆，而是强化已有记忆。
- 对冲突信息，优先保留更新、证据更直接的版本，并归档或替换旧版本。
- 对只是擦边相似、开玩笑、偶然提到的内容，不计入有效提及。

### 新增动作：reinforce_memory

`memoryChanges` 已支持一个动作：

```json
{
  "proposalType": "reinforce_memory",
  "targetMemoryId": "...",
  "sourceMessageIds": ["..."]
}
```

含义：

- 内容不变。
- 这次 Dream 判断旧记忆被真实再次触发。
- 系统只更新 `mentionDayKeys`、`tierMentionCount`、`lastMentionedAt`，必要时触发 tier 升级。
- 不重建一条重复记忆。

这样“有效提及识别”不需要依赖 update。很多时候用户只是再次聊到同一个事实，并不需要改写记忆内容。

`memoryChanges` 也支持可选字段 `relationToTarget`：

- `same_fact`：同一事实，只是再次提到。
- `more_specific`：新信息是旧记忆的更具体版本。
- `newer_version`：新信息取代旧信息。
- `conflict`：新旧信息互相矛盾。
- `related_but_distinct`：相关但不是同一条记忆。
- `unrelated`：无关。

这个字段由 LLM 输出，系统会结合短实体、反向事实和旧内容再兜底校验，不盲信模型。

### 候选匹配

每次 Dream 处理某个身份时，先准备候选旧记忆：

- 当前身份下 active 的个人记忆。
- 和本轮消息语义相近的个人、全局、项目、话题记忆。
- 和本轮用户消息共享短实体/短语的个人记忆。

候选召回不能只靠整段向量相似。短实体、食物名、作品名、人名、项目名很容易只占一句话里的几个字，但它们往往正是冲突点。比如旧记忆是“用户喜欢吃螺蛳粉”，新消息是“我不是喜欢螺蛳粉，我是不喜欢”，如果只看整段语义，可能召不回旧记忆。

因此候选应分两路合并：

- 语义候选：用本轮消息 embedding 找整体相关的旧记忆。
- 实体/短语候选：从本轮消息里抽取关键名词、偏好对象、项目名、作品名等，再匹配旧记忆里的同名或近似表达。
- 最近/层级候选：补一些当前身份下近期更新或层级更高的个人记忆，避免语义索引缺失时完全看不到旧资料。

候选数量内部固定，不放到设置页：

- 语义候选：用 pgvector 从个人、全局、项目、话题记忆中召回。
- 实体/短语候选：每个身份额外保留最多 20 条，用来兜住短词反向事实。
- 最近/层级候选：最多补 40 条。
- 长期记忆可以略微提高候选优先级，但仍必须语义相关。
- `scope=global/project/topic` 的候选只作为背景参考；关系复盘里的 `memoryChanges` 只允许修改 `scope=person` 的记忆。

### 关系判断

对“新信息”和“候选旧记忆”逐对判断关系：

| 关系 | 含义 | 建议动作 |
| --- | --- | --- |
| `same_fact` | 同一件事，只是换了说法 | `reinforce_memory` 或 `update_memory` |
| `more_specific` | 新信息是旧记忆的更具体版本 | `update_memory` |
| `newer_version` | 新信息取代旧信息 | `supersede_memory` 或 `update_memory` |
| `conflict` | 新旧信息互相矛盾 | 证据强则 `supersede_memory`，证据弱则暂不改并记录 risk/open question |
| `related_but_distinct` | 相关但不是同一条记忆 | 可以 `create_memory` |
| `unrelated` | 无关 | 忽略 |

Dream prompt 会要求 LLM 输出这个判断；系统负责校验目标 id、来源消息、scope，并在必要时自动改写动作。

系统兜底规则：

- `create_memory` 命中同一事实旧记忆时，转成 `reinforce_memory`。
- `create_memory` 命中反向事实、纠错或更新版本时，转成 `update_memory`。
- `update_memory` 内容没有实际变化，或 relation 是 `same_fact` 时，转成 `reinforce_memory`。
- relation 是 `related_but_distinct` 或 `unrelated` 时，不允许拿旧记忆做 update/reinforce。
- 同一目标记忆同时出现多个动作时，只保留优先级最高的最终动作，并合并来源消息。

### 去重规则

新增记忆前必须先查重：

- 同一 `personId + scope=person + type` 下，短实体/短语命中旧记忆时，系统会把重复 `create_memory` 转成 `update_memory`。
- LLM 判断为同一事实时，应输出 `reinforce_memory` 或 `update_memory`，不要重复 create。
- 如果已经产生了重复记忆，后续 Dream 可以把较旧或较弱的一条标记为 `archived`，把来源消息合并到保留记忆。

去重时不要只看文本相似。比如“喜欢猫”和“家里养猫”相似但不是同一事实，应该保留为两条。

### 冲突规则

冲突常见场景：

- 偏好改变：以前喜欢 A，现在明确说更喜欢 B。
- 旧记忆记错：以前误以为用户喜欢 A，现在用户明确纠正“我不喜欢 A”。
- 状态变化：以前在做某项目，现在项目结束或方向变了。
- 旧记忆过度推断：之前把一时情绪写成长期事实，后来聊天证明不稳定。
- 全局/项目事实被新决策覆盖。

处理原则：

- 明确的新证据优先于旧记忆。
- 用户直接表达优先于模型推断。
- 最近证据优先于很久以前的证据。
- 低层级记忆更容易被替换；长期记忆需要更强证据才 supersede。
- 证据不足时不强行改，生成 risk/open question，或者只保留新来源消息等待后续 Dream 再判断。

“旧记忆记错”和“用户喜好变化”第一版不强行区分。它们都会先按新证据修正旧记忆：直接 update 或 supersede，避免 prompt 里同时留下相反结论。后续如果需要更细，可以在记忆详情或变更解释里增加 `correction` / `preference_changed` 之类的原因标签，但不需要为第一版增加新字段。

不新增审核流。冲突处理错了，Admin 在记忆库里归档或手动改。

### 有效提及识别

有效提及不是“出现了几个关键词”，而是这段聊天确实再次触发了旧记忆。

算有效提及：

- 用户明确再次说到同一个事实、偏好、项目或经历。
- 本轮聊天围绕这条记忆继续展开。
- 用户纠正、更新或确认了这条记忆。
- 这条记忆被用于解释当前上下文，且有明确来源消息。

不算有效提及：

- 只是出现相同词语，但语义无关。
- 玩笑、反讽、假设句。
- 思源自己提到旧记忆，但用户没有确认或继续展开。
- 一天内同一条记忆重复出现多次。系统最多计 1 次。

实现上，Dream 输出 `reinforce_memory` 时必须给 `sourceMessageIds`。系统只接受 user 消息作为有效提及证据，避免模型拿自己的回复给记忆续命。

### 写入流程

Dream 的记忆写入当前流程：

1. 按身份聚合本轮 Dream 时间窗口内的消息。
2. 取当前身份的关系档案和 active 记忆。
3. 用本轮消息向量召回相关旧记忆候选，同时用短实体/短语兜住反向事实。
4. 让 LLM 输出关系档案 patch、memoryChanges、有效提及和冲突判断。
5. 系统校验：
   - `targetMemoryId` 必须存在且 scope/person 匹配。
   - `sourceMessageIds` 必须来自本轮 user 消息。
   - create 前必须没有 `same_fact` 候选。
   - reinforce 只改计数和最后提及时间。
   - 同一目标多动作会归并成一个最终动作。
6. 写入 Memory：
   - create：新建个人记忆。
   - reinforce：只更新来源消息、有效提及日期、层级计数和最后提及时间。
   - update：改写旧记忆内容，同时算一次有效提及。
   - supersede：把旧记忆标记为 superseded，并新建替代记忆。
   - archive：归档旧记忆。
7. 对 active 记忆重建 embedding。归档或 superseded 的旧 embedding 不删除，但检索时会被 `status=active` 排除。

### Admin 展示

第一版不做复杂审核。后续 Admin 可以继续补这些可视化能力：

- 记忆详情里展示来源消息和最近有效提及日期。
- 列表增加“疑似冲突/重复”的筛选可以后做。
- 如果 Dream 生成 risk/open question，先继续显示在 Dream 或运维页，不新增独立记忆审核页。

### 不做的复杂化

暂时不做：

- 不恢复 `MemoryProposal`。
- 不恢复 risk/importance/confidence 字段。
- 不做全局记忆审核队列。
- 不引入独立记忆变更日志表。
- 不做关键词规则来自动增加有效提及次数。

当前优先级是让 Dream 在上下文里判断得更准，让 Memory 表保持干净。

## 设计：全局、项目、话题记忆自动整理

全局、项目、话题记忆不属于某个具体用户身份，`personId` 固定为 `null`。它们的整理不放进关系复盘里，避免“某个人的一段聊天”直接污染所有人的上下文。

第一版不新增表结构，继续复用 `Memory`：

- `scope=global`：对陆思源整体成立、跨场景都可能有用的稳定信息。
- `scope=project`：某个项目、产品、代码、创作计划、长期任务的事实和决策。
- `scope=topic`：多人或多次聊天里反复出现的公共话题、热点、兴趣趋势、阶段性讨论整理。

### 边界

不写入全局、项目、话题记忆的内容：

- 某个具体人的资料、偏好、经历。这些必须写入 `scope=person`。
- 关系摘要、互动风格、好感度理由。这些属于关系档案。
- 一次性闲聊、普通寒暄、没有持续价值的短期情绪。
- 未经确认的公共事实。不要因为某个用户随口说了一个新闻、传闻、观点，就把它当成全局事实。
- 人设和核心设定。人设仍以 persona / project-handbook 为准，不通过记忆覆盖。

三类非个人记忆的区别：

| scope | 用途 | 例子 |
| --- | --- | --- |
| `global` | 对所有聊天都可能有帮助的稳定背景 | Owner 明确说“以后所有地方都按这个规则理解”；陆思源长期运营方向；跨用户反复确认的稳定共识 |
| `project` | 某个项目自己的上下文和决策 | `lusiyuan-core` 记忆模块采用 Dream 自动写入；某个小红书运营计划的阶段目标 |
| `topic` | 最近或长期反复出现的话题趋势 | 最近很多人都在聊某游戏；多位用户都提到养猫；某个热点被连续讨论 |

`topic` 不是 `global`。它表达“这件事最近常被聊到 / 有一些群体趋势”，不表达“这件事永远为真”。

### 触发位置

新增一个 Dream 后置整理器，建议命名为 `DreamScopedMemoryOrganizer`。

运行顺序：

1. Dream 收集上次到本次之间的完整消息窗口。
2. 先按身份跑关系复盘和个人记忆整理。
3. 再跑 `DreamScopedMemoryOrganizer`，只处理 `global/project/topic`。
4. 写入或更新 `personId=null` 的 Memory。
5. 对 active 记忆重建 embedding。

这样做的好处：

- 个人关系和个人记忆先稳定下来。
- 非个人整理器能看到整段时间所有人的消息，而不是被单个身份局限。
- 同一个 Dream job 里，不会出现个人整理器和全局整理器互相抢同一条记忆。

### 输入材料

非个人整理器使用这些材料：

- 本次 Dream 时间窗口内的全部消息。
- 本次 Dream 生成的个人记忆变化摘要，只作为信号，不直接把个人信息搬进全局记忆。
- 当前 active 的 `global/project/topic` 记忆候选。
- 相关旧原文窗口或消息 embedding 召回结果，用来确认“以前是否也聊过这件事”。

候选旧记忆仍然两路召回：

- 语义召回：用本次 Dream 窗口的主题摘要去找相似的 `global/project/topic` 记忆。
- 短语召回：提取项目名、作品名、热点名、技术名、平台名、游戏名、宠物/兴趣对象等短词，匹配旧记忆。

个人记忆可以作为“趋势信号”，但不能作为非个人记忆的 target。比如多个人都聊猫，可以形成 `topic` 记忆；但不能把某个人养猫的具体信息写进 topic。

### 输出动作

非个人整理器输出类似 `memoryChanges` 的动作，但必须带 `scope`：

```json
{
  "scope": "topic",
  "proposalType": "update_memory",
  "relationToTarget": "newer_version",
  "targetMemoryId": "memory_xxx",
  "type": "recurring_topic",
  "content": "最近多位用户都聊到养猫，重点集中在猫的性格、陪伴感和日常照顾。",
  "summary": "近期多人聊养猫",
  "sourceMessageIds": ["msg_a", "msg_b"]
}
```

动作沿用个人记忆这套：

- `create_memory`
- `reinforce_memory`
- `update_memory`
- `supersede_memory`
- `archive_memory`

也沿用 `relationToTarget`：

- `same_fact`
- `more_specific`
- `newer_version`
- `conflict`
- `related_but_distinct`
- `unrelated`

系统仍然要兜底校验：

- `targetMemoryId` 必须是 `personId=null` 且 scope 匹配的 active 记忆。
- `sourceMessageIds` 必须来自本次 Dream 窗口。
- `global/project/topic` 之间不能自动互相改 scope，除非 Admin 手动改。
- 同一目标多动作归并，只写入最终动作。
- create 前先查重，命中同一事实则 reinforce 或 update。

### 写入策略

`global` 最保守：

- 默认不自动 create，除非 Owner 明确说“以后都按这个记住 / 全局记住”，或多个独立时间窗口反复确认。
- 不记录普通公共事实和新闻事实。
- 不记录某个用户的个人观点，除非它已经被整理成匿名、稳定、跨场景有用的规则。

`project` 相对积极：

- Owner、Codex、工具输出、项目讨论里形成的明确技术决策、产品方向、任务背景，可以写入 project。
- 如果来源是工具或代码分析，后续实现时可以允许 assistant/tool 相关消息作为 source；第一版可以先只用 Dream 窗口内可追溯消息。
- 项目记忆需要在内容里写清项目名，比如“项目 `lusiyuan-core`：……”。

`topic` 最适合自动整理：

- 多个身份、多个会话或多个 Dream 窗口里重复出现的话题，可以 create 或 reinforce。
- 只记录匿名聚合趋势，不泄露具体用户身份。
- 可以写“最近多人都在聊……”或“这段时间反复出现……”。
- 过期后应自动降级或归档，避免旧热点长期污染聊天。

### 层级和过期

非个人记忆也继续使用 `temp/short/mid/long`，但含义和个人记忆略不同：

- `topic` 默认从 `temp` 开始。后续 Dream 窗口再次有效出现，才升到 `short/mid`。
- `project` 可以根据明确程度从 `short` 开始；Owner 明确决策或代码事实可以进入 `mid`。
- `global` 默认不自动升长期。只有 Owner 明确指定或长期反复验证，才进入 `long`。

过期逻辑不按某个身份的“活跃聊天日”，而按 Dream 窗口或自然时间：

- `topic`：一段时间没有再出现就降级或归档。
- `project`：项目长期没被提到不一定忘，但如果被新决策覆盖，应 update/supersede。
- `global`：不自动过期，只能被明确新证据 update/supersede，或 Admin 手动归档。

第一版实现可以先只做写入和强化，过期整理后补。

### 检索使用

聊天时不无脑携带非个人记忆，仍然走相关性检索：

- 当前话题命中 project/topic/global 记忆，才进入 prompt。
- `topic` 记忆适合让思源自然意识到“最近不少人也聊这个”。
- `project` 记忆适合让思源延续项目上下文。
- `global` 记忆适合作为稳定背景，但数量要少，避免压过 persona。

如果非个人记忆和个人记忆冲突：

- 个人偏好优先于 topic 趋势。
- project 决策优先于普通 topic 讨论。
- persona / project-handbook 优先于 Memory。

### 第一版实现顺序

1. 新增 `DreamScopedMemoryOrganizer`，在关系复盘后运行。
2. 新增 scoped memory prompt 和类型，不复用关系复盘 prompt。
3. 召回 active 的 `global/project/topic` 候选。
4. 输出并归一化 scoped memory changes。
5. 写入 `Memory`，`personId=null`。
6. 重建 active memory embedding。
7. 增加测试：scope 校验、重复 create 转 reinforce、topic 多窗口强化、project 更新、global 保守创建。

第一版暂时不新增项目表、话题表或跨身份 topic index。等 `topic` 记忆真的变多，再考虑把 project/topic 抽成独立实体，支持合并、别名、热度和趋势页。

## 后续入口

- 全局、项目、话题记忆自动整理暂缓。上面的设计先作为以后实现依据。
- 跨人联想和话题趋势暂缓。第一版可以先用 `scope=topic` 记忆表达；如果以后需要更强能力，再考虑跨身份 topic index。
- 历史脏数据批量清理不做。开发期数据可以手动清库或手动归档。
- 独立记忆变更日志不做。当前保留 `sourceMessageIds`、有效提及日期和 Dream 原始输出即可，避免再增加一套很少查看的日志。
- Admin 已支持在记忆详情中查看证据链。单条记忆独立页面暂时不做，当前列表选中详情已经够用。
