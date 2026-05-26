可以，下面是完整的 **task_12 / v1.2：Voice & Realtime Interaction 技术设计文档**。
这一版的重点是：**让陆思源开始拥有“声音能力”**，但不要一上来就做复杂实时直播数字人。先把音色、TTS、语音草稿、口播、音频资产、审核和后台管理打稳。

---

# task_12：Voice & Realtime Interaction

# 陆思源 Core API v1.2：声音与实时互动系统

## 1. v1.2 目标

前面版本已经有：

```text
v0.4：长期记忆
v0.5：工具与草稿
v0.75：Dream Cycle
v0.9：Media & Asset Memory
v1.1：Content Ops Pipeline
```

v1.2 的目标是新增：

```text
Voice & Realtime Interaction
```

也就是让陆思源具备：

```text
1. 音色资产管理
2. TTS 文本转语音
3. 语音回复草稿
4. 口播音频生成
5. 内容脚本转音频
6. 音频审核
7. 语音风格配置
8. Web Chat 语音播放
9. 后续实时语音互动预留
```

一句话：

```text
v1.2 不是立刻做“实时直播数字人”，而是先让陆思源稳定拥有可控、可审核、可复用的声音能力。
```

---

# 2. 为什么 v1.2 现在做声音？

因为 v1.1 已经有内容生产线：

```text
选题
草稿
素材
审核
发布记录
数据复盘
```

这时候再做声音很自然。

比如：

```text
小红书图文 → 可以生成陆思源口播版
B站脚本 → 可以生成旁白音频
梦境日记 → 可以生成陆思源独白
Web Chat → 可以播放陆思源语音回复
音色样本 → 可以进入 Asset Memory 管理
```

如果太早做声音，会遇到问题：

```text
1. 人设还没稳定，声音气质容易选错
2. 内容方向还没稳定，录音需求不明确
3. 口播脚本还没形成流程
4. 音频资产没有管理系统
```

现在做比较合适，因为前面已经有：

```text
Asset Memory
Content Ops
Draft
Admin
Review
AuditLog
```

可以承接声音系统。

---

# 3. v1.2 核心原则

```text
1. 声音是陆思源人格的一部分，不能随便换。
2. 所有正式音频都必须可追踪来源。
3. TTS 输出先作为草稿，不自动发布。
4. 音色样本、TTS 输出、口播音频都进入 Asset Memory。
5. 声音风格要可配置，但不能破坏陆思源人设。
6. 实时互动先预留，不在 v1.2 做复杂直播级低延迟系统。
7. 语音内容发布前必须经过内容审核和音频审核。
8. 任何音频都不能暗示陆思源是真人。
```

最重要的是：

```text
声音能力 ≠ 自动对外发声。
```

---

# 4. v1.2 不做什么

v1.2 明确不做：

```text
1. 不做实时直播数字人
2. 不做自动开麦聊天房
3. 不做自动发布音频/视频
4. 不做自动克隆真人声音的完整训练平台
5. 不做复杂音频编辑器
6. 不做多人语音会议
7. 不做虚拟形象口型驱动
8. 不做实时视频驱动
9. 不做商业版权管理系统
10. 不做自动语音私信回复
```

v1.2 只做：

```text
音色资产管理
TTS Provider 抽象
语音草稿生成
音频审核
口播生成
Web Chat 播放
Admin 可视化管理
实时语音预留接口
```

---

# 5. 总体架构

新增模块：

```text
Lusiyuan Core API
└── Voice System
    ├── VoiceProfileService
    ├── VoiceSampleService
    ├── TtsProviderService
    ├── VoiceGenerationService
    ├── VoiceDraftService
    ├── VoiceReviewService
    ├── VoiceUsageService
    ├── VoicePlaybackService
    └── RealtimeVoiceGateway 预留
```

整体流程：

```text
文本草稿 / 聊天回复 / 内容脚本 / 梦境日记
↓
Voice Style 配置
↓
TTS Provider
↓
生成音频文件
↓
保存到 Asset Memory
↓
生成 VoiceDraft
↓
音频审核
↓
人工确认
↓
用于 Web Chat / 内容发布 / B站口播 / 小红书视频
```

---

# 6. v1.2 Admin 页面

在已有 Admin Console 中新增：

```text
/admin/voice
/admin/voice/profiles
/admin/voice/samples
/admin/voice/generate
/admin/voice/drafts
/admin/voice/reviews
/admin/voice/settings
```

中文：

```text
声音系统
├── 总览
├── 音色档案
├── 音色样本
├── 生成语音
├── 语音草稿
├── 音频审核
└── 设置
```

---

# 7. 页面 1：Voice Overview

路径：

```text
/admin/voice
```

显示：

```text
当前默认音色
今日生成音频数
待审核语音草稿
最近 TTS 调用
最近失败任务
音频资产数量
本月语音生成成本估算
```

页面结构：

```text
/admin/voice

┌──────────────────────────────┐
│ 声音系统总览                   │
├──────────────────────────────┤
│ 默认音色：陆思源 v1             │
│ 今日生成：12 条                 │
│ 待审核：4 条                    │
│ 失败任务：1 条                  │
├──────────────────────────────┤
│ 快捷操作                       │
│ [生成语音] [上传样本] [查看草稿] │
└──────────────────────────────┘
```

---

# 8. 页面 2：Voice Profiles 音色档案

路径：

```text
/admin/voice/profiles
```

## 8.1 VoiceProfile 是什么？

