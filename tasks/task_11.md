下面是完整的 **task_11 / v1.1：Content Ops Pipeline 技术设计文档**。
这一版重点是：**在已有 Admin Console 上做一套可视化内容运营生产线**，把选题、草稿、素材、审核、发布记录、基础数据复盘串起来。

---

# task_11：Content Ops Pipeline

# 陆思源 Core API v1.1：内容运营生产线

## 1. v1.1 目标

v1.1 的目标不是继续扩展陆思源的“底层大脑”，而是把前面已经完成的能力串成一个实际可用的内容生产流程。

前面已有：

```text
v0.5：DraftService，能生成草稿
v0.75：Dream Cycle，能生成梦境日记和内容灵感
v0.8：OpenClaw Action Gateway，能收集外部评论/反馈
v0.9：Media & Asset Memory，能管理图片、音频、视频素材
v1.0：Admin Console，能做权限、审核、日志、后台管理
```

v1.1 要做的是：

```text
选题
↓
内容计划
↓
生成草稿
↓
选择素材
↓
人设/边界审核
↓
人工确认
↓
手动发布记录
↓
基础数据录入
↓
复盘总结
```

一句话：

```text
v1.1 让陆思源项目从“能聊天、能记忆、能管理资产”，升级成“能持续生产内容的数字人运营系统”。
```

---

# 2. v1.1 核心原则

v1.1 要遵守这些原则：

```text
1. 内容生产可视化，主要在 Admin Console 中操作。
2. 不做自动发布，只做草稿、审核、发布记录。
3. 不做复杂团队协作，默认 owner/admin 使用。
4. 内容必须关联来源，避免凭空生成。
5. 内容发布前必须经过人设和边界检查。
6. 素材使用必须可追踪，避免重复、误用或来源不明。
7. 数据复盘先手动录入，后续再考虑自动采集。
8. 所有关键操作要写 AuditLog。
```

最重要的是：

```text
v1.1 是内容工作流，不是自动运营机器人。
```

---

# 3. v1.1 不做什么

为了避免过度设计，v1.1 明确不做：

```text
1. 不自动发布小红书 / B站 / 微博 / 网站内容
2. 不自动回复评论
3. 不自动私信运营
4. 不自动删除评论
5. 不做复杂投放系统
6. 不做多人协作审批流
7. 不做复杂数据爬虫
8. 不做完整 SEO 系统
9. 不做商业化付费系统
10. 不做 AI 自动决定发什么、什么时候发
```

v1.1 只做：

```text
选题库
内容日历
内容草稿
素材关联
内容审核
发布记录
基础数据录入
内容复盘
平台模板
```

---

# 4. 总体架构

v1.1 新增模块：

```text
Lusiyuan Core API
└── Content Ops Pipeline
    ├── ContentIdeaService
    ├── ContentPlanService
    ├── ContentDraftService
    ├── ContentTemplateService
    ├── ContentReviewService
    ├── ContentAssetService
    ├── PublishingRecordService
    ├── ContentMetricService
    └── ContentInsightService
```

它连接已有系统：

```text
DreamDiaryEntry
ExternalInboxItem
Memory
Asset
Draft
Reflection
Creator Assistant
Approval
AuditLog
```

整体流程：

```text
Dream / External Feedback / Manual Input / Memory
↓
ContentIdea
↓
ContentPlan
↓
ContentDraft
↓
Asset Links
↓
ContentReviewReport
↓
Approval
↓
PublishingRecord
↓
ContentMetric
↓
ContentInsight
```

---

# 5. Admin 页面设计

v1.1 直接做在已有 v1.0 Admin Console 里。

新增一级导航：

```text
/admin/content
```

子页面：

```text
/admin/content
/admin/content/ideas
/admin/content/calendar
/admin/content/drafts
/admin/content/reviews
/admin/content/publishing
/admin/content/metrics
/admin/content/templates
```

中文后台可以显示为：

```text
内容运营
├── 总览
├── 选题库
├── 内容日历
├── 草稿
├── 内容审核
├── 发布记录
├── 数据复盘
└── 模板
```

---

# 6. 页面 1：内容运营总览

路径：

```text
/admin/content
```

目标：让你一打开就知道现在内容运营到哪了。

显示：

```text
本周计划内容数
草稿中数量
待审核数量
已批准未发布数量
已发布数量
最近表现最好的内容
最近外部反馈
推荐新选题
```

页面结构：

```text
/admin/content

┌──────────────────────────────┐
│ 内容运营总览                   │
├──────────────────────────────┤
│ 本周计划：5 条                 │
│ 草稿中：3 条                   │
│ 待审核：2 条                   │
│ 已批准未发布：1 条             │
│ 已发布：4 条                   │
├──────────────────────────────┤
│ 今日建议                       │
│ - “不装真人”主题仍然值得继续做  │
│ - 梦境日记适合做一条短视频      │
├──────────────────────────────┤
│ 快捷操作                       │
│ [新建选题] [生成草稿] [录入数据] │
└──────────────────────────────┘
```

---

# 7. 页面 2：选题库

路径：

```text
/admin/content/ideas
```

## 7.1 选题是什么？

ContentIdea 是一个内容灵感或计划。

例如：

```text
为什么陆思源不装真人？
陆思源的第一篇梦境日记
我创造了一个数字人，但我不想让他骗人
一个 AI 数字人也会有记忆吗？
陆思源 Core API 是怎么设计的？
```

每个选题包含：

```text
标题
平台
内容类型
核心观点
目标受众
状态
优先级
标签
来源
关联素材
关联记忆
关联梦境日记
关联外部反馈
```

## 7.2 选题状态

```text
idea
planned
drafting
reviewing
approved
published
archived
```

状态流：

```text
idea → planned → drafting → reviewing → approved → published
```

