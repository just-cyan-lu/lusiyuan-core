# 表达学习训练工作台任务

## 背景

当前表达学习主要来自平台回复：系统生成草稿，owner 采用、修改、重写或选择不回复，最后沉淀为可检索的表达经验。

这次要把表达学习扩展为主动训练能力：owner 可以直接教陆思源怎么答，也可以让系统出题让 owner 回答。

## 边界

- 继续复用 `ExpressionLearningExample` 作为表达经验底座。
- 新入口都沉淀为同一种经验：情境、可选草稿、最终回复或不回复、owner note、分析出的 lesson/strategy/tone。
- 每次训练交互都要保留完整训练记录：生成题目、生成试答、owner 最终答案、原因、分析结果和关联经验。
- 表达学习仍然不改 Persona、Memory 或 RelationshipState。
- 模型教练暂不做手动输入入口；后续如果要做，应当由模型自动生成建议并进入 `pending`，owner 审核后才参与生成。
- 训练记录先用轻量 `ExpressionLearningTrainingRecord` 保存单次交互；如果后续练习流程需要成组追踪，再单独加 session。

## 第一版任务

- [x] 后端支持手动创建表达经验。
- [x] 后端支持 `pending` 状态。
- [x] 后端支持生成练习题。
- [x] 后端支持现场生成陆思源回复草稿。
- [x] Admin 表达学习页增加“经验库 / 手动教学 / 练习出题”入口。
- [x] 手动教学可以选择平台、场景、范围、最终回复或不回复。
- [x] 手动教学可以让陆思源现场试答，把输出填入原草稿。
- [x] 练习出题可以生成情境，owner 回答后入库。
- [x] 生成题目、现场试答和保存答案都会写完整训练记录。
- [x] Admin 支持导出训练记录 JSON / JSONL。
- [x] Admin 增加“习题册”：待练习、已归档不入库、已生成经验、已弃题。
- [x] 习题册里的坏题可以弃题并记录原因，不进入经验库。
- [x] `pending` 经验可以在详情页启用、停用、重新分析。
- [x] 补充测试并跑构建。

## 本轮落地

- 新增 `POST /v1/admin/expression-learning/examples`：admin 可以直接创建表达经验。
- 新增 `POST /v1/admin/expression-learning/practice-question`：按平台、场景和训练重点生成练习题。
- 新增 `POST /v1/admin/expression-learning/draft`：按平台、场景和情境生成一版陆思源试答草稿。
- 新增 `ExpressionLearningTrainingRecord`：保存完整训练过程，包含题目、试答、owner 答案、原因、分析快照、原始 payload 和训练友好的 export payload。
- 新增 `GET /v1/admin/expression-learning/training-records/export?format=json|jsonl`：导出完整训练数据，JSON 适合备份，JSONL 适合后续训练集转换。
- `ExpressionLearningExample.status` 支持 `pending`，检索仍然只使用 `active` 经验。
- 表达学习 Admin 页面新增三段入口：经验库、手动教学、练习出题。
- 手动教学支持 owner 直接教学，并可以先让陆思源现场试答。
- 练习出题生成情境后先写训练记录，并进入“习题册”的待练习队列；owner 的回答会补全同一条记录，并复用现有分析、入库和 embedding 流程。
- 习题册分类：
  - `question_generated`：待练习，题目已生成但还没处理。
  - `answered_archived`：已归档不入库，owner 答过但暂不生成经验。
  - `completed`：已生成经验，关联到 `ExpressionLearningExample`。
  - `dismissed`：已弃题，题目不适合，记录原因但不进入经验库。
- `scope=scene` 只在同平台同场景召回，`scope=platform` 只在同平台召回，`scope=global` 全局召回。

手动教学点“分析并保存经验”后会直接出现在经验库。习题册里点“保存并生成经验”后也会出现在经验库；点“答完但不入库”或“弃题并记录原因”不会进入经验库。

## 验证

- `pnpm build`
- `pnpm web:build`
- `pnpm test`

## 后续可选

- 模型教练对某条 owner 回答做点评，并自动生成 pending 经验。
- 定时出题任务，例如半夜自动生成几道 `question_generated` 题目，等待 owner 白天处理。
- 练习 session 表，用来把多条训练记录组织成一组题、回答进度和复盘结果。
- Web Chat 生成回复时接入 `platform=chat` 的表达经验检索。
- 针对不同场景做练习题模板库，例如拒绝、安抚、公开评论、边界感、技术解释。