VoiceProfile 是陆思源的一个音色配置档案。

例如：

```text
陆思源 v1 少年自然音
陆思源 v1 轻松口播
陆思源 v1 梦境独白
陆思源 v1 B站旁白
```

每个 VoiceProfile 包含：

```text
名称
描述
TTS provider
provider voice id
默认语速
默认音量
默认情绪
适用场景
状态
是否默认
关联样本
风格说明
```

## 8.2 状态

```text
draft
testing
active
archived
rejected
```

正式系统中只允许一个默认 active voice。

---

# 9. 页面 3：Voice Samples 音色样本

路径：

```text
/admin/voice/samples
```

## 9.1 作用

用于管理：

```text
真人录音样本
素人试音样本
声优试音样本
TTS 输出样本
音色克隆参考样本
清洗后的音频样本
```

这些都应该进入 Asset Memory。

## 9.2 样本字段

```text
音频文件
样本类型
说话人标签
来源
授权状态
音质评分
少年感评分
自然度评分
贴合陆思源程度
备注
是否可用于训练/克隆
是否可用于公开
```

## 9.3 来源状态

```text
self_recorded
commissioned_voice_actor
student_voice_sample
tts_generated
reference_only
unknown
```

v1.2 必须注意：

```text
unknown / reference_only 不能用于正式公开音色。
```

---

# 10. 页面 4：Generate Voice 生成语音

路径：

```text
/admin/voice/generate
```

## 10.1 输入

```text
文本
选择 VoiceProfile
选择用途
语速
情绪
音量
是否保存为 Asset
是否创建 VoiceDraft
```

用途：

```text
chat_reply
xiaohongshu_voiceover
bilibili_voiceover
dream_diary_reading
website_audio
test_sample
```

## 10.2 输出

```text
音频播放器
生成状态
文件大小
时长
关联 Asset
关联 VoiceDraft
重新生成按钮
提交审核按钮
```

---

# 11. 页面 5：Voice Drafts 语音草稿

路径：

```text
/admin/voice/drafts
```

VoiceDraft 是一个“可审核的语音输出”。

它可以来源于：

```text
聊天回复
ContentDraft
DreamDiary
B站脚本
小红书口播
手动输入
```

状态：

```text
draft
needs_review
approved
rejected
archived
```

v1.2 不做自动发布，所以 approved 只是说明：

```text
这条音频可用于后续内容制作
```

不是已经发布。

---

# 12. 页面 6：Voice Reviews 音频审核

路径：

```text
/admin/voice/reviews
```

审核维度：

```text
音质
自然度
少年感
贴合陆思源程度
情绪是否过度
是否油腻
是否太像客服
是否像真人伪装
是否有错读
是否有危险内容
是否可公开使用
```

审核结果：

```text
passed
needs_regeneration
needs_text_edit
rejected
```

---

# 13. 页面 7：Voice Settings

路径：

```text
/admin/voice/settings
```

配置：

```text
默认 TTS provider
默认 VoiceProfile
默认输出格式
默认采样率
最大文本长度
最大生成次数
是否允许聊天语音回复
是否允许公开用户使用语音
是否允许自动生成语音草稿
是否允许实时语音预览
```

---

# 14. 数据库设计

## 14.1 VoiceProfile

```prisma
model VoiceProfile {
  id              String   @id @default(cuid())

  name            String
  description     String?

  provider        String
  providerVoiceId String?

  status          String   @default("draft")
  isDefault       Boolean  @default(false)

  defaultSpeed    Float?
  defaultPitch    Float?
  defaultVolume   Float?
  defaultEmotion  String?

  useCases        Json?
  stylePrompt     String?
  metadata        Json?

  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  samples         VoiceSample[]
  generations     VoiceGenerationJob[]
  drafts          VoiceDraft[]

  @@index([provider])
  @@index([status])
  @@index([isDefault])
}
```

`provider` 示例：

```text
minimax
elevenlabs
azure
openai
local
custom
```

这里不强绑定某一家，做 provider abstraction。

---

## 14.2 VoiceSample

```prisma
model VoiceSample {
  id              String   @id @default(cuid())

  profileId       String?
  assetId         String
  assetVersionId  String?

  sampleType      String
  source          String?
  rightsStatus    String   @default("unknown")

  naturalness     Float?
  youthfulness    Float?
  identityFit     Float?
  audioQuality    Float?

  transcript      String?
  notes           String?

  canUseForTraining Boolean @default(false)
  canUsePublicly    Boolean @default(false)

  status          String   @default("active")

  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  profile         VoiceProfile? @relation(fields: [profileId], references: [id], onDelete: SetNull)

  @@index([profileId])
  @@index([assetId])
  @@index([sampleType])
  @@index([rightsStatus])
  @@index([status])
}
```

`sampleType`：

```text
raw_recording
cleaned_recording
audition
tts_output
clone_reference
test_generation
```

`rightsStatus`：

```text
owned
licensed
commissioned
reference_only
unknown
```

---

## 14.3 VoiceGenerationJob

```prisma
model VoiceGenerationJob {
  id              String   @id @default(cuid())

  profileId       String?

  provider        String
  model           String?
  providerJobId   String?

  inputText       String
  inputHash       String?

  purpose         String
  status          String   @default("pending")

  speed           Float?
  pitch           Float?
  volume          Float?
  emotion         String?

  outputAssetId       String?
  outputAssetVersionId String?

  error           String?
  rawRequest      Json?
  rawResponse     Json?
  metadata        Json?

  requestedBy     String?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())

  profile         VoiceProfile? @relation(fields: [profileId], references: [id], onDelete: SetNull)

  @@index([profileId])
  @@index([provider])
  @@index([purpose])
  @@index([status])
  @@index([createdAt])
}
```