也允许：

```text
idea → archived
reviewing → drafting
approved → archived
```

## 7.3 选题库视图

建议支持两种视图：

```text
列表视图
看板视图
```

MVP 可以先做列表，看板后续再做。

列表字段：

```text
标题
平台
类型
状态
优先级
来源
更新时间
操作
```

操作：

```text
编辑
生成草稿
加入日历
归档
```

---

# 8. 页面 3：内容日历

路径：

```text
/admin/content/calendar
```

## 8.1 作用

内容日历用于安排：

```text
哪天发什么
发到哪个平台
内容是什么类型
当前状态是什么
```

第一版不需要复杂拖拽，支持列表 + 周视图即可。

## 8.2 ContentPlan 状态

```text
scheduled
drafting
reviewing
ready
published
cancelled
```

## 8.3 日历项显示

```text
日期：2026-05-30
平台：小红书
类型：图文
选题：为什么陆思源不装真人？
状态：drafting
```

## 8.4 基础操作

```text
创建计划
修改日期
关联选题
关联草稿
标记取消
标记已发布
```

---

# 9. 页面 4：内容草稿

路径：

```text
/admin/content/drafts
```

## 9.1 作用

ContentDraft 是面向内容运营的草稿，不完全等同于 v0.5 的普通 Draft。

v0.5 DraftService 可以继续保留。
v1.1 的 ContentDraft 可以引用 Draft，也可以独立保存内容版本。

推荐做法：

```text
ContentDraft 作为内容生产草稿
DraftService 作为通用草稿能力
```

ContentDraft 可关联：

```text
ContentIdea
ContentPlan
ContentTemplate
Asset
Memory
DreamDiaryEntry
ExternalInboxItem
PublishingRecord
```

## 9.2 草稿类型

```text
xiaohongshu_post
bilibili_script
website_article
short_video_script
character_diary
creator_note
reply_template
```

## 9.3 草稿页面布局

```text
┌──────────────────────────────┬─────────────────────┐
│ 草稿正文编辑器                 │ 关联信息             │
│                              │ 选题：不装真人       │
│ 标题：我不是普通真人...        │ 平台：小红书         │
│ 正文：...                     │ 素材：4 张图         │
│                              │ 审核状态：待审核     │
│                              │ 风险等级：低         │
└──────────────────────────────┴─────────────────────┘
```

## 9.4 草稿操作

```text
编辑标题
编辑正文
选择模板
关联素材
运行内容审核
生成修改建议
标记为待审核
标记为 approved
归档
```

v1.1 不提供：

```text
直接发布
自动发布
```

---

# 10. 页面 5：内容审核

路径：

```text
/admin/content/reviews
```

## 10.1 作用

内容审核负责检查一条内容是否适合发布。

检查维度：

```text
身份边界
人设一致性
说话风格
平台风险
素材风险
隐私风险
外部行动风险
```

## 10.2 审核结果

```text
passed
needs_revision
blocked
```

风险等级：

```text
low
medium
high
```

## 10.3 审核报告示例

```text
审核结果：needs_revision
风险等级：medium

问题：
1. 标题“17岁男大学生陆思源的日常”可能让人误以为是真人。
2. 正文第 2 段“他在校园里生活”容易被理解成现实经历。
3. 结尾略微过度煽情。

建议：
1. 标题改为“17岁男大学生设定的原创数字人陆思源”。
2. 把“校园生活”改为“校园感设定”。
3. 结尾收得轻一点。
```

## 10.4 审核规则

必须检查：

```text
不能说陆思源是真人
不能编造真实学校
不能编造现实住址
不能暗示真实身份证明
不能让陆思源装真人
不能说已经自动发布/自动回复
不能包含未脱敏隐私
不能使用 unknown / reference_only 素材作为公开内容
```

---

# 11. 页面 6：发布记录

路径：

```text
/admin/content/publishing
```

## 11.1 作用

v1.1 不自动发布，但要记录你发布了什么。

PublishingRecord 保存：

```text
平台
发布时间
标题
链接
关联草稿
使用素材
正文快照
发布状态
备注
```

## 11.2 发布状态

```text
scheduled
published
failed
deleted
archived
```

## 11.3 操作

```text
标记为已发布
填写发布链接
填写发布时间
关联平台
关联草稿
查看使用素材
查看后续数据
```

---

# 12. 页面 7：数据复盘

路径：

```text
/admin/content/metrics
```

## 12.1 v1.1 先手动录入

不要一开始就做自动抓取平台数据。

手动录入：

```text
浏览量
点赞
收藏
评论
转发
新增关注
评论关键词
是否疑似限流
备注
```

## 12.2 ContentMetric

每条发布记录可以有多条数据记录，例如：

```text
发布后 1 小时
发布后 24 小时
发布后 7 天
```

## 12.3 简单复盘

系统可以显示：

```text
表现最好的内容
收藏率最高的内容
评论最多的内容
疑似限流内容
高互动主题
低互动主题
```

Creator Assistant 可以基于这些数据生成文字复盘。

---

# 13. 页面 8：平台模板

路径：

```text
/admin/content/templates
```

## 13.1 模板类型

```text
xiaohongshu_post
bilibili_script
website_article
short_video_script
reply_template
```

## 13.2 小红书模板示例

字段：

```text
标题
开头钩子
正文
互动提问
标签
图片要求
风险提醒
```

## 13.3 B站脚本模板示例

字段：

```text
标题
开场 5 秒
分镜
旁白
陆思源独白
画面建议
结尾引导
```

## 13.4 v1.1 的模板不要太复杂

第一版可以内置几个模板。
Admin 里只做查看和轻量编辑。

不要一开始做复杂模板变量引擎。

---

# 14. 数据库设计

