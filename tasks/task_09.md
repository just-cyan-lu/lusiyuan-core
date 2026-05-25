下面是 **task_09 / v0.9：Media & Asset Memory 技术开发文档**。
这一版的核心目标是：**让陆思源不只是一个会聊天、有记忆的数字人，而是开始拥有自己的图片、音频、视频、设定、训练素材和内容资产库。**

---

# task_09：Media & Asset Memory

# 陆思源 Core API v0.9：媒体与数字人资产记忆系统

## 1. v0.9 目标

前面版本已经规划到：

```text
v0.1：Lusiyuan Core API
v0.2：Telegram + Weixin 接入
v0.3：Web Chat 网页入口
v0.4：SiliconFlow Qwen/Qwen3-Embedding-4B + pgvector 记忆检索
v0.5：Tool & Action Layer
v0.6：Letta Creator Assistant
v0.7：Letta Reflection Agent
v0.8：OpenClaw Action Gateway
```

v0.9 的目标是新增：

```text
Media & Asset Memory
```

也就是：

```text
陆思源的媒体资产库 / 素材记忆库 / 数字人资产管理系统
```

v0.9 要管理的不只是文件，而是陆思源作为数字人的长期资产：

```text
1. 陆思源基准头像
2. 正脸图
3. 侧脸图
4. 不同表情图
5. 不同衣服图
6. LoRA 训练候选图
7. 小红书封面图
8. 视频截图
9. Live 图素材
10. 音色样本
11. 录音稿
12. TTS 输出音频
13. 视频脚本
14. 角色设定参考图
15. 图像相似度评估记录
16. 哪些图“像陆思源”、哪些图“不像陆思源”
```

v0.9 的一句话目标：

```text
让陆思源拥有一个可检索、可标注、可复盘、可用于训练和内容运营的资产记忆系统。
```

---

# 2. 为什么 v0.9 要做 Asset Memory？

之前的 Memory 系统主要保存文本：

```text
用户偏好
技术决策
项目上下文
关系记忆
人格反馈
成长日志
```

但陆思源是数字人，不是纯文本 bot。

你已经在实际项目里产生了大量视觉和声音相关材料：

```text
1. 生成的陆思源照片
2. 人脸相似度分析
3. “哪张最像陆思源”的排序
4. 图像问题描述：脸胖、额头高、头顶透视不对
5. 未来 LoRA 训练图
6. 音色试音文案
7. 录音稿
8. 视频脚本
9. 小红书/B站内容素材
```

如果这些只散落在本地文件夹、聊天记录、相册里，后面会很难管理。

v0.9 要解决的问题是：

```text
1. 哪些图是陆思源的基准图？
2. 哪些图适合 LoRA？
3. 哪些图虽然好看但不像陆思源？
4. 哪些图有脸型问题？
5. 哪些图适合小红书封面？
6. 哪些图适合做视频素材？
7. 哪些音频是原始录音？
8. 哪些音频是 TTS 生成？
9. 哪些素材已经用过？
10. 哪些素材可以复用？
```

v0.9 做完后，陆思源系统不再只是：

```text
聊天系统
```

而是开始变成：

```text
数字人生产与运营系统
```

---

# 3. v0.9 总体架构

v0.8 之后：

```text
Lusiyuan Core API
├── ChatService
├── MemoryRetrievalService
├── Tool & Action Layer
├── Letta Creator Assistant
├── Letta Reflection Agent
├── OpenClaw Action Gateway
└── DraftService
```

v0.9 新增：

```text
Lusiyuan Core API
└── Asset Memory
    ├── AssetService
    ├── AssetStorageService
    ├── AssetMetadataService
    ├── AssetReviewService
    ├── AssetEmbeddingService
    ├── AssetSearchService
    ├── AssetUsageService
    └── AssetCollectionService
```

完整结构：

```text
图片 / 音频 / 视频 / 文档
↓
上传到对象存储 / 本地存储
↓
Asset 表记录元数据
↓
AssetReview 记录人工评估
↓
AssetEmbedding 记录多模态向量
↓
AssetSearch 支持检索
↓
Draft / Content Ops / LoRA Training / Web Admin 使用这些资产
```

---

# 4. v0.9 技术选型

## 4.1 文件存储

推荐支持两种模式：

```text
本地开发：Local filesystem
正式部署：S3-compatible object storage
```

可选正式存储：

```text
Cloudflare R2
AWS S3
MinIO
阿里云 OSS
腾讯云 COS
```

如果你希望海外部署、个人项目成本低、以后迁移方便，Cloudflare R2 是一个不错选项。Cloudflare 官方文档说明 R2 是 S3-compatible object storage，并且官方产品说明强调 R2 支持 S3 兼容 API，便于使用现有 S3 工具和库。([Cloudflare Docs][1])

v0.9 不要把图片、音频、视频直接存进 PostgreSQL。
数据库只存：

```text
文件 URL
storageKey
metadata
hash
review
embedding
usage
```

真实文件放：

```text
对象存储 / 本地文件系统
```

---

## 4.2 元数据数据库

继续使用：

```text
PostgreSQL + Prisma
```

原因：

```text
1. 项目主库已经是 PostgreSQL
2. 资产元数据是结构化数据
3. 方便和 Draft / Memory / OpenClaw / Reflection 关联
4. 方便做审核、标注、使用记录
```

---

## 4.3 文本资产 embedding

文本类资产仍然可以复用 v0.4 的：

```text
SiliconFlow Qwen/Qwen3-Embedding-4B
```

适合：

```text
录音稿
视频脚本
小红书文案
内容草稿
设定文档
图像描述文本
```

---

## 4.4 多模态资产 embedding

图片、截图、视频类资产未来可以接：

```text
Qwen/Qwen3-VL-Embedding-8B
```

Qwen3-VL-Embedding-8B 是多模态 embedding 模型，模型卡说明它支持文本、图片、截图、视频以及混合多模态输入，支持 30+ 语言，32k 上下文，最高 4096 维并支持 64 到 4096 的自定义输出维度。([Hugging Face][2])

硅基流动的 Embeddings API 文档也说明，它支持 Classic Embedding 和 VL Embedding 两种请求格式；VL Embedding 支持混合文本/图片输入。英文文档也明确写到支持 text、image URL/base64 和 mixed lists。([SiliconFlow][3])

但是 v0.9 我建议分两步：

```text
v0.9.0：
先做 Asset 数据库、上传、标注、人工 review、使用记录。

v0.9.1：
再接 Qwen/Qwen3-VL-Embedding-8B 做图片/视频检索。
```

原因：