`purpose`：

```text
chat_reply
content_voiceover
dream_diary
sample_test
bilibili_script
xiaohongshu_video
website_audio
```

---

## 14.4 VoiceDraft

```prisma
model VoiceDraft {
  id              String   @id @default(cuid())

  profileId       String?
  generationJobId String?

  title           String?
  text            String
  purpose         String

  status          String   @default("draft")
  riskLevel       String   @default("low")

  sourceType      String?
  sourceId        String?

  assetId         String?
  assetVersionId  String?

  metadata        Json?

  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  profile         VoiceProfile? @relation(fields: [profileId], references: [id], onDelete: SetNull)
  reviews         VoiceReview[]

  @@index([profileId])
  @@index([generationJobId])
  @@index([purpose])
  @@index([status])
  @@index([sourceType])
  @@index([sourceId])
}
```

`sourceType`：

```text
manual
chat_message
content_draft
dream_diary
publishing_record
script
```

---

## 14.5 VoiceReview

```prisma
model VoiceReview {
  id              String   @id @default(cuid())

  draftId         String

  status          String
  riskLevel       String   @default("low")

  audioQuality    Float?
  naturalness     Float?
  youthfulness    Float?
  identityFit     Float?
  emotionFit      Float?

  issues          Json?
  suggestions     Json?
  notes           String?

  reviewedBy      String?
  createdAt       DateTime @default(now())

  draft           VoiceDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

  @@index([draftId])
  @@index([status])
  @@index([riskLevel])
  @@index([createdAt])
}
```

`issues` 示例：

```json
[
  "too_mature",
  "too_acted",
  "too_ai_like",
  "too_emotional",
  "mispronunciation",
  "bad_pacing",
  "not_like_lusiyuan",
  "sounds_like_customer_service"
]
```

---

## 14.6 VoiceUsage

```prisma
model VoiceUsage {
  id              String   @id @default(cuid())

  draftId         String?
  assetId         String?

  usageType       String
  targetType      String?
  targetId        String?

  notes           String?
  metadata        Json?

  createdAt       DateTime @default(now())

  @@index([draftId])
  @@index([assetId])
  @@index([usageType])
  @@index([targetType])
  @@index([targetId])
}
```

`usageType`：

```text
web_chat_reply
xiaohongshu_video
bilibili_video
website_audio
voice_sample
tts_test
```

---

# 15. 后端服务设计

新增目录：

```text
src/voice/
├── voice.types.ts
├── voice-profile.service.ts
├── voice-sample.service.ts
├── voice-generation.service.ts
├── voice-draft.service.ts
├── voice-review.service.ts
├── voice-usage.service.ts
├── voice-settings.service.ts
├── voice-permissions.ts
├── voice-prompts.ts
└── providers/
    ├── tts-provider.ts
    ├── minimax-tts.provider.ts
    ├── elevenlabs-tts.provider.ts
    ├── local-tts.provider.ts
    └── custom-tts.provider.ts
```

---

## 15.1 TtsProvider 抽象

不要把业务逻辑绑定某一家 TTS。

```ts
export interface TtsProvider {
  name: string;

  synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput>;

  getVoices?(): Promise<TtsVoiceInfo[]>;

  health?(): Promise<TtsProviderHealth>;
}
```

输入：

```ts
export interface TtsSynthesizeInput {
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: string;
  format?: "mp3" | "wav" | "ogg";
  sampleRate?: number;
  metadata?: Record<string, unknown>;
}
```

输出：

```ts
export interface TtsSynthesizeOutput {
  audioBuffer: Buffer;
  mimeType: string;
  durationMs?: number;
  providerRequestId?: string;
  rawResponse?: unknown;
}
```

---

## 15.2 VoiceProfileService

职责：

```text
创建音色档案
编辑音色档案
设置默认音色
归档音色
查询可用音色
```

方法：

```ts
createProfile()
updateProfile()
listProfiles()
getProfile()
setDefaultProfile()
archiveProfile()
```

---

## 15.3 VoiceSampleService

职责：

```text
上传音色样本
把音频 Asset 标记为 VoiceSample
记录授权状态
记录试听评价
关联 VoiceProfile
```

方法：

```ts
createSampleFromAsset()
uploadSample()
updateSampleReview()
listSamples()
getSample()
archiveSample()
```

---

## 15.4 VoiceGenerationService

职责：

```text
调用 TTS provider
生成音频文件
保存到 Asset Memory
创建 VoiceGenerationJob
可选创建 VoiceDraft
记录成本和日志
```

方法：

```ts
generateVoice()
retryGeneration()
getJob()
listJobs()
```

生成流程：

```text
输入文本
↓
选择 VoiceProfile
↓
检查长度和权限
↓
创建 VoiceGenerationJob
↓
调用 TTS Provider
↓
保存音频到 AssetService
↓
更新 VoiceGenerationJob
↓
创建 VoiceDraft
↓
返回播放器 URL
```

---

## 15.5 VoiceDraftService

职责：

```text
创建语音草稿
编辑语音文本
重新生成音频
提交审核
批准/拒绝
关联来源
```

方法：

