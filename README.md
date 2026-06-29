# lusiyuan-core

陆思源数字人的后端核心服务。

它负责接收聊天消息、读取人设和记忆、准备聊天上下文、调用大模型、执行工具、保存对话，并在空闲时推进 Dream 和自主任务。

旧版 README 已备份为 `README.legacy-2026-06-30.md`。当前 README 先只记录已经重新梳理过的主线：聊天上下文，以及运行态与自主活动。其他功能等逐个优化后再补。

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
- `docs/settings-config-audit-2026-06-25.md`：设置页面审计、已删除配置和后续可选项。
- `docs/runtime-autonomous-activity-2026-06-29.md`：运行态与自主活动重构记录。

`docs/` 里多数是临时任务文档和专题设计；`project-handbook/` 更适合作为当前项目地图。以后每优化完一个功能，再把它整理进 README 或项目手册。

---

## 当前阅读顺序

建议先按这个顺序理解项目：

1. **聊天上下文**：陆思源每次回复前，模型到底看到了哪些对话材料。
2. **运行态与自主活动**：陆思源当前有没有劲，以及空闲时他会不会真的推进自己的任务。

这两个模块一个负责“接住对话”，一个负责“有自己的连续生活感”。它们是目前 README 里优先整理的两条主线。

---

## 1. 聊天上下文

上一次 README 主要整理的是聊天上下文。

陆思源聊天时不是简单读取“最近 10 条消息”，而是给模型准备一个分层资料包：最近原文、较早摘要、相关旧原文窗口。这样他既能接住刚刚发生的事，也能在需要时想起更早聊过的内容。

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

离当前较远的对话不会一直完整塞进 prompt。系统会在后台把热区之外的旧聊天压缩成摘要，存到 `conversation_context_summaries`。

摘要会保留来源范围，比如从哪条消息到哪条消息、时间范围、消息数量。以后要审计、导出或重新生成，都还有依据。

相关配置：

- `CHAT_CONTEXT_COMPACT_ENABLED`：是否自动压缩旧聊天。
- `CHAT_CONTEXT_SUMMARY_MAX_CHARS`：摘要最多放入多少字符；`0` 表示不放摘要。

这层负责保留更早的事实、约定、偏好和未完成事项，同时减少噪声。

### 第三层：相关旧原文窗口

如果开启 `CHAT_CONTEXT_RECALL_ENABLED`，系统会把当前问题做向量检索，从历史消息里找到语义相关的旧消息。

命中后，它不是只给模型一句模糊摘要，而是把命中消息前后的原文窗口放进 prompt。这样当用户问“我们以前是不是说过这个”时，陆思源能看到当时附近的真实对话。

相关配置：

- `CHAT_CONTEXT_RECALL_ENABLED`：是否开启旧原文向量召回。
- `CHAT_CONTEXT_RECALL_MAX_CHARS`：召回窗口最多放入多少字符。

旧消息需要先有 embedding。可以用：

```bash
npm run context:index
```

给历史聊天补索引。新消息会在聊天后自动维护索引。

### 相关代码

- `src/core/conversation-context.service.ts`：三层上下文总调度。
- `src/core/chat-context.ts`：最近原文热区整理和裁剪。
- `src/core/conversation-context-summary.service.ts`：较早对话压缩摘要。
- `src/core/conversation-recall.service.ts`：旧原文窗口召回。
- `src/core/message-embedding.service.ts`：聊天消息 embedding 维护。
- `src/core/prompt-builder.ts`：把上下文、人设、记忆、运行态组装成 prompt。

---

## 2. 运行态与自主活动

这次整理的是运行态。

新的边界是：运行态不再假装记录“陆思源正在做什么”。它只保存当前心力和最近状态；真正“正在做的事”进入独立的自主任务系统，会被创建、推进、产生产物并落库。

### 运行态只管心力和最近状态

`runtime_states` 当前只保留：

- `energyLevel`：心力，0-100，表示陆思源当前有没有劲。
- `moodLabel`：状态标签，由 `energyLevel` 自动映射。
- `recentEventSummary`：最近一次状态相关事件。
- `statusNote`：状态备注。
- `metadata`：最近 Dream、自主检查等结构化附加信息。

已经删除的旧字段：

- `currentGoal`
- `currentFocus`
- `currentActivity`
- `updateMode`
- `updateStrategy`

这些字段不再保留兼容逻辑。项目还在开发期，旧库可以直接清理重建。

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

Owner 聊天不再直接改运行态。它只记录 `RuntimeEvent`，作为 Dream 或后续整理材料。

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

原来的自启动检查已经转向“空闲时能不能做自己的事”。

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
- 查看运行事件和状态变更审计。

### 相关代码

- `src/runtime/runtime-state.service.ts`：运行态、运行事件、自主检查。
- `src/runtime/autonomous-task.service.ts`：自主任务、推进记录、产物生成。
- `src/runtime/runtime-autonomy-scheduler.ts`：自主检查定时器。
- `src/routes/admin.route.ts`：运行态和自主任务 Admin API。
- `web/src/components/admin/RuntimeStatePage.tsx`：Admin 运行态页面。
- `web/src/api/lusiyuan-api.ts`：前端 API 类型和请求。

---

## 之后怎么补 README

暂时不把所有功能都写回来。

后面每优化完一个模块，再把它补进这里。优先顺序大概是：

1. 关系好感度。
2. Dream。
3. 表达学习。
4. 记忆检索。
5. 工具和网页能力。
6. 平台能力，比如小红书、Telegram、微信桥接。