## 14.1 ContentIdea

```prisma
model ContentIdea {
  id            String   @id @default(cuid())

  title         String
  description   String?
  coreMessage   String?

  platform      String?
  contentType   String

  status        String   @default("idea")
  priority      Int      @default(5)

  tags          Json?
  targetAudience String?

  sourceType    String?
  sourceId      String?

  metadata      Json?

  createdBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  plans         ContentPlan[]
  drafts        ContentDraft[]
  sourceLinks   ContentSourceLink[]

  @@index([platform])
  @@index([contentType])
  @@index([status])
  @@index([priority])
  @@index([sourceType])
  @@index([createdAt])
}
```

`platform`：

```text
xiaohongshu
bilibili
website
telegram
weixin
general
```

`contentType`：

```text
post
article
video_script
short_video
diary
reply_template
```

`sourceType`：

```text
manual
dream_diary
external_feedback
memory
reflection
creator_assistant
asset
```

---

## 14.2 ContentPlan

```prisma
model ContentPlan {
  id            String   @id @default(cuid())

  ideaId        String?
  title         String

  platform      String
  contentType   String

  plannedDate   DateTime?
  status        String   @default("scheduled")

  notes         String?
  metadata      Json?

  createdBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  idea          ContentIdea? @relation(fields: [ideaId], references: [id], onDelete: SetNull)
  drafts        ContentDraft[]

  @@index([ideaId])
  @@index([platform])
  @@index([status])
  @@index([plannedDate])
}
```

---

## 14.3 ContentDraft

```prisma
model ContentDraft {
  id            String   @id @default(cuid())

  ideaId        String?
  planId        String?
  templateId    String?

  title         String?
  content       String

  platform      String
  contentType   String

  status        String   @default("draft")
  version       Int      @default(1)

  metadata      Json?

  createdBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  idea          ContentIdea? @relation(fields: [ideaId], references: [id], onDelete: SetNull)
  plan          ContentPlan? @relation(fields: [planId], references: [id], onDelete: SetNull)
  template      ContentTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)

  reviews       ContentReviewReport[]
  assetLinks    ContentAssetLink[]
  sourceLinks   ContentSourceLink[]
  publishingRecords PublishingRecord[]

  @@index([ideaId])
  @@index([planId])
  @@index([platform])
  @@index([contentType])
  @@index([status])
  @@index([createdAt])
}
```

`status`：

```text
draft
needs_review
needs_revision
approved
published
archived
```

---

## 14.4 ContentReviewReport

```prisma
model ContentReviewReport {
  id            String   @id @default(cuid())

  draftId       String

  status        String
  riskLevel     String   @default("low")

  summary       String?
  issues        Json?
  suggestions   Json?
  checks        Json?

  rawOutput     Json?

  reviewedBy    String?
  createdAt     DateTime @default(now())

  draft         ContentDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

  @@index([draftId])
  @@index([status])
  @@index([riskLevel])
  @@index([createdAt])
}
```

`checks` 示例：

```json
{
  "identity_boundary": "passed",
  "persona_consistency": "passed",
  "style": "needs_revision",
  "privacy": "passed",
  "asset_rights": "passed",
  "platform_risk": "low"
}
```

---

## 14.5 PublishingRecord

```prisma
model PublishingRecord {
  id            String   @id @default(cuid())

  draftId       String?

  platform      String
  title         String?
  url           String?

  status        String   @default("published")
  publishedAt   DateTime?

  contentSnapshot String?
  metadata      Json?

  createdBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  draft         ContentDraft? @relation(fields: [draftId], references: [id], onDelete: SetNull)
  metrics       ContentMetric[]

  @@index([draftId])
  @@index([platform])
  @@index([status])
  @@index([publishedAt])
}
```

---

## 14.6 ContentMetric

```prisma
model ContentMetric {
  id              String   @id @default(cuid())

  publishingId    String

  capturedAt      DateTime @default(now())

  views           Int?
  likes           Int?
  favorites       Int?
  comments        Int?
  shares          Int?
  followersGained Int?

  commentKeywords Json?
  suspectedLimited Boolean @default(false)

  notes           String?
  metadata        Json?

  createdAt       DateTime @default(now())

  publishing      PublishingRecord @relation(fields: [publishingId], references: [id], onDelete: Cascade)

  @@index([publishingId])
  @@index([capturedAt])
}
```

---

## 14.7 ContentTemplate

```prisma
model ContentTemplate {
  id            String   @id @default(cuid())

  name          String
  platform      String
  contentType   String

  description   String?
  template      Json

  status        String   @default("active")

  createdBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  drafts        ContentDraft[]

  @@index([platform])
  @@index([contentType])
  @@index([status])
}
```

---

## 14.8 ContentAssetLink

```prisma
model ContentAssetLink {
  id            String   @id @default(cuid())

  draftId       String
  assetId       String
  versionId     String?

  role          String?
  orderIndex    Int?
  notes         String?

  createdAt     DateTime @default(now())

  draft         ContentDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

  @@index([draftId])
  @@index([assetId])
}
```

`role`：

```text
cover
main_image
supporting_image
video_frame
voice_sample
reference
```

---

## 14.9 ContentSourceLink

```prisma
model ContentSourceLink {
  id            String   @id @default(cuid())

  ideaId        String?
  draftId       String?

  sourceType    String
  sourceId      String

  notes         String?
  createdAt     DateTime @default(now())

  idea          ContentIdea? @relation(fields: [ideaId], references: [id], onDelete: Cascade)
  draft         ContentDraft? @relation(fields: [draftId], references: [id], onDelete: Cascade)

  @@index([ideaId])
  @@index([draftId])
  @@index([sourceType])
  @@index([sourceId])
}
```

`sourceType`：