```ts
createDraft()
createDraftFromContentDraft()
createDraftFromDreamDiary()
updateDraft()
regenerateAudio()
submitReview()
approveDraft()
rejectDraft()
archiveDraft()
```

---

## 15.6 VoiceReviewService

职责：

```text
审核音频是否可用
保存审核报告
输出修改建议
```

方法：

```ts
runReview()
createManualReview()
listReviews()
getReview()
```

v1.2 的审核可以先半自动：

```text
系统检查文本边界
人工听音频打分
```

AI 自动听音频分析可以后续再做，不强求 v1.2 完成。

---

## 15.7 VoiceUsageService

职责：

```text
记录某段音频用在哪里
```

方法：

```ts
recordUsage()
listUsageByDraft()
listUsageByAsset()
```

---

# 16. API 设计

全部后台接口默认：

```text
owner/admin only
```

## 16.1 Voice Overview

```http
GET /v1/admin/voice/overview
```

---

## 16.2 Voice Profiles

```http
GET /v1/admin/voice/profiles
POST /v1/admin/voice/profiles
GET /v1/admin/voice/profiles/:id
PATCH /v1/admin/voice/profiles/:id
POST /v1/admin/voice/profiles/:id/set-default
POST /v1/admin/voice/profiles/:id/archive
```

---

## 16.3 Voice Samples

```http
GET /v1/admin/voice/samples
POST /v1/admin/voice/samples/upload
POST /v1/admin/voice/samples/from-asset
GET /v1/admin/voice/samples/:id
PATCH /v1/admin/voice/samples/:id
POST /v1/admin/voice/samples/:id/archive
```

---

## 16.4 Voice Generation

```http
POST /v1/admin/voice/generate
GET /v1/admin/voice/generation-jobs
GET /v1/admin/voice/generation-jobs/:id
POST /v1/admin/voice/generation-jobs/:id/retry
```

请求示例：

```json
{
  "profile_id": "voice_profile_xxx",
  "text": "大家好，我是陆思源。不是一个普通真人，而是一个正在被认真创造的原创数字人。",
  "purpose": "xiaohongshu_video",
  "speed": 1.0,
  "emotion": "natural",
  "create_draft": true
}
```

---

## 16.5 Voice Drafts

```http
GET /v1/admin/voice/drafts
POST /v1/admin/voice/drafts
GET /v1/admin/voice/drafts/:id
PATCH /v1/admin/voice/drafts/:id
POST /v1/admin/voice/drafts/:id/regenerate
POST /v1/admin/voice/drafts/:id/submit-review
POST /v1/admin/voice/drafts/:id/approve
POST /v1/admin/voice/drafts/:id/reject
POST /v1/admin/voice/drafts/:id/archive
```

---

## 16.6 Voice Reviews

```http
GET /v1/admin/voice/reviews
GET /v1/admin/voice/reviews/:id
POST /v1/admin/voice/drafts/:id/run-review
POST /v1/admin/voice/drafts/:id/manual-review
```

---

## 16.7 Voice Usage

```http
POST /v1/admin/voice/drafts/:id/usage
GET /v1/admin/voice/drafts/:id/usage
GET /v1/admin/voice/assets/:assetId/usage
```

---

## 16.8 Voice Settings

```http
GET /v1/admin/voice/settings
PATCH /v1/admin/voice/settings
```

---

# 17. Web Chat 语音播放

v1.2 可以给 Web Chat 加一个轻量功能：

```text
给陆思源回复生成语音
```

但要分权限。

## 17.1 owner/admin/tester

可以显示：

```text
[生成语音]
[播放]
[重新生成]
```

## 17.2 public_user

默认关闭：

```env
VOICE_PUBLIC_CHAT_TTS_ENABLED=false
```

原因：

```text
1. 成本不可控
2. 语音生成较慢
3. 音色未完全稳定
4. 公开用户可能滥用
```

## 17.3 聊天语音流程

```text
Assistant Message
↓
用户点击生成语音
↓
创建 VoiceGenerationJob
↓
保存音频 Asset
↓
返回 audioUrl
↓
Web Chat 播放
```

不要默认每条消息都自动生成语音。

---

# 18. 和 Content Ops 的打通

v1.1 的 ContentDraft 可以一键生成语音。

例如：

```text
ContentDraft：B站短视频脚本
↓
点击“生成陆思源口播”
↓
选择 VoiceProfile：陆思源 v1 自然口播
↓
生成 VoiceDraft
↓
审核
↓
用于视频制作
```

新增入口：

```text
/admin/content/drafts/:id
右侧按钮：[生成语音]
```

生成后关联：

```text
sourceType = content_draft
sourceId = contentDraft.id
```

---

# 19. 和 Dream Cycle 的打通

Dream Diary 可以生成朗读版。

```text
DreamDiaryEntry
↓
生成梦境日记朗读音频
↓
VoiceDraft purpose = dream_diary_reading
↓
审核
↓
可用于短视频 / 网站
```

但要注意：

```text
Dream Diary 不是事实来源。
生成音频时要保留“这是梦境日记/内在记录”的语境。
```

---

# 20. 和 Asset Memory 的打通

所有音频文件都保存为 Asset。

Asset 类型：

```text
audio
```

metadata：

```json
{
  "voiceProfileId": "voice_profile_xxx",
  "voiceGenerationJobId": "job_xxx",
  "purpose": "bilibili_script",
  "ttsProvider": "minimax",
  "textHash": "..."
}
```