```text
1. 资产管理本身已经很有价值
2. 多模态 embedding 会增加实现复杂度
3. 你现在最急的是把素材沉淀下来
4. embedding 可以后续 backfill
```

---

## 4.5 向量索引

v0.9 默认继续使用：

```text
PostgreSQL + pgvector
```

但资产向量要和 Memory 向量分开：

```text
MemoryEmbedding：文本长期记忆向量
AssetEmbedding：媒体资产向量
```

未来如果资产数量变大，可以迁移到 Qdrant。Qdrant 文档说明其检索支持 payload filtering，可以在搜索/检索时对 payload 或 point id 加条件；这很适合未来按 asset type、tag、status、人物相似度、LoRA suitability 等字段过滤。([Qdrant][4])

Qdrant 的核心定位也是向量相似度搜索和带 payload 的点管理，适合后续大规模向量检索。([GitHub][5])

---

# 5. v0.9 不做什么

v0.9 不做：

```text
1. 不训练 LoRA
2. 不自动生图
3. 不自动发小红书
4. 不自动发布视频
5. 不做完整内容运营系统
6. 不做实时语音聊天
7. 不做复杂版权系统
8. 不做多人团队协作
9. 不让 AI 自动判断最终“像不像陆思源”
10. 不让多模态 embedding 结果覆盖人工 review
```

v0.9 只做：

```text
资产管理、标注、评估、检索、使用记录。
```

---

# 6. 核心概念

## 6.1 Asset

Asset 是一个媒体资产。

可以是：

```text
image
audio
video
document
text
prompt
dataset
```

例如：

```text
一张陆思源正脸图
一段试音音频
一个视频脚本
一组 LoRA 训练候选图
一张小红书封面
```

---

## 6.2 AssetVersion

一个资产可能有多个版本。

比如：

```text
原图
裁剪版
去水印重绘版
放大版
修脸版
用于小红书封面的版本
用于 LoRA 训练的版本
```

所以需要：

```text
Asset = 资产本体
AssetVersion = 某个具体文件版本
```

---

## 6.3 AssetReview

AssetReview 是人工或 AI 对资产的评价。

比如一张图的 review：

```text
脸型：偏胖
下颚线：不像基准图
眼睛：相似
嘴唇：偏厚
头顶透视：有问题
少年感：中等
LoRA 适合度：不推荐
总体相似度：6.5/10
```

这非常重要，因为它能沉淀你之前做过的大量“人类视觉分析”。

---

## 6.4 AssetCollection

AssetCollection 是一组资产。

例如：

```text
陆思源基准图集
LoRA 第一批训练候选图
小红书封面候选图
夏季浅色衣服图集
侧脸参考图集
音色试音样本
v1.0 宣传素材包
```

---

## 6.5 AssetUsage

AssetUsage 记录资产被用在哪里。

例如：

```text
用于 LoRA 训练
用于小红书封面
用于 B站视频
用于网页头像
用于 Telegram 头像
用于测试相似度
```

这能避免素材重复使用、混乱使用。

---

## 6.6 AssetEmbedding

AssetEmbedding 是资产的向量索引。

它不是资产本体。
和 v0.4 的 MemoryEmbedding 一样：

```text
Asset 是本体
AssetEmbedding 是可重建索引
```

---

# 7. 推荐目录结构

新增：

```text
src/
├── assets/
│   ├── asset.service.ts
│   ├── asset.types.ts
│   ├── asset-storage.service.ts
│   ├── asset-metadata.service.ts
│   ├── asset-review.service.ts
│   ├── asset-search.service.ts
│   ├── asset-usage.service.ts
│   ├── asset-collection.service.ts
│   ├── asset-permissions.ts
│   ├── asset-hash.ts
│   └── asset-url.ts
│
├── asset-embeddings/
│   ├── asset-embedding.service.ts
│   ├── asset-embedding-provider.ts
│   ├── siliconflow-vl-embedding-provider.ts
│   ├── asset-embedding-text.ts
│   └── pgvector-asset-index.ts
│
├── storage/
│   ├── storage-provider.ts
│   ├── local-storage-provider.ts
│   ├── s3-storage-provider.ts
│   └── storage-config.ts
│
├── routes/
│   ├── assets.route.ts
│   ├── asset-reviews.route.ts
│   ├── asset-collections.route.ts
│   └── asset-search.route.ts
│
├── scripts/
│   ├── backfill-asset-metadata.ts
│   ├── backfill-asset-embeddings.ts
│   ├── inspect-assets.ts
│   ├── import-local-assets.ts
│   └── export-lora-candidates.ts
│
└── docs/
    └── media-asset-memory-v0.9.md
```

---

# 8. 环境变量设计

`.env.example` 增加：

```env
# Asset System
ASSETS_ENABLED=true
ASSET_UPLOAD_ENABLED=true
ASSET_MAX_FILE_SIZE_MB=100
ASSET_ALLOWED_TYPES="image,audio,video,document,text"
ASSET_PUBLIC_READ=false

# Storage
STORAGE_PROVIDER="local"
LOCAL_STORAGE_DIR="./data/assets"

# S3 / R2 compatible storage
S3_ENDPOINT=""
S3_REGION="auto"
S3_BUCKET=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=""

# Asset Embedding
ASSET_EMBEDDING_ENABLED=false
ASSET_EMBEDDING_PROVIDER="siliconflow"
ASSET_EMBEDDING_MODEL="Qwen/Qwen3-VL-Embedding-8B"
ASSET_EMBEDDING_DIMENSIONS=1024

# Asset Search
ASSET_SEARCH_ENABLED=true
ASSET_SEARCH_TOP_K=20
ASSET_SEARCH_REQUIRE_REVIEW_FILTER=false

# Review
ASSET_REVIEW_ENABLED=true
ASSET_AI_REVIEW_ENABLED=false
ASSET_REVIEW_OWNER_ONLY=true

# Collections
ASSET_COLLECTIONS_ENABLED=true

# LoRA Dataset Export
LORA_EXPORT_ENABLED=true
LORA_MIN_SIMILARITY_SCORE=7.5
LORA_REQUIRE_APPROVED=true
```

说明：

```text
STORAGE_PROVIDER=local：
本地开发使用。

STORAGE_PROVIDER=s3：
正式部署使用 S3-compatible storage。

ASSET_EMBEDDING_ENABLED=false：
v0.9.0 先关闭，多模态 embedding 在 v0.9.1 开启。

ASSET_EMBEDDING_MODEL=Qwen/Qwen3-VL-Embedding-8B：
未来图片/视频检索使用。

ASSET_EMBEDDING_DIMENSIONS=1024：
先用 1024 维，避免 pgvector 索引维度压力。
```