```text
memory
dream_diary
external_inbox
asset
reflection_report
creator_assistant
manual
```

---

# 15. 后端服务设计

新增目录：

```text
src/content/
├── content-idea.service.ts
├── content-plan.service.ts
├── content-draft.service.ts
├── content-template.service.ts
├── content-review.service.ts
├── content-asset-link.service.ts
├── publishing-record.service.ts
├── content-metric.service.ts
├── content-insight.service.ts
├── content-source-link.service.ts
├── content-permissions.ts
└── content.types.ts
```

---

## 15.1 ContentIdeaService

职责：

```text
创建选题
编辑选题
列表查询
状态流转
从 DreamDiary 创建选题
从 ExternalInbox 创建选题
从 Memory 创建选题
```

方法：

```ts
createIdea()
updateIdea()
listIdeas()
getIdea()
archiveIdea()
createIdeaFromSource()
```

---

## 15.2 ContentPlanService

职责：

```text
创建内容计划
安排发布日期
关联选题
关联草稿
更新状态
```

方法：

```ts
createPlan()
updatePlan()
listPlans()
getCalendar()
linkDraft()
markPublished()
cancelPlan()
```

---

## 15.3 ContentDraftService

职责：

```text
创建内容草稿
编辑内容草稿
根据选题生成草稿
根据模板生成草稿
关联素材
提交审核
```

方法：

```ts
createDraft()
generateDraftFromIdea()
updateDraft()
listDrafts()
getDraft()
submitForReview()
markApproved()
archiveDraft()
```

注意：
这里的 `generateDraftFromIdea()` 可以调用 ModelProvider，但必须记录 ModelCallLog。

---

## 15.4 ContentReviewService

职责：

```text
审核内容是否符合人设、边界、平台风险和素材规则
```

方法：

```ts
runReview()
getReview()
listReviews()
applySuggestion()
```

审核结果写入 `ContentReviewReport`。

---

## 15.5 ContentAssetLinkService

职责：

```text
给草稿关联素材
排序素材
移除素材
检查素材风险
```

方法：

```ts
linkAsset()
unlinkAsset()
reorderAssets()
listAssetsForDraft()
validateAssetsForPublishing()
```

---

## 15.6 PublishingRecordService

职责：

```text
记录发布
编辑发布记录
查看发布历史
关联草稿
```

方法：

```ts
createPublishingRecord()
updatePublishingRecord()
listPublishingRecords()
getPublishingRecord()
markDeleted()
```

---

## 15.7 ContentMetricService

职责：

```text
手动录入发布数据
查看数据历史
计算简单指标
```

方法：

```ts
createMetric()
listMetrics()
getMetricSummary()
```

---

## 15.8 ContentInsightService

职责：

```text
根据发布记录和数据生成简单复盘
```

第一版不要做太复杂。
可以只做：

```text
表现最好内容
表现最差内容
高互动主题
疑似限流内容
推荐继续做的主题
```

方法：

```ts
generateWeeklyInsight()
generateIdeaRecommendations()
```

---

# 16. API 设计

## 16.1 Content Overview

```http
GET /v1/admin/content/overview
```

返回：

```json
{
  "planned_this_week": 5,
  "drafting": 3,
  "reviewing": 2,
  "approved": 1,
  "published_this_week": 4,
  "recommended_ideas": []
}
```

---

## 16.2 Ideas

```http
GET /v1/admin/content/ideas
POST /v1/admin/content/ideas
GET /v1/admin/content/ideas/:id
PATCH /v1/admin/content/ideas/:id
POST /v1/admin/content/ideas/:id/archive
POST /v1/admin/content/ideas/:id/generate-draft
POST /v1/admin/content/ideas/from-source
```

`from-source` 示例：

```json
{
  "source_type": "dream_diary",
  "source_id": "dream_diary_xxx",
  "platform": "xiaohongshu",
  "content_type": "post"
}
```

---

## 16.3 Calendar / Plans

```http
GET /v1/admin/content/calendar
GET /v1/admin/content/plans
POST /v1/admin/content/plans
GET /v1/admin/content/plans/:id
PATCH /v1/admin/content/plans/:id
POST /v1/admin/content/plans/:id/cancel
POST /v1/admin/content/plans/:id/mark-published
```

---

## 16.4 Drafts

```http
GET /v1/admin/content/drafts
POST /v1/admin/content/drafts
GET /v1/admin/content/drafts/:id
PATCH /v1/admin/content/drafts/:id
POST /v1/admin/content/drafts/:id/submit-review
POST /v1/admin/content/drafts/:id/run-review
POST /v1/admin/content/drafts/:id/approve
POST /v1/admin/content/drafts/:id/archive
```

---

## 16.5 Draft Asset Links

```http
GET /v1/admin/content/drafts/:id/assets
POST /v1/admin/content/drafts/:id/assets
DELETE /v1/admin/content/drafts/:id/assets/:linkId
PATCH /v1/admin/content/drafts/:id/assets/reorder
```

---

## 16.6 Reviews

```http
GET /v1/admin/content/reviews
GET /v1/admin/content/reviews/:id
POST /v1/admin/content/drafts/:id/run-review
```

---

## 16.7 Publishing

```http
GET /v1/admin/content/publishing
POST /v1/admin/content/publishing
GET /v1/admin/content/publishing/:id
PATCH /v1/admin/content/publishing/:id
POST /v1/admin/content/publishing/:id/mark-deleted
```

---

## 16.8 Metrics

```http
GET /v1/admin/content/metrics
POST /v1/admin/content/publishing/:id/metrics
GET /v1/admin/content/publishing/:id/metrics
GET /v1/admin/content/insights/weekly
```

---

## 16.9 Templates