VoiceSample、VoiceDraft、VoiceUsage 都只引用 Asset，不直接存文件。

---

# 21. 和 Evaluation 的关系

v1.2 后，评测系统可以增加：

```text
voice_style_eval
voice_boundary_eval
voice_content_eval
```

第一版先占位，不需要完整实现。

后续可测：

```text
陆思源声音是否太成熟
是否像客服
是否过度表演
是否少年感不足
是否情绪过满
是否适合长期作为默认音色
```

---

# 22. 权限设计

新增权限：

```text
voice:read
voice:profile_create
voice:profile_update
voice:sample_upload
voice:generate
voice:review
voice:approve
voice:settings
```

建议：

```text
owner：全部
admin：可上传样本、生成语音、审核，但不能改默认音色
tester：可在 Web Chat 中生成少量语音
public_user：默认无语音生成权限
```

---

# 23. AuditLog 要记录

必须记录：

```text
创建 VoiceProfile
修改 VoiceProfile
设置默认 VoiceProfile
上传 VoiceSample
修改样本授权状态
生成语音
重试生成
创建 VoiceDraft
批准/拒绝 VoiceDraft
创建 VoiceReview
修改 Voice Settings
记录 VoiceUsage
```

---

# 24. 成本与限流

TTS 调用要进入 ModelCallLog 或新增 VoiceCallLog。

可以先复用 ModelCallLog：

```text
purpose = tts
provider = minimax / elevenlabs / local
model = xxx
```

限流：

```env
VOICE_GENERATION_MAX_PER_DAY_OWNER=200
VOICE_GENERATION_MAX_PER_DAY_ADMIN=100
VOICE_GENERATION_MAX_PER_DAY_TESTER=20
VOICE_GENERATION_MAX_TEXT_CHARS=3000
VOICE_CHAT_TTS_MAX_CHARS=500
```

---

# 25. 环境变量

`.env.example` 增加：

```env
# Voice System
VOICE_ENABLED=true
VOICE_ADMIN_ENABLED=true

# TTS
TTS_ENABLED=true
TTS_DEFAULT_PROVIDER="custom"
TTS_DEFAULT_VOICE_PROFILE_ID=""
TTS_OUTPUT_FORMAT="mp3"
TTS_OUTPUT_SAMPLE_RATE=24000
TTS_MAX_TEXT_CHARS=3000

# Provider Keys
MINIMAX_TTS_API_KEY=""
MINIMAX_TTS_GROUP_ID=""
ELEVENLABS_API_KEY=""
AZURE_SPEECH_KEY=""
AZURE_SPEECH_REGION=""

# Voice Chat
VOICE_CHAT_TTS_ENABLED=true
VOICE_PUBLIC_CHAT_TTS_ENABLED=false
VOICE_CHAT_TTS_MAX_CHARS=500
VOICE_CHAT_TTS_AUTO_GENERATE=false

# Voice Draft
VOICE_DRAFT_ENABLED=true
VOICE_REVIEW_REQUIRED=true
VOICE_APPROVAL_REQUIRED=true

# Voice Safety
VOICE_DISALLOW_UNKNOWN_SAMPLE_PUBLIC_USE=true
VOICE_REQUIRE_RIGHTS_STATUS_FOR_PUBLIC=true
VOICE_BLOCK_HIGH_RISK_TEXT=true

# Realtime Placeholder
REALTIME_VOICE_ENABLED=false
REALTIME_VOICE_PROVIDER=""
REALTIME_VOICE_MAX_SESSION_MINUTES=10

# Limits
VOICE_GENERATION_MAX_PER_DAY_OWNER=200
VOICE_GENERATION_MAX_PER_DAY_ADMIN=100
VOICE_GENERATION_MAX_PER_DAY_TESTER=20
```

---

# 26. 推荐目录结构

```text
src/
├── voice/
│   ├── voice.types.ts
│   ├── voice-profile.service.ts
│   ├── voice-sample.service.ts
│   ├── voice-generation.service.ts
│   ├── voice-draft.service.ts
│   ├── voice-review.service.ts
│   ├── voice-usage.service.ts
│   ├── voice-settings.service.ts
│   ├── voice-permissions.ts
│   ├── voice-prompts.ts
│   └── providers/
│       ├── tts-provider.ts
│       ├── minimax-tts.provider.ts
│       ├── elevenlabs-tts.provider.ts
│       ├── local-tts.provider.ts
│       └── custom-tts.provider.ts
│
├── routes/
│   └── voice.route.ts
│
├── scripts/
│   ├── seed-voice-profiles.ts
│   ├── inspect-voice-profiles.ts
│   ├── generate-voice-sample.ts
│   └── cleanup-failed-voice-jobs.ts
│
└── docs/
    └── voice-realtime-v1.2.md
```

前端：

```text
web/src/admin/voice/
├── VoiceOverviewPage.tsx
├── VoiceProfilesPage.tsx
├── VoiceProfileDetailPage.tsx
├── VoiceSamplesPage.tsx
├── VoiceGeneratePage.tsx
├── VoiceDraftsPage.tsx
├── VoiceDraftDetailPage.tsx
├── VoiceReviewsPage.tsx
├── VoiceSettingsPage.tsx
└── components/
    ├── AudioPlayer.tsx
    ├── VoiceProfileSelector.tsx
    ├── VoiceGenerationForm.tsx
    ├── VoiceReviewPanel.tsx
    └── VoiceSampleUploader.tsx
```