---

# 9. 存储设计

## 9.1 为什么不要把文件存数据库

不要把图片、音频、视频二进制文件直接存进 PostgreSQL。

原因：

```text
1. 数据库会变大
2. 备份变慢
3. 查询变重
4. 文件分发不方便
5. CDN / 对象存储更适合文件
```

PostgreSQL 只保存：

```text
asset.id
fileName
mimeType
size
storageKey
fileUrl
hash
metadata
```

---

## 9.2 LocalStorageProvider

本地开发：

```text
./data/assets/
```

目录结构：

```text
data/assets/
├── images/
├── audio/
├── video/
├── documents/
└── temp/
```

storageKey 示例：

```text
images/2026/05/asset_cuid_original.png
audio/2026/05/asset_cuid_sample.wav
```

---

## 9.3 S3StorageProvider

正式部署用 S3-compatible API。

Cloudflare R2 可以作为候选，因为 R2 官方说明其 S3-compatible API 可以让开发者使用 S3 工具、库和扩展，迁移和接入成本较低。([Cloudflare][6])

推荐用：

```text
@aws-sdk/client-s3
```

v0.9 的 `S3StorageProvider` 要只做：

```text
putObject
getSignedUrl
deleteObject
headObject
```

不要直接把公开 URL 写死。
如果 `ASSET_PUBLIC_READ=false`，应该使用 signed URL。

---

# 10. 数据库设计

## 10.1 Asset

```prisma
model Asset {
  id              String   @id @default(cuid())

  type            String
  status          String   @default("active")

  title           String?
  description     String?
  source          String?
  sourceUrl       String?

  canonicalVersionId String?

  tags            Json?
  entities        Json?
  metadata        Json?

  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  versions        AssetVersion[]
  reviews         AssetReview[]
  embeddings      AssetEmbedding[]
  usages          AssetUsage[]
  collectionItems AssetCollectionItem[]

  @@index([type])
  @@index([status])
  @@index([source])
  @@index([createdAt])
}
```

`type`：

```text
image
audio
video
document
text
prompt
dataset
```

`status`：

```text
active
archived
rejected
deleted
```

---

## 10.2 AssetVersion

```prisma
model AssetVersion {
  id            String   @id @default(cuid())

  assetId       String
  versionType   String   @default("original")

  fileName      String
  mimeType      String
  sizeBytes     Int
  width         Int?
  height        Int?
  durationMs    Int?

  storageProvider String
  storageKey      String
  fileUrl         String?
  fileHash        String

  metadata      Json?

  createdAt     DateTime @default(now())

  asset         Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@index([assetId])
  @@index([versionType])
  @@index([fileHash])
  @@index([createdAt])
}
```

`versionType`：

```text
original
edited
upscaled
cropped
watermark_removed_redraw
thumbnail
preview
audio_cleaned
tts_generated
```

---

## 10.3 AssetReview

```prisma
model AssetReview {
  id              String   @id @default(cuid())

  assetId          String
  versionId        String?

  reviewerType     String
  reviewerId       String?

  overallScore     Float?
  identityScore    Float?
  faceSimilarity   Float?
  styleConsistency Float?
  loraSuitability  Float?
  coverSuitability Float?
  videoSuitability Float?

  issues           Json?
  strengths        Json?
  notes            String?

  decision         String?
  status           String   @default("active")

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  asset            Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@index([assetId])
  @@index([reviewerType])
  @@index([decision])
  @@index([createdAt])
}
```

`reviewerType`：

```text
human
ai
system
```

`decision`：

```text
approved
rejected
needs_edit
lora_candidate
cover_candidate
reference_candidate
archive
```

`issues` 示例：

```json
[
  "face_too_wide",
  "jawline_not_match",
  "forehead_too_high",
  "hair_too_long",
  "mouth_too_thick",
  "eyes_not_match",
  "lighting_inconsistent",
  "watermark",
  "not_like_lusiyuan"
]
```

---

## 10.4 AssetEmbedding

```prisma
model AssetEmbedding {
  id          String   @id @default(cuid())

  assetId     String
  versionId   String?

  provider    String
  model       String
  dimensions  Int
  modality    String
  contentHash String

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  asset       Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([assetId, versionId, provider, model, dimensions])
  @@index([assetId])
  @@index([provider, model, dimensions])
  @@index([modality])
  @@index([contentHash])
}
```

实际 vector 字段用 raw SQL 添加：

```sql
ALTER TABLE "AssetEmbedding"
ADD COLUMN "embedding" vector(1024);
```

`modality`：

```text
text
image
audio
video
mixed
```

v0.9.0 可以先建表但不启用 embedding。
v0.9.1 开启。

---

## 10.5 AssetCollection

```prisma
model AssetCollection {
  id          String   @id @default(cuid())

  name        String
  description String?
  type        String
  status      String   @default("active")

  metadata    Json?

  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       AssetCollectionItem[]

  @@index([type])
  @@index([status])
  @@index([createdAt])
}
```

`type`：

```text
reference_set
lora_dataset
cover_candidates
video_assets
voice_samples
xiaohongshu_assets
bilibili_assets
```

---

## 10.6 AssetCollectionItem

```prisma
model AssetCollectionItem {
  id            String   @id @default(cuid())

  collectionId  String
  assetId       String
  versionId     String?

  orderIndex    Int?
  role          String?
  notes         String?

  createdAt     DateTime @default(now())

  collection    AssetCollection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  asset         Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@index([collectionId])
  @@index([assetId])
}
```

`role`：

```text
base_reference
side_reference
expression_reference
training_positive
training_negative
cover_main
video_frame
voice_reference
```

---

## 10.7 AssetUsage

```prisma
model AssetUsage {
  id           String   @id @default(cuid())

  assetId      String
  versionId    String?

  usageType    String
  target       String?
  targetId     String?

  notes        String?
  metadata     Json?

  createdAt    DateTime @default(now())

  asset        Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@index([assetId])
  @@index([usageType])
  @@index([target])
  @@index([createdAt])
}
```

`usageType`：

```text
lora_training
xiaohongshu_post
bilibili_video
website_avatar
telegram_avatar
prompt_reference
video_cover
voice_clone_sample
tts_output
```

---

# 11. AssetService 设计

```ts
export class AssetService {
  async createAsset(input: CreateAssetInput): Promise<Asset>;

  async uploadAsset(input: UploadAssetInput): Promise<Asset>;

  async getAsset(assetId: string): Promise<AssetDetail>;

  async listAssets(input: ListAssetsInput): Promise<AssetListResult>;

  async updateAsset(assetId: string, input: UpdateAssetInput): Promise<Asset>;

  async archiveAsset(assetId: string): Promise<void>;

  async deleteAsset(assetId: string): Promise<void>;
}
```