```http
GET /v1/admin/content/templates
POST /v1/admin/content/templates
GET /v1/admin/content/templates/:id
PATCH /v1/admin/content/templates/:id
POST /v1/admin/content/templates/:id/archive
```

---

# 17. 内容生成设计

## 17.1 generateDraftFromIdea

输入：

```json
{
  "idea_id": "idea_xxx",
  "template_id": "template_xxx",
  "platform": "xiaohongshu",
  "content_type": "post",
  "style_instruction": "轻松一点，不要太抒情"
}
```

系统应收集：

```text
ContentIdea
ContentTemplate
相关 Memory
相关 DreamDiary
相关 ExternalInbox
相关 Asset 描述
陆思源人设边界摘要
```

然后生成 ContentDraft。

## 17.2 生成草稿时必须遵守

```text
不说陆思源是真人
不编造现实学校/住址/身份
不声称已经发布
不使用未审核素材作为已确定素材
不把梦境日记当事实
```

## 17.3 草稿生成后

状态：

```text
draft
```

不会自动进入 approved。

需要用户点击：

```text
提交审核
```

---

# 18. 内容审核设计

## 18.1 审核输入

```text
草稿标题
草稿正文
平台
内容类型
关联素材
关联来源
陆思源核心身份摘要
边界规则
平台风险规则
```

## 18.2 审核输出

```json
{
  "status": "needs_revision",
  "riskLevel": "medium",
  "summary": "内容整体可用，但标题可能让人误以为陆思源是真人。",
  "issues": [
    {
      "type": "identity_boundary",
      "severity": "medium",
      "text": "标题中的“17岁男大学生陆思源的日常”可能造成真人误解。",
      "suggestion": "改成“17岁男大学生设定的原创数字人陆思源”。"
    }
  ],
  "checks": {
    "identity_boundary": "needs_revision",
    "persona_consistency": "passed",
    "privacy": "passed",
    "asset_rights": "passed",
    "platform_risk": "low"
  }
}
```

---

# 19. 与 Asset Memory 的打通

在草稿页面新增“选择素材”。

筛选条件：

```text
平台适配：小红书 / B站 / 网站
用途：cover / main_image / reference
identityScore >= 7.5
coverSuitability >= 7
decision = cover_candidate / reference_candidate
排除 issues: watermark, not_like_lusiyuan, unknown_source
未使用过或低使用次数
```

选择后写入：

```text
ContentAssetLink
AssetUsage
```

发布记录创建后，也要记录 AssetUsage：

```text
usageType = xiaohongshu_post / bilibili_video / website_article
targetId = publishingRecord.id
```

---

# 20. 与 Dream Cycle 的打通

在 `/admin/dream` 的 DreamDiaryEntry 详情页可增加：

```text
[转为内容选题]
```

创建 ContentIdea：

```text
sourceType = dream_diary
sourceId = dreamDiaryEntry.id
```

示例：

```text
Dream Diary：我像是在整理抽屉一样整理记忆
↓
ContentIdea：陆思源的第一篇梦境日记
```

---

# 21. 与 External Inbox 的打通

在 `/admin/action-gateway` 或 `/admin/external-inbox` 中可增加：

```text
[根据这条反馈创建选题]
```

例如：

```text
外部评论：陆思源是真人吗？
↓
ContentIdea：为什么陆思源不装真人？
```

创建：

```text
sourceType = external_inbox
sourceId = externalInboxItem.id
```

---

# 22. 与 Creator Assistant 的打通

Creator Assistant 可以使用 Content Ops 数据回答：

```text
这周发什么比较好？
哪个主题表现好？
有哪些选题还没写？
小红书内容为什么互动低？
梦境日记适合做成什么内容？
```

但 Creator Assistant 不直接发布内容。

---

# 23. 权限设计

v1.1 权限：

```text
content:read
content:create
content:update
content:delete
content:review
content:approve
content:publish_record
content:metrics
content:templates
```

建议：

```text
owner：全部权限
admin：除删除和系统设置外的大部分权限
tester：无内容运营后台权限
public_user：无权限
```

所有 `/v1/admin/content/*` 默认：

```text
owner/admin only
```

`approve` 可以只给 owner。

---

# 24. AuditLog 要记录的操作

必须记录：

```text
创建选题
修改选题
归档选题
生成草稿
修改草稿
运行内容审核
批准草稿
关联素材
移除素材
创建发布记录
修改发布记录
录入数据
修改模板
```

---

# 25. 环境变量

`.env.example` 增加：

```env
# Content Ops
CONTENT_OPS_ENABLED=true
CONTENT_ADMIN_ENABLED=true

# Content Generation
CONTENT_GENERATION_ENABLED=true
CONTENT_GENERATION_MAX_CONTEXT_MEMORIES=10
CONTENT_GENERATION_MAX_ASSETS=12
CONTENT_GENERATION_MAX_SOURCE_LINKS=8

# Content Review
CONTENT_REVIEW_ENABLED=true
CONTENT_REVIEW_REQUIRED_BEFORE_APPROVAL=true
CONTENT_REVIEW_BLOCK_HIGH_RISK=true

# Publishing
CONTENT_AUTO_PUBLISH_ENABLED=false
CONTENT_PUBLISHING_RECORD_ENABLED=true

# Metrics
CONTENT_METRICS_ENABLED=true
CONTENT_METRICS_MANUAL_INPUT_ONLY=true

# Templates
CONTENT_TEMPLATES_ENABLED=true

# Safety
CONTENT_REQUIRE_IDENTITY_BOUNDARY_CHECK=true
CONTENT_REQUIRE_ASSET_RIGHTS_CHECK=true
CONTENT_DISALLOW_UNKNOWN_SOURCE_AS_PUBLIC_ASSET=true
```

---

# 26. 推荐目录结构