---

# 27. 开发步骤

## Step 1：数据库模型

新增：

```text
VoiceProfile
VoiceSample
VoiceGenerationJob
VoiceDraft
VoiceReview
VoiceUsage
```

执行 Prisma migration。

---

## Step 2：TtsProvider 抽象

先实现：

```text
custom-tts.provider.ts
local-tts.provider.ts
```

再按实际使用接入 Minimax / ElevenLabs / Azure 等 provider。

重点是业务代码只依赖 `TtsProvider` 接口。

---

## Step 3：VoiceProfileService

支持创建、编辑、设置默认音色。

---

## Step 4：VoiceSampleService

支持上传音频样本到 Asset Memory，并创建 VoiceSample。

---

## Step 5：VoiceGenerationService

实现 TTS 生成：

```text
文本 → provider → 音频 → Asset → VoiceGenerationJob → VoiceDraft
```

---

## Step 6：VoiceDraftService

支持语音草稿管理、重生成、提交审核、批准、拒绝。

---

## Step 7：VoiceReviewService

先做人工审核为主，系统做基础文本边界检查。

---

## Step 8：Voice Routes

新增 `/v1/admin/voice/*` 接口。

---

## Step 9：Web Admin 页面

实现：

```text
/admin/voice
/admin/voice/profiles
/admin/voice/samples
/admin/voice/generate
/admin/voice/drafts
/admin/voice/reviews
/admin/voice/settings
```

---

## Step 10：接入 ContentDraft

在内容草稿详情页增加：

```text
[生成语音]
```

---

## Step 11：接入 Web Chat

给 assistant message 增加可选：

```text
[生成语音]
[播放]
```

默认 public_user 关闭。

---

## Step 12：AuditLog / Cost / Rate Limit

所有 TTS 相关操作接入。

---

# 28. MVP 范围

v1.2 MVP 必须做：

```text
1. VoiceProfile
2. VoiceSample
3. TtsProvider 抽象
4. 生成语音
5. 保存音频到 Asset Memory
6. VoiceDraft
7. VoiceReview
8. Admin 语音页面
9. ContentDraft 一键生成语音
10. Web Chat 手动生成语音播放
```

可以延后：

```text
1. 实时语音对话
2. 自动口型同步
3. 自动视频生成
4. AI 自动听音频评分
5. 多 provider 自动 AB 测试
6. 自动发布音频内容
```

---

# 29. 验收标准

v1.2 完成后应满足：

```text
1. Admin 中有 Voice 页面
2. 可以创建 VoiceProfile
3. 可以上传 VoiceSample
4. VoiceSample 会关联 Asset
5. 可以选择 VoiceProfile 生成语音
6. TTS 输出会保存为 audio Asset
7. VoiceGenerationJob 有状态记录
8. 可以创建 VoiceDraft
9. 可以播放 VoiceDraft 音频
10. 可以对 VoiceDraft 做审核
11. 可以批准/拒绝 VoiceDraft
12. ContentDraft 可以生成语音
13. DreamDiary 可以生成朗读音频
14. Web Chat 可以手动生成语音播放
15. public_user 默认不能无限生成语音
16. TTS 调用有 ModelCallLog / 成本记录
17. 关键操作写 AuditLog
18. unknown / reference_only 样本不能用于公开音色
19. 不存在自动发布音频功能
20. v0.1-v1.1 原功能不受影响
```

---

# 30. 推荐测试场景

## 30.1 创建默认音色

操作：

```text
创建 VoiceProfile：陆思源 v1 少年自然音
设置为默认
```

期望：

```text
VoiceProfile.status = active
isDefault = true
其他 profile isDefault = false
```

---

## 30.2 上传音色样本

操作：

```text
上传一段试音 wav/mp3
source = commissioned_voice_actor
rightsStatus = commissioned
canUsePublicly = true
```

期望：

```text
Asset 创建
VoiceSample 创建
可在 Admin 播放
```

---

## 30.3 生成语音

输入：

```text
大家好，我是陆思源。不是普通真人，而是一个原创 AI 数字人。
```

期望：

```text
VoiceGenerationJob success
audio Asset 创建
VoiceDraft 创建
音频可播放
```

---

## 30.4 内容草稿转口播

操作：

```text
打开 ContentDraft
点击生成语音
```

期望：

```text
VoiceDraft.sourceType = content_draft
sourceId = contentDraft.id
```

---

## 30.5 审核高风险文本

文本包含：

```text
我是一个真实存在的17岁大学生。
```

期望：

```text
VoiceReview blocked 或 needs_text_edit
不能 approve
```

---

# 31. 给 Codex 的开发指令