---

## 11.1 UploadAssetInput

```ts
export interface UploadAssetInput {
  type: "image" | "audio" | "video" | "document" | "text" | "prompt";
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  title?: string;
  description?: string;
  source?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}
```

---

## 11.2 AssetDetail

```ts
export interface AssetDetail {
  asset: Asset;
  versions: AssetVersion[];
  reviews: AssetReview[];
  collections: AssetCollection[];
  usages: AssetUsage[];
  embeddings?: AssetEmbedding[];
}
```

---

# 12. AssetStorageService 设计

```ts
export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;

  getSignedUrl(input: GetSignedUrlInput): Promise<string>;

  deleteObject(storageKey: string): Promise<void>;

  headObject(storageKey: string): Promise<StorageObjectInfo>;
}
```

实现：

```text
LocalStorageProvider
S3StorageProvider
```

---

# 13. AssetReviewService 设计

```ts
export class AssetReviewService {
  async createReview(input: CreateAssetReviewInput): Promise<AssetReview>;

  async listReviews(assetId: string): Promise<AssetReview[]>;

  async updateReview(reviewId: string, input: UpdateAssetReviewInput): Promise<AssetReview>;

  async getLatestHumanReview(assetId: string): Promise<AssetReview | null>;
}
```

---

## 13.1 人工 review 表单字段

Web Admin 中建议给图片 review 提供这些字段：

```text
overallScore：总体评分
identityScore：是否像陆思源
faceSimilarity：脸像不像
styleConsistency：风格是否稳定
loraSuitability：是否适合 LoRA
coverSuitability：是否适合封面
videoSuitability：是否适合视频
issues：问题标签
strengths：优点标签
notes：备注
decision：最终判断
```

问题标签建议：

```text
face_too_wide
face_too_round
jawline_not_match
forehead_too_high
hair_too_long
hair_not_match
eyes_not_match
mouth_too_thick
neck_too_short
shoulders_too_wide
not_youthful
too_ai_generated
watermark
bad_lighting
pose_unusable
not_like_lusiyuan
```

优点标签建议：

```text
face_shape_good
eyes_match
mouth_match
youthful
clean_lighting
good_side_profile
good_front_profile
good_for_lora
good_for_cover
good_for_video
```

---

# 14. AssetCollectionService 设计

```ts
export class AssetCollectionService {
  async createCollection(input: CreateAssetCollectionInput): Promise<AssetCollection>;

  async addAsset(collectionId: string, input: AddAssetToCollectionInput): Promise<AssetCollectionItem>;

  async removeAsset(collectionId: string, assetId: string): Promise<void>;

  async listCollections(input: ListCollectionsInput): Promise<AssetCollection[]>;

  async getCollection(collectionId: string): Promise<AssetCollectionDetail>;

  async reorderItems(collectionId: string, itemIds: string[]): Promise<void>;
}
```

---

## 14.1 推荐默认 Collection

v0.9 初始化时可以创建：

```text
陆思源基准图集
陆思源侧脸参考图集
LoRA 第一批训练候选图
小红书封面候选图
视频素材候选
音色样本
口播稿
```

---

# 15. AssetSearchService 设计

v0.9.0 搜索先做结构化检索：

```text
type
tags
status
decision
scores
createdAt
source
collection
```

v0.9.1 再做多模态 embedding search。

```ts
export class AssetSearchService {
  async search(input: AssetSearchInput): Promise<AssetSearchResult>;
}
```

---

## 15.1 AssetSearchInput

```ts
export interface AssetSearchInput {
  query?: string;

  type?: string[];
  tags?: string[];
  decisions?: string[];
  collectionId?: string;

  minIdentityScore?: number;
  minLoraSuitability?: number;
  minCoverSuitability?: number;

  hasIssue?: string[];
  hasStrength?: string[];

  limit?: number;
  offset?: number;
}
```

---

## 15.2 示例查询

### 找 LoRA 候选图

```json
{
  "type": ["image"],
  "decisions": ["lora_candidate"],
  "minIdentityScore": 7.5,
  "minLoraSuitability": 7.5,
  "hasIssue": []
}
```

### 找侧脸参考图

```json
{
  "type": ["image"],
  "tags": ["侧脸"],
  "hasStrength": ["good_side_profile"],
  "minIdentityScore": 7
}
```

### 找小红书封面候选

```json
{
  "type": ["image"],
  "decisions": ["cover_candidate"],
  "minCoverSuitability": 7
}
```

---

# 16. AssetEmbeddingService 设计

v0.9.0 先预留。
v0.9.1 启用。

```ts
export class AssetEmbeddingService {
  async embedAsset(assetId: string, versionId?: string): Promise<AssetEmbedding>;

  async backfillEmbeddings(input: BackfillAssetEmbeddingsInput): Promise<void>;

  async searchByTextQuery(input: AssetSemanticSearchInput): Promise<AssetSearchResult>;
}
```

---

## 16.1 图片 embedding text

即使是图片，也应该组合 metadata 和 review 作为辅助文本。

```ts
export function buildAssetEmbeddingContext(asset: AssetDetail): string {
  return [
    `资产类型：${asset.asset.type}`,
    asset.asset.title ? `标题：${asset.asset.title}` : null,
    asset.asset.description ? `描述：${asset.asset.description}` : null,
    asset.asset.tags ? `标签：${asset.asset.tags.join("，")}` : null,
    latestReview ? `人工评价：${latestReview.notes}` : null,
    latestReview?.issues ? `问题：${latestReview.issues.join("，")}` : null,
    latestReview?.strengths ? `优点：${latestReview.strengths.join("，")}` : null
  ].filter(Boolean).join("\n");
}
```

多模态 embedding 输入可以是：

```text
image URL / base64 + text context
```

硅基流动文档说明 VL Embedding 支持 mixed text/image input 和 image URL/base64。([SiliconFlow][3])

---

## 16.2 v0.9.1 推荐维度

```env
ASSET_EMBEDDING_DIMENSIONS=1024
```

原因：

```text
1. 足够第一版图片检索
2. pgvector 压力较低
3. 后续可以 backfill 到 2048 / 4096
4. 未来迁 Qdrant 时更自由
```

---

# 17. LoRA Dataset Export

v0.9 不训练 LoRA，但可以导出候选训练集。

脚本：

```bash
pnpm assets:export-lora --collection="LoRA 第一批训练候选图"
```