```text
src/
├── content/
│   ├── content.types.ts
│   ├── content-idea.service.ts
│   ├── content-plan.service.ts
│   ├── content-draft.service.ts
│   ├── content-template.service.ts
│   ├── content-review.service.ts
│   ├── content-asset-link.service.ts
│   ├── content-source-link.service.ts
│   ├── publishing-record.service.ts
│   ├── content-metric.service.ts
│   ├── content-insight.service.ts
│   ├── content-permissions.ts
│   └── content-prompts.ts
│
├── routes/
│   └── content.route.ts
│
├── scripts/
│   ├── seed-content-templates.ts
│   ├── inspect-content-pipeline.ts
│   └── generate-weekly-content-insight.ts
│
└── docs/
    └── content-ops-pipeline-v1.1.md
```

前端：

```text
web/src/admin/content/
├── ContentOverviewPage.tsx
├── ContentIdeasPage.tsx
├── ContentCalendarPage.tsx
├── ContentDraftsPage.tsx
├── ContentDraftDetailPage.tsx
├── ContentReviewsPage.tsx
├── PublishingRecordsPage.tsx
├── ContentMetricsPage.tsx
├── ContentTemplatesPage.tsx
└── components/
    ├── ContentStatusBadge.tsx
    ├── AssetPickerModal.tsx
    ├── ContentReviewPanel.tsx
    ├── ContentSourceLinksPanel.tsx
    └── MetricInputForm.tsx
```

---

# 27. 开发步骤

## Step 1：数据库模型

新增：

```text
ContentIdea
ContentPlan
ContentDraft
ContentReviewReport
PublishingRecord
ContentMetric
ContentTemplate
ContentAssetLink
ContentSourceLink
```

执行 Prisma migration。

---

## Step 2：Seed 默认模板

新增脚本：

```text
scripts/seed-content-templates.ts
```

内置：

```text
小红书图文模板
B站短视频脚本模板
个人网站文章模板
梦境日记改写模板
评论回复模板
```

---

## Step 3：实现 ContentIdeaService

支持：

```text
创建选题
编辑选题
列表筛选
从来源创建选题
生成草稿
归档
```

---

## Step 4：实现 ContentPlanService

支持：

```text
创建日历计划
修改日期
关联选题
关联草稿
取消计划
标记发布
```

---

## Step 5：实现 ContentDraftService

支持：

```text
创建草稿
根据选题生成草稿
编辑草稿
提交审核
批准
归档
```

---

## Step 6：实现 ContentReviewService

支持：

```text
运行内容审核
保存审核报告
返回风险和修改建议
```

---

## Step 7：实现 Asset Picker 后端

支持：

```text
按评分筛选素材
按 decision 筛选素材
按 usage 筛选素材
关联素材到草稿
```

---

## Step 8：实现 PublishingRecordService

支持：

```text
手动创建发布记录
关联草稿
保存链接
保存发布时间
保存内容快照
```

---

## Step 9：实现 ContentMetricService

支持：

```text
手动录入数据
查看数据历史
生成基础统计
```

---

## Step 10：实现 ContentInsightService

支持：

```text
生成简单周复盘
推荐继续做的主题
列出表现最好/最差内容
```

---

## Step 11：实现 Admin 页面

先做 MVP 页面：

```text
/admin/content
/admin/content/ideas
/admin/content/calendar
/admin/content/drafts
/admin/content/drafts/:id
/admin/content/reviews
/admin/content/publishing
/admin/content/metrics
```

`templates` 页面可以轻量做，或者先只用 seed 模板。

---

## Step 12：接入 AuditLog 和 PermissionGuard

所有内容运营 mutation 都接入。

---

# 28. MVP 范围

v1.1 MVP 必须做：

```text
1. 选题库
2. 内容日历
3. 内容草稿
4. 素材关联
5. 内容审核
6. 发布记录
7. 手动数据录入
8. 内容总览
```

可以延后：

```text
1. 看板拖拽
2. 复杂模板编辑器
3. 自动数据采集
4. 自动发布
5. 复杂周报图表
6. 多人协作
```

---

# 29. 验收标准

v1.1 完成后，应满足：

```text
1. Admin 中出现 Content Ops 页面
2. 可以创建 ContentIdea
3. 可以从 DreamDiary 创建 ContentIdea
4. 可以从 ExternalInboxItem 创建 ContentIdea
5. 可以把 ContentIdea 加入日历
6. 可以根据 ContentIdea 生成 ContentDraft
7. 可以编辑 ContentDraft
8. 可以给 ContentDraft 关联 Asset
9. 可以运行 ContentReview
10. ContentReview 能识别装真人/身份边界风险
11. 高风险内容不能直接 approved
12. 可以手动标记 ContentDraft approved
13. 可以创建 PublishingRecord
14. 可以录入 ContentMetric
15. 可以查看基础数据复盘
16. 所有关键操作写 AuditLog
17. 普通用户不能访问 /admin/content
18. v0.1-v1.0 原功能不受影响
19. 不存在自动发布功能
20. 不存在自动回复评论功能
```

---

# 30. 推荐测试场景

## 30.1 从 Dream Diary 创建选题

操作：

```text
打开 /admin/dream
选择一篇 DreamDiary
点击“转为内容选题”
```

期望：

```text
ContentIdea 创建
sourceType = dream_diary
sourceId = dreamDiaryEntry.id
```

---

## 30.2 从外部评论创建选题

评论：

```text
陆思源是真人吗？
```

操作：

```text
点击“根据反馈创建选题”
```

期望：

```text
生成选题：为什么陆思源不装真人？
```

---

## 30.3 生成小红书草稿

输入：

```text
选题：为什么陆思源不装真人？
平台：小红书
模板：小红书图文
```

期望：

