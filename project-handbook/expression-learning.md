# 表达学习

表达学习负责记录：在一个具体情境里，owner 最终希望陆思源怎样回应。

它不是另一份人设，也不是长期记忆。

- Persona：陆思源是谁。
- Memory：陆思源记得什么。
- RelationshipState：陆思源和某个人是什么关系。
- Expression Learning：遇到类似情境时，怎样判断是否回应、回应多长、采用什么语气。

## 当前流程

1. 平台 Skill 根据当前情境生成草稿。
2. owner 直接采用、修改后采用、自己重写，或者决定不回复。
3. 系统保留思源原稿和 owner 最终决定。
4. LLM 分析这次取舍，形成一条可查看、可修正、可停用的表达经验。
5. 系统给经验建立向量索引。
6. 下次生成前，只召回少量同平台、同场景的相似经验。

学习经验不会自动改写 Persona、Memory 或 Skill prompt。owner 最终动作是强证据，LLM 对“为什么”的解释只是可修正的分析。

当前采用“LLM 分析 + 向量召回”，不是每条回复后重新训练基础模型。少量样本阶段这样更稳定，也能看见和纠正思源到底学到了什么；以后积累足够多高质量样本后，再单独评估是否值得微调模型。

## 当前接入

第一处接入是小红书评论回复：

- `owner_written`：owner 没用草稿，直接写了最终回复。
- `edited_draft`：owner 修改思源草稿后发布。
- `accepted_draft`：owner 直接采用思源草稿。
- `skipped`：owner 决定不回复。

Admin 的“表达学习”页面可以查看经验、修改分析、重新分析、停用或重新启用。

## 主动训练入口

Admin 的“表达学习”页面现在不只显示经验库，也提供主动训练入口：

- 手动教学：owner 直接写下情境，可以先让陆思源现场试答，再填写希望采用的回复或不回复理由。
- 练习出题：系统按平台、场景和训练重点生成情境，owner 回答后沉淀为经验。

新入口仍然复用 `ExpressionLearningExample`。`pending` 经验只用于管理和审核，不会被生成链路召回；只有 `active` 经验会通过向量检索注入未来回复。

每次主动训练还会写入 `ExpressionLearningTrainingRecord`。这张表保存完整过程：生成题目、现场试答、owner 最终答案、原因、LLM 分析快照、原始 payload 和训练友好的导出结构。它是备份和未来训练 LLM 的素材，不直接参与回复生成。

Admin 顶部可以导出训练记录：

- JSON：保留完整记录，适合备份和人工检查。
- JSONL：一行一个训练样本，字段里包含 `supervised_sample`，以后更容易转换成 SFT/DPO 等训练格式。

主动训练的入口分工：

- 手动教学：点“分析并保存经验”后，会直接进入经验库。
- 练习出题：生成题目后先进入习题册；只有在习题册里点“保存并生成经验”，才进入经验库。
- 习题册：`待练习` 用来排队；`已归档不入库` 表示答过但暂时不作为经验；`已生成经验` 会关联经验库记录；`已弃题` 用来记录坏题原因。
- 多轮练习：一个案例保存起始情境和一棵对话树；每个 turn 可以从任意上游节点继续或分叉。保存经验时，系统把“起始情境 + 上游路径 + 当前对方消息”编译成一条普通 `ExpressionLearningExample`，继续复用现有向量索引和启停机制。

如果题目违背人设、凭空编关系、风险太高或训练价值低，不要静默删除，应该“弃题并记录原因”。这些坏题反馈不参与生成，但会保留在导出数据里，后续可以用来改出题 prompt 或训练出题判别器。

多轮练习的数据分工：

- `ExpressionLearningDialogueCase`：连续对话案例，记录场景、标题、训练重点和起始情境。
- `ExpressionLearningDialogueTurn`：对话树上的一个学习节点，记录父节点、分支条件、这一轮对方说了什么、陆思源试答、owner 最终决定和分析快照。
- `ExpressionLearningExample`：真正参与未来生成的经验单元。多轮 turn 保存入库后会关联到这里，`sourceRef` 使用 `dialogue_turn:{turnId}`，重复保存同一节点会更新同一条经验。

如果上游 turn 或案例根情境被修改，系统会重建下游节点的路径上下文；再次保存节点经验时会覆盖对应的经验内容。

模型教练暂不做手动输入入口。后续如果要做，应当由模型自动点评或生成候选经验，owner 可以在保存前或经验库中继续编辑。

## 平台隔离

通用底层不代表所有平台混在一起。经验带有 `platform`、`scene` 和 `scope`，三者职责不同：

- `platform` 是渠道或大类，例如 `xiaohongshu`、`chat`、`general`。
- `scene` 是这个平台里的具体任务，例如 `comment_reply`、`web_chat`、`boundary_reply`。
- `scope` 是这条经验的生效半径：`global` 全局可用，`platform` 只在同平台可用，`scene` 只在同平台同场景可用，`private` 只存档不参与生成。

检索时只召回符合生效半径的经验，避免把公开评论区语气带进私人聊天。

未来 B站、Twitter/X 和聊天只需要接入“原始情境、思源草稿、owner 最终决定”，不需要重新实现学习逻辑。

## 小红书账号镜像

系统数据库保存小红书帖子、评论线程和草稿。Admin 可以直接粘贴小红书 URL，通过 `chrome-devtools-mcp` 读取已登录 Chrome 当前页面里的标题、文案和已加载评论。默认自动连接当前 Chrome，需要先在 `chrome://inspect/#remote-debugging` 开启远程调试。

读取时会先查找同一帖子页面，存在就复用，不存在才新开。连续新开页面至少间隔 15 秒；选中页面后随机等待 3–5 秒，让已经触发的页面内容先稳定下来，再读取 DOM。

页面读取后不会关闭，也不会自动刷新或滚动。owner 手动触发导入时，系统会有限展开当前已经加载区域中的“展开 N 条回复”，每次展开之间留出等待；它不会继续滚动寻找更多评论。

评论关系不交给 LLM 判断。程序按小红书 DOM 的顶层评论、子回复、回复对象和“作者”标签，整理成“顶层评论 + replies[]”。真实作者回复直接作为 `isAuthor=true` 的评论节点保存，并从它的 `replyToId` 找到学习目标。

帖子标题、文案和作者也优先从明确 DOM 节点读取；LLM 只补充缺失内容并判断帖子类型，减少模型能力差异对导入结果的影响。

导入后的帖子、文案、作者、帖子类型、评论和图片 Alt 都可以在 Admin 修改。配图本身不保存；Admin 只维护图片 Alt 槽位，新帖子默认给 4 个位置，之后可以手动新增或删除。

## 代码位置

- `src/expression-learning/`：分析、保存、向量索引和检索。
- `src/expression-learning/expression-learning-dialogues.ts`：多轮练习案例、对话树、节点分析和入库。
- `src/expression-learning/expression-learning-training-records.ts`：训练过程记录和 JSON / JSONL 导出。
- `src/platforms/xiaohongshu/`：小红书账号镜像与学习接入。
- `src/mcp/chrome-devtools-mcp.service.ts`：页面复用、读取冷却、随机稳定等待和只读 MCP 工具白名单。
- `src/skills/xiaohongshu-reply/`：生成草稿时读取相似表达经验。
- `web/src/components/admin/ExpressionLearningPage.tsx`：表达学习管理页。
- `web/src/components/admin/PlatformsPage.tsx`：小红书账号镜像和最终决定入口。