或者按条件导出：

```bash
pnpm assets:export-lora --min-identity=7.5 --min-lora=7.5 --no-issues
```

输出：

```text
exports/lora-datasets/2026-05-25/
├── images/
│   ├── asset_001.png
│   ├── asset_002.png
│   └── ...
├── metadata.json
└── captions.jsonl
```

`captions.jsonl` 示例：

```json
{"file_name":"asset_001.png","caption":"陆思源，17岁男大学生形象，短黑发，清瘦少年脸，浅色衣服，自然摄影风格。"}
```

---

# 18. API 设计

## 18.1 上传资产

```http
POST /v1/assets/upload
```

`multipart/form-data`：

```text
file
type
title
description
source
tags
```

响应：

```json
{
  "asset_id": "asset_xxx",
  "version_id": "asset_version_xxx",
  "type": "image",
  "title": "陆思源侧脸候选图 001"
}
```

owner only。

---

## 18.2 创建文本资产

```http
POST /v1/assets
```

请求：

```json
{
  "type": "text",
  "title": "陆思源口播稿 v1",
  "description": "用于音色克隆的录音稿",
  "metadata": {
    "content": "大家好，我是陆思源……"
  },
  "tags": ["音色", "录音稿"]
}
```

---

## 18.3 获取资产详情

```http
GET /v1/assets/:assetId
```

响应包含：

```text
asset
versions
reviews
collections
usages
embeddings
```

---

## 18.4 列出资产

```http
GET /v1/assets
```

query：

```text
type
status
tag
decision
limit
offset
```

---

## 18.5 更新资产元数据

```http
PATCH /v1/assets/:assetId
```

---

## 18.6 归档资产

```http
POST /v1/assets/:assetId/archive
```

---

## 18.7 删除资产

```http
DELETE /v1/assets/:assetId
```

注意：

```text
v0.9 默认 soft delete。
真实文件删除可以后续手动清理。
```

---

## 18.8 创建 Review

```http
POST /v1/assets/:assetId/reviews
```

请求：

```json
{
  "reviewer_type": "human",
  "overall_score": 8,
  "identity_score": 8.5,
  "face_similarity": 8,
  "style_consistency": 7.5,
  "lora_suitability": 8,
  "cover_suitability": 7,
  "issues": ["lighting_inconsistent"],
  "strengths": ["eyes_match", "youthful", "good_for_lora"],
  "notes": "脸型和眼睛比较像陆思源，但光线稍微不统一。适合进入 LoRA 候选。",
  "decision": "lora_candidate"
}
```

---

## 18.9 搜索资产

```http
POST /v1/assets/search
```

请求：

```json
{
  "type": ["image"],
  "minIdentityScore": 7.5,
  "minLoraSuitability": 7.5,
  "decisions": ["lora_candidate"],
  "limit": 20
}
```

---

## 18.10 语义搜索资产

v0.9.1：

```http
POST /v1/assets/search/semantic
```

请求：

```json
{
  "query": "找清瘦、短黑发、侧脸比较像陆思源的图",
  "type": ["image"],
  "limit": 20
}
```

---

## 18.11 创建 Collection

```http
POST /v1/asset-collections
```

请求：

```json
{
  "name": "LoRA 第一批训练候选图",
  "type": "lora_dataset",
  "description": "用于第一版陆思源 LoRA 训练的候选图。"
}
```

---

## 18.12 添加资产到 Collection

```http
POST /v1/asset-collections/:collectionId/items
```

请求：

```json
{
  "asset_id": "asset_xxx",
  "version_id": "version_xxx",
  "role": "training_positive",
  "notes": "脸型和眼睛较像，适合训练。"
}
```

---

## 18.13 记录 Asset Usage

```http
POST /v1/assets/:assetId/usages
```

请求：

```json
{
  "usage_type": "xiaohongshu_post",
  "target": "xiaohongshu",
  "target_id": "draft_123",
  "notes": "用于第一条陆思源介绍内容封面。"
}
```

---

# 19. Web Admin 设计

v0.9 建议新增：

```text
/admin/assets
/admin/assets/:assetId
/admin/asset-collections
/admin/lora-candidates
```

如果不想拆多页面，先做一个：

```text
/admin/assets
```

---

## 19.1 /admin/assets 页面

功能：

```text
1. 上传资产
2. 查看资产列表
3. 按类型过滤
4. 按标签过滤
5. 按 review decision 过滤
6. 查看缩略图
7. 快速进入 review
```

布局：

```text
┌──────────────────────────────┐
│ Asset Library                 │
│ [上传] [筛选] [搜索]           │
├──────────────────────────────┤
│ 图片网格                       │
│ □ □ □ □                       │
│ □ □ □ □                       │
└──────────────────────────────┘
```

---

## 19.2 Asset Detail 页面

展示：

```text
1. 预览图 / 音频播放器 / 视频播放器
2. 基础元数据
3. 文件版本
4. Review 记录
5. 所属 Collection
6. 使用记录
7. 创建新 review
8. 添加到 Collection
```

---

## 19.3 Review UI

图片 review 表单：

```text
总体评分
像不像陆思源
脸部相似度
风格一致性
LoRA 适合度
封面适合度
问题标签
优点标签
备注
最终决定
```

最终决定按钮：

```text
通过
需要修改
不推荐
LoRA 候选
封面候选
基准参考
归档
```

---

# 20. 和前面版本的关系

## 20.1 和 v0.4 Memory Retrieval 的关系

不要把 Asset 和 Memory 混在一起。

```text
Memory：
用户偏好、技术决策、人设反馈

Asset：
图片、音频、视频、文档、素材、训练集
```

但可以互相引用。

例如 Memory 里可以记录：

```text
用户决定 LoRA 第一版训练集应优先选择 identityScore >= 7.5 的图片。
```

Asset 系统里则保存具体图片和评分。

---

## 20.2 和 v0.5 Tool Layer 的关系

新增低风险工具：

```text
search_assets
list_lora_candidates
create_asset_collection
create_asset_review
record_asset_usage
```

这些工具可以注册到 ToolRegistry。

但 v0.9 不允许：

```text
delete_asset_file
publish_asset
train_lora
```

这些先不开放。

---

## 20.3 和 v0.6 Creator Assistant 的关系

Creator Assistant 可以使用 Asset 信息做项目管理。

例如你问：

```text
现在 LoRA 候选图够了吗？
```

Creator Assistant 可以查：

```text
collection = LoRA 第一批训练候选图
identityScore >= 7.5
loraSuitability >= 7.5
```

然后回答：