```text
请在现有 lusiyuan-core v1.1 项目基础上实现 task_12 / v1.2：Voice & Realtime Interaction。

当前项目已有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- React + Vite Admin Console
- User role / PermissionGuard
- AuditLog
- ModelCallLog
- AssetService / Asset Memory
- Content Ops Pipeline
- Dream Cycle
- DraftService
- Web Chat

v1.2 目标：
新增声音系统。支持音色档案、音色样本、TTS Provider 抽象、语音生成、语音草稿、音频审核、音频资产管理、ContentDraft 生成口播、Web Chat 手动生成语音播放。不要实现自动发布、实时直播、口型同步、自动私信语音回复。

请完成以下任务：

1. 更新 .env.example，增加：
   - VOICE_ENABLED=true
   - VOICE_ADMIN_ENABLED=true
   - TTS_ENABLED=true
   - TTS_DEFAULT_PROVIDER="custom"
   - TTS_DEFAULT_VOICE_PROFILE_ID=""
   - TTS_OUTPUT_FORMAT="mp3"
   - TTS_OUTPUT_SAMPLE_RATE=24000
   - TTS_MAX_TEXT_CHARS=3000
   - MINIMAX_TTS_API_KEY=""
   - MINIMAX_TTS_GROUP_ID=""
   - ELEVENLABS_API_KEY=""
   - AZURE_SPEECH_KEY=""
   - AZURE_SPEECH_REGION=""
   - VOICE_CHAT_TTS_ENABLED=true
   - VOICE_PUBLIC_CHAT_TTS_ENABLED=false
   - VOICE_CHAT_TTS_MAX_CHARS=500
   - VOICE_CHAT_TTS_AUTO_GENERATE=false
   - VOICE_DRAFT_ENABLED=true
   - VOICE_REVIEW_REQUIRED=true
   - VOICE_APPROVAL_REQUIRED=true
   - VOICE_DISALLOW_UNKNOWN_SAMPLE_PUBLIC_USE=true
   - VOICE_REQUIRE_RIGHTS_STATUS_FOR_PUBLIC=true
   - VOICE_BLOCK_HIGH_RISK_TEXT=true
   - REALTIME_VOICE_ENABLED=false
   - REALTIME_VOICE_PROVIDER=""
   - REALTIME_VOICE_MAX_SESSION_MINUTES=10
   - VOICE_GENERATION_MAX_PER_DAY_OWNER=200
   - VOICE_GENERATION_MAX_PER_DAY_ADMIN=100
   - VOICE_GENERATION_MAX_PER_DAY_TESTER=20

2. 新增 Prisma models：
   - VoiceProfile
   - VoiceSample
   - VoiceGenerationJob
   - VoiceDraft
   - VoiceReview
   - VoiceUsage

3. 实现 src/voice/：
   - voice.types.ts
   - voice-profile.service.ts
   - voice-sample.service.ts
   - voice-generation.service.ts
   - voice-draft.service.ts
   - voice-review.service.ts
   - voice-usage.service.ts
   - voice-settings.service.ts
   - voice-permissions.ts
   - voice-prompts.ts

4. 实现 src/voice/providers/：
   - tts-provider.ts
   - custom-tts.provider.ts
   - local-tts.provider.ts
   - minimax-tts.provider.ts
   - elevenlabs-tts.provider.ts
   - azure-tts.provider.ts

5. TtsProvider 接口必须包含：
   - synthesize(input)
   - getVoices?()
   - health?()

6. VoiceProfileService：
   - createProfile()
   - updateProfile()
   - listProfiles()
   - getProfile()
   - setDefaultProfile()
   - archiveProfile()

7. VoiceSampleService：
   - uploadSample()
   - createSampleFromAsset()
   - updateSampleReview()
   - listSamples()
   - getSample()
   - archiveSample()
   上传样本必须进入 AssetService，不能直接把音频存数据库。

8. VoiceGenerationService：
   - generateVoice()
   - retryGeneration()
   - getJob()
   - listJobs()
   生成流程：
   - 创建 VoiceGenerationJob
   - 调用 TtsProvider
   - 保存音频为 Asset
   - 更新 job 状态
   - 可选创建 VoiceDraft
   - 写 ModelCallLog / AuditLog

9. VoiceDraftService：
   - createDraft()
   - createDraftFromContentDraft()
   - createDraftFromDreamDiary()
   - updateDraft()
   - regenerateAudio()
   - submitReview()
   - approveDraft()
   - rejectDraft()
   - archiveDraft()

10. VoiceReviewService：
    - runReview()
    - createManualReview()
    - listReviews()
    - getReview()
    审核必须检查：
    - 文本是否把陆思源写成真人
    - 是否编造现实学校/住址/身份
    - 是否暗示真实身份证明
    - 是否包含隐私
    - 是否适合公开使用
    - 人工评分字段包括 audioQuality、naturalness、youthfulness、identityFit、emotionFit

11. VoiceUsageService：
    - recordUsage()
    - listUsageByDraft()
    - listUsageByAsset()

12. 新增 routes/voice.route.ts：
    - GET /v1/admin/voice/overview
    - GET /v1/admin/voice/profiles
    - POST /v1/admin/voice/profiles
    - GET /v1/admin/voice/profiles/:id
    - PATCH /v1/admin/voice/profiles/:id
    - POST /v1/admin/voice/profiles/:id/set-default
    - POST /v1/admin/voice/profiles/:id/archive
    - GET /v1/admin/voice/samples
    - POST /v1/admin/voice/samples/upload
    - POST /v1/admin/voice/samples/from-asset
    - GET /v1/admin/voice/samples/:id
    - PATCH /v1/admin/voice/samples/:id
    - POST /v1/admin/voice/samples/:id/archive
    - POST /v1/admin/voice/generate
    - GET /v1/admin/voice/generation-jobs
    - GET /v1/admin/voice/generation-jobs/:id
    - POST /v1/admin/voice/generation-jobs/:id/retry
    - GET /v1/admin/voice/drafts
    - POST /v1/admin/voice/drafts
    - GET /v1/admin/voice/drafts/:id
    - PATCH /v1/admin/voice/drafts/:id
    - POST /v1/admin/voice/drafts/:id/regenerate
    - POST /v1/admin/voice/drafts/:id/submit-review
    - POST /v1/admin/voice/drafts/:id/approve
    - POST /v1/admin/voice/drafts/:id/reject
    - POST /v1/admin/voice/drafts/:id/archive
    - GET /v1/admin/voice/reviews
    - GET /v1/admin/voice/reviews/:id
    - POST /v1/admin/voice/drafts/:id/run-review
    - POST /v1/admin/voice/drafts/:id/manual-review
    - POST /v1/admin/voice/drafts/:id/usage
    - GET /v1/admin/voice/drafts/:id/usage
    - GET /v1/admin/voice/settings
    - PATCH /v1/admin/voice/settings

13. 所有 /v1/admin/voice/* 路由必须 owner/admin only。
    set-default 和 settings 建议 owner only。

14. 接入 ContentDraft：
    - 在 ContentDraft 详情页增加“生成语音”
    - 调用 VoiceDraftService.createDraftFromContentDraft()
    - 生成结果关联 sourceType=content_draft

15. 接入 DreamDiary：
    - 支持从 DreamDiaryEntry 生成朗读音频
    - sourceType=dream_diary
    - 不能把 DreamDiary 当作事实，只作为日记朗读

16. 接入 Web Chat：
    - 给 assistant message 增加“生成语音”按钮
    - 默认 public_user 不可用
    - 生成后显示 audio player
    - 不要默认每条消息自动生成语音

17. 前端 Admin 新增页面：
    - /admin/voice
    - /admin/voice/profiles
    - /admin/voice/profiles/:id
    - /admin/voice/samples
    - /admin/voice/generate
    - /admin/voice/drafts
    - /admin/voice/drafts/:id
    - /admin/voice/reviews
    - /admin/voice/settings

18. 前端组件：
    - AudioPlayer
    - VoiceProfileSelector
    - VoiceGenerationForm
    - VoiceReviewPanel
    - VoiceSampleUploader

19. 接入 AuditLog：
    - 创建/修改 VoiceProfile
    - 设置默认 VoiceProfile
    - 上传 VoiceSample
    - 修改样本授权状态
    - 生成语音
    - 重试生成
    - 创建 VoiceDraft
    - 批准/拒绝 VoiceDraft
    - 创建 VoiceReview
    - 修改 Voice Settings
    - 记录 VoiceUsage

20. 接入成本与限流：
    - TTS 调用写 ModelCallLog，purpose=tts
    - 根据角色限制每日生成次数
    - 限制最大文本长度

21. 新增 scripts：
    - scripts/seed-voice-profiles.ts
    - scripts/inspect-voice-profiles.ts
    - scripts/generate-voice-sample.ts
    - scripts/cleanup-failed-voice-jobs.ts

22. 更新 package.json scripts：
    - "voice:seed-profiles": "tsx scripts/seed-voice-profiles.ts"
    - "voice:inspect": "tsx scripts/inspect-voice-profiles.ts"
    - "voice:sample": "tsx scripts/generate-voice-sample.ts"
    - "voice:cleanup-failed": "tsx scripts/cleanup-failed-voice-jobs.ts"

23. 新增 docs/voice-realtime-v1.2.md：
    - 说明 v1.2 定位
    - 说明 VoiceProfile / VoiceSample / VoiceDraft
    - 说明 TtsProvider 抽象
    - 说明和 Asset Memory / Content Ops / Dream / Web Chat 的关系
    - 说明 v1.2 不做实时直播和自动发布
    - 说明音色授权和安全边界

限制：
- 不要实现自动发布
- 不要实现自动语音私信回复
- 不要实现实时直播语音
- 不要实现口型同步
- 不要把音频二进制存进 PostgreSQL
- 不要让 unknown / reference_only 样本用于公开音色
- 不要默认允许 public_user 无限生成语音
- 不要绕过 VoiceReview 批准高风险音频

验收：
- Admin 有 Voice 页面
- 可以创建 VoiceProfile
- 可以上传 VoiceSample
- VoiceSample 关联 Asset
- 可以生成 TTS 音频
- 音频保存为 Asset
- VoiceGenerationJob 正常记录状态
- 可以创建 VoiceDraft
- 可以播放 VoiceDraft 音频
- 可以审核 VoiceDraft
- 可以批准/拒绝 VoiceDraft
- ContentDraft 可生成口播
- DreamDiary 可生成朗读
- Web Chat 可手动生成语音播放
- TTS 调用有成本记录
- 关键操作写 AuditLog
- public_user 默认不能滥用语音
- 不存在自动发布音频功能
- 原有 v0.1-v1.1 功能不受影响
```

---

# 32. v1.2 最终效果

v1.2 做完后，陆思源会从：

```text
能写内容、能管理素材、能聊天的数字人
```

升级成：

```text
开始拥有稳定声音资产和可控语音输出的数字人
```

他可以：

```text
1. 给聊天回复生成语音
2. 给梦境日记生成朗读
3. 给小红书/B站脚本生成口播
4. 管理音色样本
5. 审核音频是否符合陆思源
6. 把所有音频沉淀进 Asset Memory
```

但他仍然不会：

```text
1. 自动开麦
2. 自动直播
3. 自动发语音私信
4. 自动发布视频
5. 随便换音色
```

这一步很重要，因为声音会强烈塑造陆思源的“真实感”。
v1.2 的重点不是追求实时，而是先让他的声音**稳定、可控、可审核、可复用**。