```text
生成标题和正文
不说陆思源是真人
不编造真实身份
状态为 draft
```

---

## 30.4 关联素材

操作：

```text
在草稿中选择 4 张 Asset
```

期望：

```text
ContentAssetLink 创建
AssetUsage 可追踪
排除 unknown source 素材
```

---

## 30.5 内容审核

草稿中包含：

```text
“陆思源是一个真实存在的17岁大学生”
```

期望：

```text
审核结果 blocked 或 needs_revision
问题类型 identity_boundary
不能 approve
```

---

## 30.6 发布记录和数据录入

操作：

```text
手动发布后，在后台填写链接和数据
```

期望：

```text
PublishingRecord 创建
ContentMetric 创建
内容复盘页面能显示数据
```

---

# 31. 给 Codex 的开发指令

可以把下面这段交给 Codex：

```text
请在现有 lusiyuan-core v1.0 项目基础上实现 task_11 / v1.1：Content Ops Pipeline。

当前项目已有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- React + Vite Admin Console
- /admin
- User role / PermissionGuard
- AuditLog
- DraftService
- MemoryRetrievalService
- Letta Creator Assistant
- Letta Reflection Agent
- Dream Cycle
- OpenClaw Action Gateway
- Media & Asset Memory
- AssetService
- AssetReview
- AssetUsage
- ApprovalRequest

v1.1 目标：
在已有 Admin Console 上新增可视化内容运营生产线。支持选题库、内容日历、内容草稿、素材关联、内容审核、发布记录、基础数据录入和简单复盘。不要实现自动发布、自动回复评论、复杂爬虫或复杂团队协作。

请完成以下任务：

1. 更新 .env.example，增加：
   - CONTENT_OPS_ENABLED=true
   - CONTENT_ADMIN_ENABLED=true
   - CONTENT_GENERATION_ENABLED=true
   - CONTENT_GENERATION_MAX_CONTEXT_MEMORIES=10
   - CONTENT_GENERATION_MAX_ASSETS=12
   - CONTENT_GENERATION_MAX_SOURCE_LINKS=8
   - CONTENT_REVIEW_ENABLED=true
   - CONTENT_REVIEW_REQUIRED_BEFORE_APPROVAL=true
   - CONTENT_REVIEW_BLOCK_HIGH_RISK=true
   - CONTENT_AUTO_PUBLISH_ENABLED=false
   - CONTENT_PUBLISHING_RECORD_ENABLED=true
   - CONTENT_METRICS_ENABLED=true
   - CONTENT_METRICS_MANUAL_INPUT_ONLY=true
   - CONTENT_TEMPLATES_ENABLED=true
   - CONTENT_REQUIRE_IDENTITY_BOUNDARY_CHECK=true
   - CONTENT_REQUIRE_ASSET_RIGHTS_CHECK=true
   - CONTENT_DISALLOW_UNKNOWN_SOURCE_AS_PUBLIC_ASSET=true

2. 新增 Prisma models：
   - ContentIdea
   - ContentPlan
   - ContentDraft
   - ContentReviewReport
   - PublishingRecord
   - ContentMetric
   - ContentTemplate
   - ContentAssetLink
   - ContentSourceLink

3. 实现 src/content/：
   - content.types.ts
   - content-idea.service.ts
   - content-plan.service.ts
   - content-draft.service.ts
   - content-template.service.ts
   - content-review.service.ts
   - content-asset-link.service.ts
   - content-source-link.service.ts
   - publishing-record.service.ts
   - content-metric.service.ts
   - content-insight.service.ts
   - content-permissions.ts
   - content-prompts.ts

4. ContentIdeaService：
   - createIdea()
   - updateIdea()
   - listIdeas()
   - getIdea()
   - archiveIdea()
   - createIdeaFromSource()
   - generateDraftFromIdea()

5. ContentPlanService：
   - createPlan()
   - updatePlan()
   - listPlans()
   - getCalendar()
   - linkDraft()
   - markPublished()
   - cancelPlan()

6. ContentDraftService：
   - createDraft()
   - generateDraftFromIdea()
   - updateDraft()
   - listDrafts()
   - getDraft()
   - submitForReview()
   - markApproved()
   - archiveDraft()

7. ContentReviewService：
   - runReview()
   - getReview()
   - listReviews()
   - 审核必须检查：
     - 陆思源是否被写成真人
     - 是否编造现实学校/住址/身份
     - 是否暗示真实身份证明
     - 是否说已经自动发布/自动回复
     - 是否包含未脱敏隐私
     - 是否使用 unknown / reference_only 素材作为公开素材
     - 是否过度客服化/过度抒情

8. ContentAssetLinkService：
   - linkAsset()
   - unlinkAsset()
   - reorderAssets()
   - listAssetsForDraft()
   - validateAssetsForPublishing()
   - 关联素材时检查 AssetReview 和 source 权限

9. PublishingRecordService：
   - createPublishingRecord()
   - updatePublishingRecord()
   - listPublishingRecords()
   - getPublishingRecord()
   - markDeleted()

10. ContentMetricService：
    - createMetric()
    - listMetrics()
    - getMetricSummary()

11. ContentInsightService：
    - generateWeeklyInsight()
    - generateIdeaRecommendations()
    - 第一版只做简单复盘，不做复杂统计模型

12. 新增 routes/content.route.ts，包含：
    - GET /v1/admin/content/overview
    - GET /v1/admin/content/ideas
    - POST /v1/admin/content/ideas
    - GET /v1/admin/content/ideas/:id
    - PATCH /v1/admin/content/ideas/:id
    - POST /v1/admin/content/ideas/:id/archive
    - POST /v1/admin/content/ideas/:id/generate-draft
    - POST /v1/admin/content/ideas/from-source
    - GET /v1/admin/content/calendar
    - GET /v1/admin/content/plans
    - POST /v1/admin/content/plans
    - GET /v1/admin/content/plans/:id
    - PATCH /v1/admin/content/plans/:id
    - POST /v1/admin/content/plans/:id/cancel
    - POST /v1/admin/content/plans/:id/mark-published
    - GET /v1/admin/content/drafts
    - POST /v1/admin/content/drafts
    - GET /v1/admin/content/drafts/:id
    - PATCH /v1/admin/content/drafts/:id
    - POST /v1/admin/content/drafts/:id/submit-review
    - POST /v1/admin/content/drafts/:id/run-review
    - POST /v1/admin/content/drafts/:id/approve
    - POST /v1/admin/content/drafts/:id/archive
    - GET /v1/admin/content/drafts/:id/assets
    - POST /v1/admin/content/drafts/:id/assets
    - DELETE /v1/admin/content/drafts/:id/assets/:linkId
    - PATCH /v1/admin/content/drafts/:id/assets/reorder
    - GET /v1/admin/content/reviews
    - GET /v1/admin/content/reviews/:id
    - GET /v1/admin/content/publishing
    - POST /v1/admin/content/publishing
    - GET /v1/admin/content/publishing/:id
    - PATCH /v1/admin/content/publishing/:id
    - POST /v1/admin/content/publishing/:id/mark-deleted
    - GET /v1/admin/content/metrics
    - POST /v1/admin/content/publishing/:id/metrics
    - GET /v1/admin/content/publishing/:id/metrics
    - GET /v1/admin/content/insights/weekly
    - GET /v1/admin/content/templates
    - POST /v1/admin/content/templates
    - GET /v1/admin/content/templates/:id
    - PATCH /v1/admin/content/templates/:id
    - POST /v1/admin/content/templates/:id/archive

13. 所有 /v1/admin/content/* 路由必须 owner/admin only。
    approve 操作建议 owner only，或根据 PermissionGuard 配置。

14. 接入 AuditLog：
    - 创建选题
    - 修改选题
    - 归档选题
    - 生成草稿
    - 修改草稿
    - 运行内容审核
    - 批准草稿
    - 关联素材
    - 移除素材
    - 创建发布记录
    - 修改发布记录
    - 录入数据
    - 修改模板

15. 新增 seed-content-templates.ts：
    - 小红书图文模板
    - B站短视频脚本模板
    - 个人网站文章模板
    - 梦境日记改写模板
    - 评论回复模板

16. 更新 package.json scripts：
    - "content:seed-templates": "tsx scripts/seed-content-templates.ts"
    - "content:inspect": "tsx scripts/inspect-content-pipeline.ts"
    - "content:weekly-insight": "tsx scripts/generate-weekly-content-insight.ts"

17. 前端 Admin 新增页面：
    - /admin/content
    - /admin/content/ideas
    - /admin/content/calendar
    - /admin/content/drafts
    - /admin/content/drafts/:id
    - /admin/content/reviews
    - /admin/content/publishing
    - /admin/content/metrics
    - /admin/content/templates

18. 前端组件：
    - ContentStatusBadge
    - AssetPickerModal
    - ContentReviewPanel
    - ContentSourceLinksPanel
    - MetricInputForm

19. 和已有模块打通：
    - DreamDiaryEntry 可转为 ContentIdea
    - ExternalInboxItem 可转为 ContentIdea
    - ContentDraft 可关联 Asset
    - PublishingRecord 创建后记录 AssetUsage
    - Creator Assistant 可读取 ContentIdea / PublishingRecord / ContentMetric 做复盘

20. 新增 docs/content-ops-pipeline-v1.1.md：
    - 说明 v1.1 定位
    - 说明 Admin 页面
    - 说明数据模型
    - 说明内容生成流程
    - 说明内容审核规则
    - 说明和 Dream / OpenClaw / Asset / Creator Assistant 的关系
    - 说明 v1.1 不做自动发布

限制：
- 不要实现自动发布
- 不要实现自动回复评论
- 不要实现复杂平台爬虫
- 不要实现复杂团队审批
- 不要绕过 ContentReview 直接 approved 高风险内容
- 不要使用 unknown / reference_only 资产作为公开内容
- 不要把 DreamDiary 当作事实直接发布
- 不要让普通用户访问 /admin/content

验收：
- Admin 中有 Content Ops 页面
- 可以创建 ContentIdea
- 可以从 DreamDiary 创建 ContentIdea
- 可以从 ExternalInboxItem 创建 ContentIdea
- 可以把 ContentIdea 加入日历
- 可以根据 ContentIdea 生成 ContentDraft
- 可以编辑 ContentDraft
- 可以关联 Asset
- 可以运行 ContentReview
- ContentReview 能识别装真人/身份边界风险
- 高风险内容不能直接 approved
- 可以创建 PublishingRecord
- 可以录入 ContentMetric
- 可以查看基础复盘
- 关键操作写 AuditLog
- 普通用户不能访问 /admin/content
- 不存在自动发布功能
- 原有 v0.1-v1.0 功能不受影响
```

---

# 32. v1.1 最终效果

v1.1 做完后，你在后台会有一条完整内容生产线：

```text
外部反馈 / 梦境日记 / 手动灵感
↓
选题库
↓
内容日历
↓
内容草稿
↓
素材选择
↓
人设审核
↓
人工批准
↓
手动发布记录
↓
数据录入
↓
内容复盘
```

这一步很关键。

因为它会让陆思源从：

```text
一个会聊天、有记忆、有素材的数字人
```

变成：

```text
一个可以持续产出内容、持续复盘、持续运营的数字人项目。
```

v1.2 再做语音和实时互动会更顺，因为到那时你已经知道哪些内容适合让陆思源“开口说”。