```text
目前有 12 张候选图，其中 8 张评分较高，侧脸图偏少，建议再补 3～5 张稳定侧脸参考。
```

---

## 20.4 和 v0.7 Reflection Agent 的关系

Reflection Agent 可以复盘资产选择。

例如：

```text
最近多张图被标记为 face_too_wide，说明当前生成提示词可能需要强调“清瘦、窄脸、下颚线清晰”。
```

它可以生成 proposal：

```text
建议更新图像生成提示词：
增加“脸更窄、苹果肌收一点、不要脸胖”。
```

但不要自动修改 prompt 文件，仍然走 proposal。

---

## 20.5 和 v0.8 OpenClaw 的关系

OpenClaw 可以把外部平台素材送进 Asset 系统。

例如：

```text
小红书评论截图
网页截图
外部参考图
平台封面数据
```

但 v0.9 不允许 OpenClaw 直接上传不明来源大量文件。
OpenClaw 上传的 Asset 应标记：

```text
source = openclaw
status = pending_review
```

---

# 21. 安全与版权边界

v0.9 要特别注意素材来源。

每个 Asset 都应该记录：

```text
source
sourceUrl
createdBy
metadata.license
metadata.rights
```

建议 source 类型：

```text
self_generated
user_uploaded
ai_generated
openclaw_collected
reference_only
licensed
unknown
```

不同 source 的使用规则：

```text
self_generated：可用于项目
ai_generated：可用于项目，但注意平台规则
reference_only：只能参考，不能直接商用
unknown：默认不能公开使用
openclaw_collected：必须人工确认来源
```

v0.9 不需要做完整版权系统，但要先留下字段。

---

# 22. 脚本设计

## 22.1 import-local-assets

```bash
pnpm assets:import-local ./local-assets/lusiyuan
```

作用：

```text
批量导入本地文件夹中的素材。
```

---

## 22.2 inspect-assets

```bash
pnpm assets:inspect --type=image --decision=lora_candidate
```

---

## 22.3 backfill-asset-metadata

```bash
pnpm assets:backfill-metadata
```

作用：

```text
读取图片宽高、文件大小、hash、mimeType。
```

---

## 22.4 backfill-asset-embeddings

v0.9.1：

```bash
pnpm assets:backfill-embeddings
```

---

## 22.5 export-lora-candidates

```bash
pnpm assets:export-lora --collection="LoRA 第一批训练候选图"
```

---

# 23. package.json scripts

新增：

```json
{
  "scripts": {
    "assets:import-local": "tsx scripts/import-local-assets.ts",
    "assets:inspect": "tsx scripts/inspect-assets.ts",
    "assets:backfill-metadata": "tsx scripts/backfill-asset-metadata.ts",
    "assets:backfill-embeddings": "tsx scripts/backfill-asset-embeddings.ts",
    "assets:export-lora": "tsx scripts/export-lora-candidates.ts"
  }
}
```

---

# 24. 开发步骤

## Step 1：实现数据库模型

新增：

```text
Asset
AssetVersion
AssetReview
AssetEmbedding
AssetCollection
AssetCollectionItem
AssetUsage
```

执行 Prisma migration。

---

## Step 2：实现 StorageProvider

新增：

```text
storage-provider.ts
local-storage-provider.ts
s3-storage-provider.ts
storage-config.ts
```

先实现 LocalStorageProvider。

S3StorageProvider 可以同时预留。

---

## Step 3：实现 AssetService

实现：

```text
uploadAsset
createAsset
getAsset
listAssets
updateAsset
archiveAsset
deleteAsset
```

---

## Step 4：实现文件 hash 和 metadata

上传时自动计算：

```text
fileHash
sizeBytes
mimeType
width
height
durationMs
```

图片宽高可以用 Node 图片库读取。
音频/视频 duration 可以先留空，后续接 ffprobe。

---

## Step 5：实现 AssetReviewService

支持人工 review。

---

## Step 6：实现 AssetCollectionService

支持创建图集、添加资产、移除资产、排序。

---

## Step 7：实现 AssetUsageService

记录素材使用记录。

---

## Step 8：实现 AssetSearchService

先做结构化搜索。

---

## Step 9：新增 routes

```text
assets.route.ts
asset-reviews.route.ts
asset-collections.route.ts
asset-search.route.ts
```

---

## Step 10：实现 Web Admin

新增：

```text
/admin/assets
/admin/assets/:assetId
/admin/asset-collections
```

---

## Step 11：新增导入和导出脚本

实现：

```text
import-local-assets
export-lora-candidates
inspect-assets
```

---

## Step 12：预留 AssetEmbedding

先建表和接口。

v0.9.1 再开启：

```text
Qwen/Qwen3-VL-Embedding-8B
```

---

# 25. 验收标准

v0.9 完成后，应满足：

```text
1. 可以上传图片资产
2. 可以上传音频资产
3. 可以上传文档 / 文本资产
4. 文件不会直接存入 PostgreSQL
5. Asset 表记录资产元数据
6. AssetVersion 表记录具体文件版本
7. 可以计算文件 hash
8. 可以显示图片预览
9. 可以创建人工 AssetReview
10. 可以标记 LoRA 候选图
11. 可以标记封面候选图
12. 可以创建 AssetCollection
13. 可以把资产加入 Collection
14. 可以记录 AssetUsage
15. 可以按 type / tag / decision / score 搜索资产
16. 可以导出 LoRA 候选图集
17. Creator Assistant 可以读取资产统计
18. Reflection Agent 可以读取资产 review 结果
19. OpenClaw 导入的资产默认 pending_review
20. 原有 /v1/chat、Memory、Tool、Letta、OpenClaw 功能不受影响
```

---

# 26. 推荐测试场景

## 26.1 上传陆思源侧脸图

```text
上传一张侧脸图
type = image
tags = ["陆思源", "侧脸", "浅色衣服"]
```

期望：

```text
Asset 创建
AssetVersion 创建
图片可预览
width / height / hash 记录
```

---

## 26.2 创建 review

review 内容：

```text
identityScore = 8
faceSimilarity = 7.5
loraSuitability = 8
issues = ["lighting_inconsistent"]
strengths = ["good_side_profile", "youthful"]
decision = "lora_candidate"
```

期望：

```text
AssetReview 创建
资产可按 lora_candidate 搜到
```

---

## 26.3 创建 LoRA Collection

```text
创建 Collection：LoRA 第一批训练候选图
添加 10 张候选图
导出 dataset
```

期望：

```text
exports/lora-datasets/... 生成
metadata.json 生成
captions.jsonl 生成
```

---

## 26.4 记录使用

```text
把某张图记录为 xiaohongshu_post 封面使用
```

期望：

```text
AssetUsage 创建
资产详情页显示已使用
```

---

# 27. 给 Codex 的开发指令

可以把下面这段交给 Codex：

```text
请在现有 lusiyuan-core v0.8 项目基础上实现 task_09 / v0.9：Media & Asset Memory。

当前项目已有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- /v1/chat
- Telegram Adapter
- Weixin Bridge
- React + Vite Web Chat
- SiliconFlow Qwen/Qwen3-Embedding-4B + pgvector Memory Retrieval
- Tool & Action Layer
- DraftService
- Letta Creator Assistant
- Letta Reflection Agent
- OpenClaw Action Gateway

v0.9 目标：
新增媒体与数字人资产记忆系统，用于管理陆思源的图片、音频、视频、文档、提示词、LoRA 候选图、小红书封面候选、视频素材和音色样本。v0.9 重点是资产管理、标注、review、collection、usage 和结构化搜索。多模态 embedding 先预留，v0.9.1 再开启。

请完成以下任务：

1. 更新 .env.example，增加：
   - ASSETS_ENABLED=true
   - ASSET_UPLOAD_ENABLED=true
   - ASSET_MAX_FILE_SIZE_MB=100
   - ASSET_ALLOWED_TYPES="image,audio,video,document,text"
   - ASSET_PUBLIC_READ=false
   - STORAGE_PROVIDER="local"
   - LOCAL_STORAGE_DIR="./data/assets"
   - S3_ENDPOINT=""
   - S3_REGION="auto"
   - S3_BUCKET=""
   - S3_ACCESS_KEY_ID=""
   - S3_SECRET_ACCESS_KEY=""
   - S3_FORCE_PATH_STYLE=true
   - S3_PUBLIC_BASE_URL=""
   - ASSET_EMBEDDING_ENABLED=false
   - ASSET_EMBEDDING_PROVIDER="siliconflow"
   - ASSET_EMBEDDING_MODEL="Qwen/Qwen3-VL-Embedding-8B"
   - ASSET_EMBEDDING_DIMENSIONS=1024
   - ASSET_SEARCH_ENABLED=true
   - ASSET_SEARCH_TOP_K=20
   - ASSET_REVIEW_ENABLED=true
   - ASSET_AI_REVIEW_ENABLED=false
   - ASSET_REVIEW_OWNER_ONLY=true
   - ASSET_COLLECTIONS_ENABLED=true
   - LORA_EXPORT_ENABLED=true
   - LORA_MIN_SIMILARITY_SCORE=7.5
   - LORA_REQUIRE_APPROVED=true

2. 新增 Prisma models：
   - Asset
   - AssetVersion
   - AssetReview
   - AssetEmbedding
   - AssetCollection
   - AssetCollectionItem
   - AssetUsage

3. Asset 字段：
   - id
   - type
   - status default active
   - title
   - description
   - source
   - sourceUrl
   - canonicalVersionId
   - tags Json?
   - entities Json?
   - metadata Json?
   - createdBy
   - createdAt
   - updatedAt

4. AssetVersion 字段：
   - id
   - assetId
   - versionType default original
   - fileName
   - mimeType
   - sizeBytes
   - width
   - height
   - durationMs
   - storageProvider
   - storageKey
   - fileUrl
   - fileHash
   - metadata Json?
   - createdAt

5. AssetReview 字段：
   - id
   - assetId
   - versionId
   - reviewerType
   - reviewerId
   - overallScore
   - identityScore
   - faceSimilarity
   - styleConsistency
   - loraSuitability
   - coverSuitability
   - videoSuitability
   - issues Json?
   - strengths Json?
   - notes
   - decision
   - status default active
   - createdAt
   - updatedAt

6. AssetEmbedding 字段：
   - id
   - assetId
   - versionId
   - provider
   - model
   - dimensions
   - modality
   - contentHash
   - createdAt
   - updatedAt
   - unique(assetId, versionId, provider, model, dimensions)
   - v0.9 可以先不添加 vector 字段，或用 raw SQL 预留 embedding vector(1024)

7. AssetCollection 字段：
   - id
   - name
   - description
   - type
   - status default active
   - metadata Json?
   - createdBy
   - createdAt
   - updatedAt

8. AssetCollectionItem 字段：
   - id
   - collectionId
   - assetId
   - versionId
   - orderIndex
   - role
   - notes
   - createdAt

9. AssetUsage 字段：
   - id
   - assetId
   - versionId
   - usageType
   - target
   - targetId
   - notes
   - metadata Json?
   - createdAt

10. 新增 src/storage/：
    - storage-provider.ts
    - local-storage-provider.ts
    - s3-storage-provider.ts
    - storage-config.ts
    实现 StorageProvider：
    - putObject()
    - getSignedUrl()
    - deleteObject()
    - headObject()

11. LocalStorageProvider：
    - 文件保存到 LOCAL_STORAGE_DIR
    - 按 type/year/month 组织目录
    - 返回 storageKey
    - 支持 signed URL 的简单本地实现或直接返回本地访问 route

12. S3StorageProvider：
    - 使用 S3-compatible API
    - 使用 env 中的 endpoint、bucket、access key
    - v0.9 可以先实现基础 putObject/deleteObject/headObject
    - 不要把 secret 暴露到前端

13. 新增 src/assets/：
    - asset.service.ts
    - asset.types.ts
    - asset-storage.service.ts
    - asset-metadata.service.ts
    - asset-review.service.ts
    - asset-search.service.ts
    - asset-usage.service.ts
    - asset-collection.service.ts
    - asset-permissions.ts
    - asset-hash.ts
    - asset-url.ts

14. AssetService：
    - uploadAsset()
    - createAsset()
    - getAsset()
    - listAssets()
    - updateAsset()
    - archiveAsset()
    - deleteAsset()
    上传时要：
    - 检查文件大小
    - 检查 mimeType
    - 计算 fileHash
    - 存储文件
    - 创建 Asset
    - 创建 AssetVersion

15. AssetMetadataService：
    - 读取图片 width/height
    - 记录 sizeBytes/mimeType/hash
    - 音频/视频 durationMs 可以先留空，后续 ffprobe
    - metadata 失败不能导致上传失败，只记录 warning

16. AssetReviewService：
    - createReview()
    - listReviews()
    - updateReview()
    - getLatestHumanReview()
    - 支持 issues / strengths / decision

17. AssetCollectionService：
    - createCollection()
    - addAsset()
    - removeAsset()
    - listCollections()
    - getCollection()
    - reorderItems()

18. AssetUsageService：
    - recordUsage()
    - listUsageByAsset()
    - listUsageByTarget()

19. AssetSearchService：
    - 支持按 type、tags、decision、score、issues、strengths、collection 搜索
    - v0.9 先做结构化搜索
    - v0.9 不要求语义搜索必须完成

20. 新增 src/asset-embeddings/：
    - asset-embedding.service.ts
    - asset-embedding-provider.ts
    - siliconflow-vl-embedding-provider.ts
    - asset-embedding-text.ts
    - pgvector-asset-index.ts
    v0.9 只预留接口，不默认启用。
    ASSET_EMBEDDING_ENABLED=false 时不能调用外部 embedding API。

21. 新增 routes：
    - routes/assets.route.ts
    - routes/asset-reviews.route.ts
    - routes/asset-collections.route.ts
    - routes/asset-search.route.ts

22. assets routes：
    - POST /v1/assets/upload
    - POST /v1/assets
    - GET /v1/assets
    - GET /v1/assets/:assetId
    - PATCH /v1/assets/:assetId
    - POST /v1/assets/:assetId/archive
    - DELETE /v1/assets/:assetId
    - POST /v1/assets/:assetId/usages
    - owner only for upload/update/delete/archive

23. asset review routes：
    - POST /v1/assets/:assetId/reviews
    - GET /v1/assets/:assetId/reviews
    - PATCH /v1/asset-reviews/:reviewId
    - owner only

24. asset collection routes：
    - POST /v1/asset-collections
    - GET /v1/asset-collections
    - GET /v1/asset-collections/:collectionId
    - POST /v1/asset-collections/:collectionId/items
    - DELETE /v1/asset-collections/:collectionId/items/:itemId
    - PATCH /v1/asset-collections/:collectionId/reorder
    - owner only for mutations

25. asset search routes：
    - POST /v1/assets/search
    - POST /v1/assets/search/semantic
    semantic search 如果 ASSET_EMBEDDING_ENABLED=false，应返回明确错误或 fallback 到结构化搜索。

26. 新增低风险 tools 并注册到 ToolRegistry：
    - search_assets
    - list_lora_candidates
    - create_asset_collection
    - create_asset_review
    - record_asset_usage
    这些工具必须经过 ToolExecutor 和 ActionPolicy。

27. 新增 scripts：
    - scripts/import-local-assets.ts
    - scripts/inspect-assets.ts
    - scripts/backfill-asset-metadata.ts
    - scripts/backfill-asset-embeddings.ts
    - scripts/export-lora-candidates.ts

28. 更新 package.json scripts：
    - "assets:import-local": "tsx scripts/import-local-assets.ts"
    - "assets:inspect": "tsx scripts/inspect-assets.ts"
    - "assets:backfill-metadata": "tsx scripts/backfill-asset-metadata.ts"
    - "assets:backfill-embeddings": "tsx scripts/backfill-asset-embeddings.ts"
    - "assets:export-lora": "tsx scripts/export-lora-candidates.ts"

29. Web Admin：
    - 新增 /admin/assets
    - 新增 /admin/assets/:assetId
    - 新增 /admin/asset-collections
    - 支持上传、预览、筛选、review、添加到 collection、记录 usage
    - 图片以网格展示
    - 音频提供播放器
    - 视频提供基础预览或下载链接
    - v0.9 不要求做复杂多模态搜索 UI

30. 新增 docs/media-asset-memory-v0.9.md：
    - 解释 Asset / AssetVersion / AssetReview / AssetCollection / AssetUsage
    - 说明文件存储策略
    - 说明为什么文件不存 PostgreSQL
    - 说明本地存储和 S3-compatible 存储
    - 说明 Qwen3-VL-Embedding 是 v0.9.1 预留
    - 说明如何导入本地素材
    - 说明如何 review 图片
    - 说明如何导出 LoRA 候选图
    - 说明版权和素材来源边界

限制：
- 不要训练 LoRA
- 不要自动生图
- 不要自动发布内容
- 不要自动删除真实文件，除非明确调用 delete
- 不要让 OpenClaw 上传的资产直接变成 approved
- 不要让 AI review 覆盖 human review
- 不要把大文件存入 PostgreSQL
- 不要把 S3/R2 secret 暴露到前端
- 不要默认开启 ASSET_EMBEDDING_ENABLED
- 不要把 Asset 和 Memory 混成一张表

验收：
- 可以上传图片资产
- 可以上传音频资产
- 可以创建文本资产
- Asset / AssetVersion 正常入库
- 文件保存在 local storage 或 S3-compatible storage
- 可以查看资产列表和详情
- 可以创建 AssetReview
- 可以标记 lora_candidate / cover_candidate / reference_candidate
- 可以创建 AssetCollection
- 可以添加资产到 Collection
- 可以记录 AssetUsage
- 可以结构化搜索资产
- 可以导出 LoRA 候选图集
- Web Admin 可以上传、预览、review
- 原有 /v1/chat、Memory、Tool、Letta、OpenClaw 功能不受影响
```

---

# 28. v0.9 最终效果

v0.9 做完后，陆思源系统会新增一块非常关键的能力：

```text
资产记忆
```

他不再只是记得：

```text
我们聊过什么
用户喜欢什么
项目做到了哪一步
```

还会开始记得：

```text
哪张图像他
哪张图不像他
哪张图适合 LoRA
哪张图适合封面
哪段音频适合做音色参考
哪些素材已经用过
哪些素材还需要补
```

这一步之后，陆思源会从：

```text
有长期记忆的聊天数字人
```

进一步变成：

```text
有自己素材资产库、视觉记忆和内容生产基础的数字人项目。
```

[1]: https://developers.cloudflare.com/r2/api/s3/api/?utm_source=chatgpt.com "S3 API compatibility · Cloudflare R2 docs"
[2]: https://huggingface.co/Qwen/Qwen3-VL-Embedding-8B?utm_source=chatgpt.com "Qwen/Qwen3-VL-Embedding-8B"
[3]: https://docs.siliconflow.cn/cn/api-reference/embeddings/create-embeddings?utm_source=chatgpt.com "创建嵌入请求 - SiliconFlow"
[4]: https://qdrant.tech/documentation/search/filtering/?utm_source=chatgpt.com "Filtering"
[5]: https://github.com/qdrant/qdrant?utm_source=chatgpt.com "qdrant-cloud-bot Cursor Agent cursoragent"
[6]: https://www.cloudflare.com/developer-platform/use-cases/s3-compatible-object-storage/?utm_source=chatgpt.com "S3 Compatible Object Storage Solutions"
