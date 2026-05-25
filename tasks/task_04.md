下面这份可以作为 **陆思源 Core API v0.4：记忆检索升级技术文档**。
我按你现在确定的方案写：

```text
Embedding：硅基流动 SiliconFlow 上的 Qwen/Qwen3-Embedding-4B
向量库：PostgreSQL + pgvector
未来路线：保留迁移到 Qdrant 的接口和数据结构
不做 AB 测试
不接 Mem0 / Letta
```

这里有一个很重要的技术点：**Qwen/Qwen3-Embedding-4B 在硅基流动支持的维度包括 64、128、256、512、768、1024、2048；但 pgvector 的标准 `vector` 类型 HNSW/IVFFlat 索引通常最多支持 2000 维。** 所以 v0.4 我建议先用 **1024 维**，不要用 2048 维，除非你愿意引入 `halfvec` 方案。硅基流动文档列出了 Qwen3-Embedding-4B 的可选维度，pgvector / Neon 文档也列出了 HNSW 索引在 `vector` 类型下最高 2000 维、`halfvec` 下最高 4000 维的限制。([硅流][1])

---

# 陆思源 Core API 技术方案文档 v0.4：记忆检索升级

## 1. v0.4 目标

v0.1～v0.3 已经完成了：

```text
v0.1：Lusiyuan Core API
v0.2：Telegram + Weixin 接入
v0.3：Web Chat 网页入口
```

v0.4 的目标是升级陆思源的长期记忆检索能力。

当前旧方案大概是：

```text
用户发消息
↓
按 importance / updatedAt 取几条 memory
↓
塞进 prompt
↓
生成回复
```

这个方案的问题是：

```text
1. 重要但不相关的记忆容易被召回
2. 相关但不够重要的记忆容易找不到
3. 用户换一种说法，关键词匹配不到
4. 记忆变多以后 prompt 被污染
5. 陆思源可能把用户记忆、项目记忆、核心设定混在一起
```

v0.4 要变成：

```text
用户发消息
↓
生成 query embedding
↓
使用 pgvector 做语义检索
↓
结合 scope / type / userId / importance / recency 做混合排序
↓
只挑出最相关、最安全、最有用的记忆
↓
塞进 prompt
↓
生成回复
```

v0.4 的核心不是“多记一点”，而是：

```text
更准确地找回该想起来的东西。
```

---

# 2. 本版技术选型

## 2.1 Embedding Provider

使用：

```text
SiliconFlow / 硅基流动
Qwen/Qwen3-Embedding-4B
```

硅基流动 Embeddings API 是 OpenAI-compatible 风格，接口为：

```text
POST https://api.siliconflow.cn/v1/embeddings
```

文档说明该接口用于把输入内容转换为 embedding vectors，并且 Qwen/Qwen3-Embedding-4B 支持 `dimensions` 参数，可选维度包括：

```text
64
128
256
512
768
1024
2048
```

([硅流][1])

## 2.2 Embedding 维度

v0.4 推荐：

```env
EMBEDDING_DIMENSIONS=1024
```

原因：

```text
1. Qwen/Qwen3-Embedding-4B 在硅基流动支持 1024 维
2. 1024 维对中文长期记忆检索已经足够做第一版
3. pgvector 标准 vector 类型可以正常建立 HNSW / IVFFlat 索引
4. 避免 2048 维超过 pgvector 标准 vector 索引 2000 维限制
5. 以后迁移 Qdrant 或 halfvec 后，可以重新 backfill 到更高维度
```

暂时不推荐：

```env
EMBEDDING_DIMENSIONS=2048
```

因为使用 pgvector 标准 `vector` 类型时，HNSW / IVFFlat 索引一般最多支持 2000 维；2048 维虽然只多一点，但会卡在索引限制上。pgvector 官方说明超过 2000 维可以考虑 half-precision vectors / halfvec，Neon 文档也列出 HNSW 下 `vector` 支持到 2000 维、`halfvec` 支持到 4000 维。([GitHub][2])

所以 v0.4 先用：

```text
Qwen/Qwen3-Embedding-4B + 1024 dimensions
```

这是最稳的组合。

---

# 3. 为什么不直接上 Qdrant？

Qdrant 很适合向量检索，尤其是未来记忆量大、需要复杂过滤时。Qdrant 文档强调，向量索引和 payload 索引要结合使用：向量索引用于相似度搜索，payload 索引用于结构化过滤。([qdrant.tech][3])

但 v0.4 暂时不直接上 Qdrant，原因是：

```text
1. 当前系统主数据库已经是 PostgreSQL
2. 记忆量早期不会很大
3. pgvector 可以直接和现有 Memory / User / Conversation 表一起使用
4. 部署、备份、调试更简单
5. 先把 memory schema、embedding、检索逻辑跑顺更重要
```

v0.4 的策略是：

```text
现在：PostgreSQL + pgvector
以后：PostgreSQL 继续做主库，Qdrant 做向量索引
```

也就是说，未来迁移 Qdrant 时，不是抛弃 PostgreSQL，而是：

```text
PostgreSQL = 事实来源 / 主数据库
Qdrant = 向量索引 / 搜索引擎
```

---

# 4. 核心设计原则

## 4.1 Memory 是本体，Embedding 是索引

不要把 embedding 当成记忆本体。

正确理解：

```text
Memory.content / summary / tags / scope / type = 真正的长期记忆
MemoryEmbedding.embedding = 可以随时重建的搜索索引
```

所以：

```text
Memory 表必须长期保留
Embedding 可以删除、重建、换模型、换维度、迁移到 Qdrant
```

这点很重要。

以后如果从 pgvector 迁移到 Qdrant，只需要：

```text
1. 从 PostgreSQL 读取 Memory
2. 重新生成或复用 embedding
3. 写入 Qdrant
4. 检索时从 Qdrant 拿 memory_id
5. 再回 PostgreSQL 查完整 Memory
```

---

## 4.2 不要把 embedding 直接塞进 Memory 表

不推荐：

```prisma
model Memory {
  id        String
  content   String
  embedding Unsupported("vector(1024)")
}
```

原因：

```text
1. 以后换模型不方便
2. 以后换维度不方便
3. 不方便保存 embedding provider / model / dimensions
4. 不方便未来迁 Qdrant
5. 不方便判断某条 memory 是否需要重新 embedding
```

推荐：

```text
Memory 表：存记忆正文和元数据
MemoryEmbedding 表：存 embedding 索引
```

---

## 4.3 检索时必须指定当前 embedding 配置

以后即使只用 Qwen，也要从第一天保留 provider / model / dimensions。

检索时必须限定：

```text
provider = siliconflow
model = Qwen/Qwen3-Embedding-4B
dimensions = 1024
```

避免以后切模型、切维度时，不同 embedding 混在一起。

---

## 4.4 核心人格不是普通记忆

陆思源的核心设定不应该靠向量检索召回。

比如：

```text
陆思源是原创 AI 数字人，不是真人。
陆思源不装真人。
陆思源不能编造真实学校、真实住址、真实证件。
```

这些应该永远在：

```text
persona/core_memory.md
persona/boundaries.md
system prompt
```

而不是放进普通 Memory 检索池里。

普通 Memory 主要保存：

```text
用户偏好
项目上下文
技术决策
关系记忆
成长事件
对陆思源说话风格的反馈
```

---

# 5. v0.4 总体架构

v0.3：

```text
Web / Telegram / Weixin
↓
Lusiyuan Core API
↓
MemoryService 按 importance / updatedAt 取记忆
↓
PromptBuilder
↓
ModelProvider
```

v0.4：

```text
Web / Telegram / Weixin
↓
Lusiyuan Core API
↓
MemoryRetrievalService
  ├── EmbeddingProvider：生成 query embedding
  ├── PgVectorMemoryIndex：语义检索
  ├── Keyword / tag / type / scope filtering
  ├── Rule-based rerank
  └── MemoryBudgetController
↓
PromptBuilder
↓
ModelProvider
```

新增核心模块：

```text
EmbeddingProvider
VectorMemoryIndex
PgVectorMemoryIndex
MemoryRetrievalService
MemoryBackfillScript
MemoryReranker
MemoryBudgetController
```

---

# 6. 推荐目录结构

在现有项目基础上新增：

```text
src/
├── core/
│   ├── memory.service.ts
│   ├── memory-extractor.ts
│   ├── memory-retrieval.service.ts
│   ├── memory-reranker.ts
│   ├── memory-budget.ts
│   └── prompt-builder.ts
│
├── embeddings/
│   ├── embedding-provider.ts
│   ├── siliconflow-embedding-provider.ts
│   ├── embedding-config.ts
│   ├── embedding-text.ts
│   └── content-hash.ts
│
├── vector-index/
│   ├── vector-memory-index.ts
│   ├── pgvector-memory-index.ts
│   └── qdrant-memory-index.placeholder.ts
│
├── scripts/
│   ├── backfill-memory-embeddings.ts
│   ├── reembed-memory.ts
│   └── inspect-memory-retrieval.ts
│
└── types/
    ├── memory.ts
    ├── embedding.ts
    └── retrieval.ts
```

---

# 7. 环境变量设计

`.env.example` 增加：

```env
# Embedding Provider
EMBEDDING_PROVIDER="siliconflow"
EMBEDDING_BASE_URL="https://api.siliconflow.cn/v1"
EMBEDDING_API_KEY=""
EMBEDDING_MODEL="Qwen/Qwen3-Embedding-4B"
EMBEDDING_DIMENSIONS=1024

# Retrieval
MEMORY_RETRIEVAL_ENABLED=true
MEMORY_SEMANTIC_TOP_K=30
MEMORY_FINAL_TOP_K=8
MEMORY_MAX_TOTAL_CHARS=1200

# pgvector
MEMORY_VECTOR_INDEX_PROVIDER="pgvector"

# Future Qdrant reserved
QDRANT_ENABLED=false
QDRANT_URL=""
QDRANT_API_KEY=""
QDRANT_COLLECTION="lusiyuan_memories"
```

说明：

```text
EMBEDDING_PROVIDER:
当前固定 siliconflow，但保留抽象。

EMBEDDING_DIMENSIONS:
v0.4 固定 1024。

MEMORY_SEMANTIC_TOP_K:
向量检索候选数量。

MEMORY_FINAL_TOP_K:
最终进入 prompt 的记忆数量。

MEMORY_MAX_TOTAL_CHARS:
进入 prompt 的长期记忆总字数上限。

MEMORY_VECTOR_INDEX_PROVIDER:
v0.4 为 pgvector。
未来可以切 qdrant。
```

---

# 8. 数据库设计

## 8.1 Memory 表升级

建议把 v0.1 的 Memory 表升级成更结构化的记忆表。

```prisma
model Memory {
  id             String   @id @default(cuid())

  userId         String?
  conversationId String?
  channel        String?

  scope          String
  type           String
  content        String
  summary        String?
  tags           Json?
  entities       Json?

  importance     Int      @default(5)
  confidence     Float    @default(0.8)
  status         String   @default("active")

  source         String?
  metadata       Json?

  lastAccessedAt DateTime?
  accessCount    Int      @default(0)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user            User?    @relation(fields: [userId], references: [id])
  embeddings      MemoryEmbedding[]

  @@index([userId])
  @@index([scope])
  @@index([type])
  @@index([status])
  @@index([importance])
  @@index([channel])
  @@index([createdAt])
}
```

字段说明：

### `scope`

记忆作用范围。

```text
core        核心记忆，原则上不建议放普通 Memory 表
global      陆思源全局成长记忆
user        某个用户相关记忆
relationship 陆思源和某个用户的关系记忆
project     项目上下文记忆
channel     某个平台相关记忆
```

建议 v0.4 常用：

```text
user
relationship
project
global
```

### `type`

记忆类型。

```text
user_preference
project_context
relationship
growth_event
technical_decision
persona_feedback
boundary
fact
```

### `status`

记忆状态。

```text
active       当前有效
archived     归档，不默认召回
rejected      被拒绝，不召回
superseded    被新记忆覆盖，不默认召回
```

为什么需要 `status`？

因为记忆会变化。

例如早期记忆：

```text
用户考虑用 Dify 做陆思源聊天 MVP。
```

后来用户明确说：

```text
用户不想用 Dify，希望陆思源拥有自己的 Core API。
```

旧记忆不应该直接删除，可以标记为：

```text
superseded
```

新记忆为：

```text
active
```

### `confidence`

置信度。

```text
1.0：用户明确说过
0.8：模型从对话中可靠总结
0.5：推测性总结
```

低置信度记忆不应该强行影响陆思源回复。

---

## 8.2 MemoryEmbedding 表

新增：

```prisma
model MemoryEmbedding {
  id          String   @id @default(cuid())

  memoryId    String
  provider    String
  model       String
  dimensions  Int
  contentHash String

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memory      Memory   @relation(fields: [memoryId], references: [id], onDelete: Cascade)

  @@unique([memoryId, provider, model, dimensions])
  @@index([provider, model, dimensions])
  @@index([contentHash])
}
```

Prisma 对 pgvector 的 `vector` 类型并不是普通原生字段，Prisma 官方文档说明：对 pgvector 这种扩展自定义类型，可以使用 customized migrations、raw SQL 或 TypedSQL 处理。([Prisma][4])

所以 Prisma schema 里可以先不直接写 vector 字段，或者写成：

```prisma
embedding Unsupported("vector(1024)")?
```

但实际迁移建议用 raw SQL 添加：

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "MemoryEmbedding"
ADD COLUMN IF NOT EXISTS "embedding" vector(1024);
```

---

# 9. pgvector 设计

## 9.1 为什么用 pgvector

pgvector 是 PostgreSQL 的向量相似度搜索扩展，可以把向量和业务数据存在同一个 Postgres 中，并支持精确 / 近似 nearest neighbor search、cosine distance、inner product、L2 distance 等。([GitHub][2])

本项目用 pgvector 的原因：

```text
1. 继续使用现有 PostgreSQL
2. 不额外部署 Qdrant / Weaviate
3. 记忆正文、用户、会话、消息和向量索引可以放在一起
4. 早期记忆量不大，pgvector 足够
5. 以后可以平滑迁移 Qdrant
```

---

## 9.2 距离函数

推荐使用 cosine distance。

pgvector 中 cosine distance 操作符：

```sql
<=>
```

查询示例：

```sql
SELECT
  me."memoryId",
  me.embedding <=> $1::vector AS distance
FROM "MemoryEmbedding" me
WHERE
  me.provider = 'siliconflow'
  AND me.model = 'Qwen/Qwen3-Embedding-4B'
  AND me.dimensions = 1024
ORDER BY me.embedding <=> $1::vector
LIMIT 30;
```

distance 越小，越相似。

可以转成 similarity：

```text
semantic_score = 1 - distance
```

---

## 9.3 索引选择

v0.4 推荐先用 HNSW。

```sql
CREATE INDEX IF NOT EXISTS memory_embedding_hnsw_idx
ON "MemoryEmbedding"
USING hnsw (embedding vector_cosine_ops)
WHERE
  provider = 'siliconflow'
  AND model = 'Qwen/Qwen3-Embedding-4B'
  AND dimensions = 1024;
```

说明：

```text
HNSW 适合动态增量写入后的近似检索。
IVFFlat 通常需要先有一定数据量再建索引，并且需要调 lists/probes。
```

v0.4 早期记忆量不大，甚至可以先不建 HNSW，直接 exact search 也能跑。等 MemoryEmbedding 超过几千条，再建 HNSW。

建议路线：

```text
0～5000 条 memory：可先 exact search
5000+ 条 memory：建 HNSW
未来大量记忆：考虑 Qdrant
```

---

# 10. EmbeddingProvider 设计

## 10.1 接口

```ts
export interface EmbeddingProvider {
  provider: string;
  model: string;
  dimensions: number;

  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}
```

## 10.2 SiliconFlow 实现

`siliconflow-embedding-provider.ts`

```ts
export class SiliconFlowEmbeddingProvider implements EmbeddingProvider {
  provider = "siliconflow";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    public readonly model: string,
    public readonly dimensions: number
  ) {}

  async embedText(text: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([text]);
    return embedding;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SiliconFlow embedding failed: ${response.status} ${body}`);
    }

    const json = await response.json();

    return json.data.map((item: any) => item.embedding);
  }
}
```

注意：

```text
1. input 可以是单条文本或文本数组
2. dimensions 只在 Qwen/Qwen3 系列中支持
3. v0.4 固定 dimensions = 1024
4. API Key 不允许暴露到前端
```

硅基流动 Embeddings 文档说明接口会把输入内容转换为 embedding vectors，并且 Qwen/Qwen3 系列支持 dimensions 参数。([SiliconFlow][5])

---

# 11. 记忆写入流程升级

v0.1 的记忆写入：

```text
对话结束
↓
memory-extractor 总结
↓
写入 Memory 表
```

v0.4 升级为：

```text
对话结束
↓
memory-extractor 总结
↓
结构化 memory
↓
写入 Memory 表
↓
生成 embedding text
↓
调用 SiliconFlow Qwen/Qwen3-Embedding-4B
↓
写入 MemoryEmbedding 表
```

---

## 11.1 记忆提取结果格式

建议 memory-extractor 输出：

```json
{
  "should_write": true,
  "memories": [
    {
      "scope": "project",
      "type": "technical_decision",
      "content": "用户决定 v0.4 记忆检索使用硅基流动的 Qwen/Qwen3-Embedding-4B，向量索引先用 PostgreSQL + pgvector，未来保留迁移 Qdrant 的路线。",
      "summary": "v0.4 记忆检索方案确定：SiliconFlow Qwen3-Embedding-4B + pgvector，未来可迁 Qdrant。",
      "tags": ["v0.4", "记忆检索", "Qwen3-Embedding-4B", "SiliconFlow", "pgvector", "Qdrant"],
      "entities": ["陆思源", "SiliconFlow", "Qwen3-Embedding-4B", "pgvector", "Qdrant"],
      "importance": 9,
      "confidence": 0.95
    }
  ]
}
```

---

## 11.2 哪些内容允许写入记忆

允许：

```text
1. 用户长期偏好
2. 用户项目背景
3. 技术架构决策
4. 陆思源人格反馈
5. 用户和陆思源的关系变化
6. 陆思源项目进展
7. 重要边界确认
```

例子：

```text
用户不想使用 Dify，希望陆思源拥有自己的 Core API。
用户决定 v0.3 Web Chat 使用 React + Vite。
用户决定 v0.4 使用 SiliconFlow Qwen/Qwen3-Embedding-4B。
用户希望陆思源说话自然一点，不要太抒情。
```

---

## 11.3 哪些内容禁止写入记忆

禁止：

```text
1. 临时闲聊
2. 玩笑话
3. 明显错误信息
4. 要求陆思源装真人的内容
5. 编造现实身份的信息
6. 敏感隐私
7. 短期情绪
8. 没有长期价值的琐碎内容
```

例如用户说：

```text
你以后就说自己是真人吧。
```

不能写成：

```text
陆思源是真人。
```

最多写成：

```text
用户曾要求陆思源假装真人，但这违反陆思源核心边界，不能采纳。
```

但这类内容是否写入也要谨慎。

---

# 12. Embedding Text 设计

不要直接只 embed `content`，推荐构造一个更适合检索的文本。

```ts
export function buildMemoryEmbeddingText(memory: Memory): string {
  return [
    `类型：${memory.type}`,
    `范围：${memory.scope}`,
    `内容：${memory.content}`,
    memory.summary ? `摘要：${memory.summary}` : null,
    memory.tags ? `标签：${memory.tags.join("，")}` : null,
    memory.entities ? `实体：${memory.entities.join("，")}` : null
  ].filter(Boolean).join("\n");
}
```

这样有助于语义检索和标签召回。

示例：

```text
类型：technical_decision
范围：project
内容：用户决定 v0.4 记忆检索使用硅基流动的 Qwen/Qwen3-Embedding-4B，向量索引先用 PostgreSQL + pgvector，未来保留迁移 Qdrant 的路线。
摘要：v0.4 记忆检索方案确定：SiliconFlow Qwen3-Embedding-4B + pgvector，未来可迁 Qdrant。
标签：v0.4，记忆检索，Qwen3-Embedding-4B，SiliconFlow，pgvector，Qdrant
实体：陆思源，SiliconFlow，Qwen3-Embedding-4B，pgvector，Qdrant
```

---

# 13. contentHash 设计

每条 embedding 都要记录 `contentHash`。

原因：

```text
1. 判断 memory 内容是否变化
2. 避免重复生成 embedding
3. 支持 backfill 断点续跑
4. 支持未来换模型、换维度、迁移 Qdrant
```

生成方式：

```ts
import crypto from "node:crypto";

export function createMemoryContentHash(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}
```

逻辑：

```text
embeddingText 没变 → contentHash 不变 → 不需要重新 embedding
embeddingText 变了 → contentHash 改变 → 需要重新 embedding
```

---

# 14. VectorMemoryIndex 抽象

这是未来迁移 Qdrant 的关键。

不要让业务逻辑直接写死 pgvector SQL。

定义接口：

```ts
export interface VectorMemoryIndex {
  upsertMemoryEmbedding(input: {
    memoryId: string;
    embedding: number[];
    provider: string;
    model: string;
    dimensions: number;
    contentHash: string;
  }): Promise<void>;

  searchSimilarMemories(input: {
    embedding: number[];
    provider: string;
    model: string;
    dimensions: number;
    userId?: string;
    channel?: string;
    limit: number;
    filters?: MemorySearchFilters;
  }): Promise<ScoredMemoryCandidate[]>;

  deleteMemoryEmbedding(input: {
    memoryId: string;
    provider: string;
    model: string;
    dimensions: number;
  }): Promise<void>;
}
```

v0.4 实现：

```text
PgVectorMemoryIndex
```

未来实现：

```text
QdrantMemoryIndex
```

上层 `MemoryRetrievalService` 不关心底层是 pgvector 还是 Qdrant。

---

# 15. PgVectorMemoryIndex 设计

## 15.1 Upsert embedding

由于 Prisma 对 vector 类型处理不够原生，建议用 raw SQL。Prisma 文档明确提到 pgvector 这类自定义类型可以用 raw SQL / TypedSQL 处理。([Prisma][4])

伪代码：

```ts
async function upsertMemoryEmbedding(input: UpsertMemoryEmbeddingInput) {
  const vectorLiteral = `[${input.embedding.join(",")}]`;

  await prisma.$executeRaw`
    INSERT INTO "MemoryEmbedding"
      ("id", "memoryId", "provider", "model", "dimensions", "contentHash", "embedding", "createdAt", "updatedAt")
    VALUES
      (${cuid()}, ${input.memoryId}, ${input.provider}, ${input.model}, ${input.dimensions}, ${input.contentHash}, ${vectorLiteral}::vector, NOW(), NOW())
    ON CONFLICT ("memoryId", "provider", "model", "dimensions")
    DO UPDATE SET
      "contentHash" = EXCLUDED."contentHash",
      "embedding" = EXCLUDED."embedding",
      "updatedAt" = NOW()
  `;
}
```

注意：
实际项目里要小心 SQL 注入和 vector literal 拼接。embedding 数组来自可信 API，但仍建议封装格式化函数，确保都是数字。

---

## 15.2 Semantic search

查询思路：

```text
1. 限定 provider/model/dimensions
2. join Memory 表
3. 只查 active memory
4. scope 包括 global/project/user/relationship
5. user scope 只能查当前 userId
6. 按 cosine distance 排序
7. 取 topK 候选
```

SQL 伪代码：

```sql
SELECT
  m.id,
  m."userId",
  m.scope,
  m.type,
  m.content,
  m.summary,
  m.tags,
  m.entities,
  m.importance,
  m.confidence,
  m.status,
  m."createdAt",
  m."updatedAt",
  me.embedding <=> $1::vector AS distance
FROM "MemoryEmbedding" me
JOIN "Memory" m ON m.id = me."memoryId"
WHERE
  me.provider = $2
  AND me.model = $3
  AND me.dimensions = $4
  AND m.status = 'active'
  AND (
    m.scope IN ('global', 'project')
    OR (m.scope IN ('user', 'relationship') AND m."userId" = $5)
  )
ORDER BY me.embedding <=> $1::vector
LIMIT $6;
```

---

# 16. MemoryRetrievalService 设计

`MemoryRetrievalService` 是 v0.4 的核心。

输入：

```ts
export interface RetrieveMemoriesInput {
  userId: string;
  channel: string;
  conversationId: string;
  query: string;
}
```

输出：

```ts
export interface RetrievedMemory {
  id: string;
  scope: string;
  type: string;
  content: string;
  summary?: string;
  score: number;
  reason?: string;
}
```

流程：

```text
1. 生成 query embedding
2. pgvector 召回 semantic candidates
3. 补充 tag/entity/importance/recency candidates
4. 合并去重
5. 规则 rerank
6. 应用 memory budget
7. 更新 accessCount / lastAccessedAt
8. 返回最终记忆
```

---

# 17. 混合检索策略

v0.4 不要只做 vector search。

推荐候选来源：

```text
A. Semantic candidates
   pgvector top 30

B. Important candidates
   当前 user/global/project 下 importance >= 8 的 active memories

C. Recent candidates
   最近更新的 project/user memories

D. Tag/entity candidates
   根据 query 中出现的关键词匹配 tags/entities
```

然后合并去重。

---

## 17.1 为什么不能只靠向量

用户可能问：

```text
Dify 那个后来是不是不用了？
```

这类问题，向量能找，但 tags 也很有用。

如果记忆 tags 有：

```json
["Dify", "Core API", "技术选型"]
```

就可以稳定召回。

中文检索里，传统 PostgreSQL full-text search 对中文分词不一定天然好用，所以 v0.4 更建议依赖：

```text
1. embedding 语义检索
2. tags
3. entities
4. type
5. scope
```

不要把中文关键词检索完全交给 `to_tsvector`。

---

# 18. 规则 rerank 设计

v0.4 先不接 rerank model。
先用规则评分。

推荐评分：

```text
final_score =
  0.45 * semantic_score
+ 0.15 * importance_score
+ 0.10 * recency_score
+ 0.15 * type_boost
+ 0.10 * scope_boost
+ 0.05 * confidence_score
```

说明：

```text
semantic_score:
来自 pgvector cosine similarity。

importance_score:
importance / 10。

recency_score:
越新的记忆略微加分，但不要压过语义相关性。

type_boost:
根据当前问题动态加权。

scope_boost:
当前用户记忆、项目记忆、关系记忆按场景加权。

confidence_score:
置信度越高越可信。
```

---

## 18.1 Type boost 示例

如果 query 包含：

```text
“之前说”
“记得”
“我们决定”
“技术方案”
“架构”
“v0.4”
“怎么做”
```

提高：

```text
technical_decision
project_context
```

如果 query 包含：

```text
“我喜欢”
“我不喜欢”
“说话风格”
“别太”
“以后你”
```

提高：

```text
user_preference
persona_feedback
relationship
```

如果 query 包含：

```text
“你是谁”
“你是真人吗”
“能不能装真人”
```

不依赖普通 memory，而是优先系统 prompt / boundary。

---

# 19. Memory Budget 设计

不要把召回的记忆全部塞进 prompt。

建议限制：

```env
MEMORY_FINAL_TOP_K=8
MEMORY_MAX_TOTAL_CHARS=1200
```

分配策略：

```text
project_context / technical_decision：最多 3 条
user_preference / persona_feedback：最多 3 条
relationship：最多 2 条
global / growth_event：最多 2 条
```

如果总字数超过 `MEMORY_MAX_TOTAL_CHARS`：

```text
1. 优先保留 score 高的
2. 优先保留 summary
3. 如果没有 summary，再使用 content 截断
```

Prompt 中建议这样展示：

```text
[Relevant Long-term Memories]
- [project_context | importance=9] v0.4 记忆检索方案确定：SiliconFlow Qwen3-Embedding-4B + pgvector，未来可迁 Qdrant。
- [user_preference | importance=8] 用户不希望陆思源绑定 Dify，而是拥有自己的 Core API。
- [persona_feedback | importance=7] 用户希望陆思源说话自然、轻松，不要太抒情。
```

---

# 20. PromptBuilder 改造

v0.3 的 PromptBuilder 可能是：

```text
persona
core memory
recent messages
simple memories
current user message
```

v0.4 改成：

```text
system prompt
persona files
core_memory.md
boundaries.md
retrieved long-term memories
recent conversation
current message
```

其中 `retrieved long-term memories` 由 `MemoryRetrievalService` 提供。

Prompt 中要明确：

```text
长期记忆是参考信息，不允许覆盖核心身份和边界。
如果长期记忆与核心身份冲突，以核心身份和边界为准。
```

---

# 21. Backfill 脚本

新增：

```text
scripts/backfill-memory-embeddings.ts
```

用途：

```text
给已有 Memory 生成 embedding。
```

流程：

```text
1. 读取所有 status = active 的 Memory
2. 构造 embeddingText
3. 计算 contentHash
4. 检查 MemoryEmbedding 是否已存在且 contentHash 一致
5. 如果一致，跳过
6. 如果不存在或 hash 不一致，调用 SiliconFlow embedding
7. 写入 MemoryEmbedding
8. 打印进度
```

命令：

```bash
pnpm embeddings:backfill
```

`package.json`：

```json
{
  "scripts": {
    "embeddings:backfill": "tsx scripts/backfill-memory-embeddings.ts",
    "embeddings:inspect": "tsx scripts/inspect-memory-retrieval.ts"
  }
}
```

---

# 22. Inspect 检索脚本

新增：

```text
scripts/inspect-memory-retrieval.ts
```

用途：

```text
手动输入一个 query，查看召回了哪些记忆。
```

命令示例：

```bash
pnpm embeddings:inspect "我们为什么不用 Dify？"
```

输出示例：

```text
Query: 我们为什么不用 Dify？

Top memories:
1. score=0.91 type=technical_decision scope=project
   用户不想使用 Dify，希望陆思源拥有自己的 Core API，可以接入 Telegram、Weixin、Web 等渠道。

2. score=0.82 type=project_context scope=project
   v0.1 目标是实现 Lusiyuan Core API，而不是使用 Dify / Coze。

3. score=0.74 type=technical_decision scope=project
   v0.4 记忆检索方案使用 SiliconFlow Qwen3-Embedding-4B + pgvector。
```

这个脚本非常重要。
没有检索调试工具，后面你很难判断“陆思源为什么想起了这个”。

---

# 23. v0.4 数据迁移步骤

## Step 1：安装 pgvector 支持

如果你用 Docker PostgreSQL，建议换成支持 pgvector 的镜像，例如：

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: lusiyuan-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: lusiyuan
      POSTGRES_PASSWORD: password
      POSTGRES_DB: lusiyuan_core
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

如果当前已有数据库，要注意迁移前备份。

---

## Step 2：启用 extension

Prisma migration 中加入 raw SQL：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Step 3：升级 Memory 表

新增字段：

```text
scope
summary
tags
entities
confidence
status
lastAccessedAt
accessCount
channel
conversationId
```

旧数据迁移默认值：

```text
scope = user 或 project
status = active
confidence = 0.8
importance = 原值或 5
```

---

## Step 4：新增 MemoryEmbedding 表

先用 Prisma 创建普通字段，再 raw SQL 添加 vector：

```sql
ALTER TABLE "MemoryEmbedding"
ADD COLUMN "embedding" vector(1024);
```

---

## Step 5：创建索引

普通索引：

```sql
CREATE INDEX IF NOT EXISTS memory_status_scope_type_idx
ON "Memory" ("status", "scope", "type");

CREATE INDEX IF NOT EXISTS memory_user_status_idx
ON "Memory" ("userId", "status");

CREATE INDEX IF NOT EXISTS memory_importance_idx
ON "Memory" ("importance");
```

向量索引：

```sql
CREATE INDEX IF NOT EXISTS memory_embedding_hnsw_idx
ON "MemoryEmbedding"
USING hnsw (embedding vector_cosine_ops)
WHERE
  provider = 'siliconflow'
  AND model = 'Qwen/Qwen3-Embedding-4B'
  AND dimensions = 1024;
```

如果数据很少，可以推迟创建 HNSW。

---

## Step 6：运行 backfill

```bash
pnpm embeddings:backfill
```

---

## Step 7：启用新检索

`.env`：

```env
MEMORY_RETRIEVAL_ENABLED=true
MEMORY_VECTOR_INDEX_PROVIDER=pgvector
```

---

# 24. Qdrant 迁移路线

v0.4 先不用 Qdrant，但文档和代码要为它留好位置。

## 24.1 未来 Qdrant 架构

未来变成：

```text
PostgreSQL
  users
  conversations
  messages
  memories
  memory metadata

Qdrant
  memory_id
  embedding vector
  payload:
    user_id
    scope
    type
    status
    importance
    tags
    provider
    model
    dimensions
```

检索流程：

```text
用户消息
↓
生成 query embedding
↓
Qdrant 搜 top 30 memory_id
↓
回 PostgreSQL 查完整 Memory
↓
MemoryReranker 规则重排
↓
MemoryBudgetController 控制数量
↓
PromptBuilder
```

PostgreSQL 仍然是主库。
Qdrant 只是索引。

---

## 24.2 为什么 Qdrant 只做索引

不要把 Qdrant 当主库。

原因：

```text
1. 用户、会话、消息、记忆状态仍然适合存在 PostgreSQL
2. Qdrant 擅长相似度搜索和 payload filtering
3. PostgreSQL 更适合关系数据、事务、审计和备份
4. Qdrant 索引可以从 PostgreSQL 重建
```

Qdrant 官方也强调它支持 vector search，并通过 payload indexes 加速过滤。([qdrant.tech][3])

---

## 24.3 迁移脚本设计

未来新增：

```text
scripts/sync-memory-embeddings-to-qdrant.ts
```

流程：

```text
1. 从 PostgreSQL 读取 active Memory + MemoryEmbedding
2. 构造 Qdrant point
3. point id = memory.id
4. vector = MemoryEmbedding.embedding
5. payload = userId / scope / type / status / importance / tags / provider / model / dimensions
6. upsert 到 Qdrant collection
7. 校验数量
```

Qdrant point 示例：

```json
{
  "id": "memory_cuid_xxx",
  "vector": [0.01, -0.02, 0.03],
  "payload": {
    "memory_id": "memory_cuid_xxx",
    "user_id": "user_cuid_xxx",
    "scope": "project",
    "type": "technical_decision",
    "status": "active",
    "importance": 9,
    "tags": ["v0.4", "pgvector", "Qdrant"],
    "provider": "siliconflow",
    "model": "Qwen/Qwen3-Embedding-4B",
    "dimensions": 1024
  }
}
```

---

## 24.4 切换方式

`.env`：

```env
MEMORY_VECTOR_INDEX_PROVIDER=pgvector
```

未来切：

```env
MEMORY_VECTOR_INDEX_PROVIDER=qdrant
QDRANT_ENABLED=true
QDRANT_URL="http://localhost:6333"
QDRANT_COLLECTION="lusiyuan_memories"
```

代码层：

```ts
const vectorIndex =
  env.MEMORY_VECTOR_INDEX_PROVIDER === "qdrant"
    ? new QdrantMemoryIndex(...)
    : new PgVectorMemoryIndex(...);
```

上层不变：

```ts
memoryRetrievalService.retrieve(...)
```

---

# 25. v0.4 不做什么

v0.4 不做：

```text
1. 不接 Mem0
2. 不接 Letta
3. 不接 Qdrant 实际服务
4. 不做 AB 测试
5. 不接 Qwen3-VL-Embedding
6. 不做图片/视频素材检索
7. 不做 rerank model
8. 不做复杂知识库 RAG
9. 不做前端记忆编辑后台
```

v0.4 只做：

```text
文本长期记忆的 pgvector 语义检索升级。
```

---

# 26. 验收标准

v0.4 完成后，应满足：

```text
1. 系统可以调用 SiliconFlow Qwen/Qwen3-Embedding-4B 生成 1024 维 embedding
2. Memory 表升级为结构化记忆
3. MemoryEmbedding 表可以保存 embedding
4. pgvector extension 正常启用
5. backfill 脚本可以给旧 memory 补 embedding
6. 用户发消息时，会生成 query embedding
7. MemoryRetrievalService 可以召回语义相关记忆
8. 检索时只使用 provider/model/dimensions 匹配的 embedding
9. user scope 不会泄漏到其他用户
10. archived/rejected/superseded 默认不召回
11. Prompt 中最多放入 MEMORY_FINAL_TOP_K 条记忆
12. Prompt 中记忆总字数不超过 MEMORY_MAX_TOTAL_CHARS
13. Telegram / Weixin / Web 共用同一套记忆检索逻辑
14. 原有 /v1/chat 仍然正常
15. inspect 脚本能查看检索结果
```

---

# 27. 推荐测试问题

在你已有的记忆里，至少准备这些问题测试：

```text
1. 我们为什么不想用 Dify？
2. 陆思源 Core API v0.1 做了什么？
3. v0.2 接入了哪些聊天渠道？
4. 微信接入是怎么做的？
5. 网页版我们决定用什么技术？
6. 记忆检索为什么选择 pgvector？
7. embedding 为什么用 Qwen3-Embedding-4B？
8. 以后如果记忆变大，准备迁到哪里？
9. 陆思源能不能装真人？
10. 我之前希望陆思源说话风格是什么样？
```

理想表现：

```text
1. 能召回正确的 technical_decision / project_context
2. 不召回无关高 importance 记忆
3. 不把其他用户记忆召回
4. 不让普通记忆覆盖核心边界
```

---

# 28. 给 Codex 的开发指令

可以把下面这段直接给 Codex。

```text
请在现有 lusiyuan-core v0.3 项目基础上实现 v0.4：长期记忆检索升级。

当前项目已有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- /v1/chat
- Telegram Adapter
- Weixin Bridge
- React + Vite Web Chat
- Memory 表
- memory-extractor.ts
- memory.service.ts
- prompt-builder.ts

v0.4 目标：
使用 SiliconFlow 上的 Qwen/Qwen3-Embedding-4B 生成文本 embedding，并使用 PostgreSQL + pgvector 做长期记忆语义检索。当前不接 Qdrant，但需要抽象接口，方便未来迁移 Qdrant。

技术要求：
- Embedding Provider：SiliconFlow
- Embedding Model：Qwen/Qwen3-Embedding-4B
- Embedding Dimensions：1024
- Vector Store：PostgreSQL + pgvector
- ORM：Prisma
- pgvector 查询可以使用 raw SQL
- 不接 Mem0 / Letta / Qdrant
- 不做 AB 测试
- 不接 Qwen3-VL-Embedding

请完成以下任务：

1. 更新 .env.example，增加：
   - EMBEDDING_PROVIDER="siliconflow"
   - EMBEDDING_BASE_URL="https://api.siliconflow.cn/v1"
   - EMBEDDING_API_KEY=""
   - EMBEDDING_MODEL="Qwen/Qwen3-Embedding-4B"
   - EMBEDDING_DIMENSIONS=1024
   - MEMORY_RETRIEVAL_ENABLED=true
   - MEMORY_SEMANTIC_TOP_K=30
   - MEMORY_FINAL_TOP_K=8
   - MEMORY_MAX_TOTAL_CHARS=1200
   - MEMORY_VECTOR_INDEX_PROVIDER="pgvector"
   - QDRANT_ENABLED=false
   - QDRANT_URL=""
   - QDRANT_API_KEY=""
   - QDRANT_COLLECTION="lusiyuan_memories"

2. 升级 Prisma schema：
   - Memory 表增加：
     - scope String
     - conversationId String?
     - channel String?
     - summary String?
     - tags Json?
     - entities Json?
     - confidence Float @default(0.8)
     - status String @default("active")
     - lastAccessedAt DateTime?
     - accessCount Int @default(0)
   - 新增 MemoryEmbedding 表：
     - id
     - memoryId
     - provider
     - model
     - dimensions
     - contentHash
     - createdAt
     - updatedAt
     - relation to Memory
     - unique(memoryId, provider, model, dimensions)
   - 使用 raw SQL migration：
     - CREATE EXTENSION IF NOT EXISTS vector;
     - ALTER TABLE "MemoryEmbedding" ADD COLUMN "embedding" vector(1024);

3. 创建 pgvector 索引：
   - 普通 Memory 索引：
     - status/scope/type
     - userId/status
     - importance
   - 向量索引：
     - HNSW cosine index on MemoryEmbedding.embedding
     - where provider='siliconflow' and model='Qwen/Qwen3-Embedding-4B' and dimensions=1024

4. 新增 src/embeddings/：
   - embedding-provider.ts
   - siliconflow-embedding-provider.ts
   - embedding-config.ts
   - embedding-text.ts
   - content-hash.ts

5. EmbeddingProvider 接口：
   - embedText(text: string): Promise<number[]>
   - embedTexts(texts: string[]): Promise<number[][]>

6. SiliconFlowEmbeddingProvider：
   - 调用 POST ${EMBEDDING_BASE_URL}/embeddings
   - headers 使用 Authorization: Bearer ${EMBEDDING_API_KEY}
   - body 包含 model、input、dimensions
   - 返回 embedding 数组
   - 处理错误状态码

7. buildMemoryEmbeddingText(memory)：
   - 使用 type、scope、content、summary、tags、entities 组成 embedding 文本
   - 不要只 embed content

8. createMemoryContentHash(text)：
   - 使用 sha256
   - 用于判断是否需要重新 embedding

9. 新增 src/vector-index/：
   - vector-memory-index.ts
   - pgvector-memory-index.ts
   - qdrant-memory-index.placeholder.ts

10. VectorMemoryIndex 接口：
   - upsertMemoryEmbedding()
   - searchSimilarMemories()
   - deleteMemoryEmbedding()

11. PgVectorMemoryIndex：
   - 使用 Prisma raw SQL 写入 / 更新 MemoryEmbedding.embedding
   - 使用 cosine distance <=> 做语义检索
   - 检索时必须限定 provider/model/dimensions
   - 检索时只召回 status='active'
   - user/relationship scope 只能召回当前 userId
   - global/project scope 可以召回

12. 新增 memory-retrieval.service.ts：
   - 输入 userId、channel、conversationId、query
   - 生成 query embedding
   - pgvector topK semantic search
   - 合并 important/recent/tag candidates
   - 调用 memory-reranker
   - 调用 memory-budget
   - 更新 accessCount 和 lastAccessedAt
   - 返回最终 RetrievedMemory[]

13. 新增 memory-reranker.ts：
   - 用规则计算 final_score
   - 权重：
     - semantic_score 0.45
     - importance_score 0.15
     - recency_score 0.10
     - type_boost 0.15
     - scope_boost 0.10
     - confidence_score 0.05
   - 不使用外部 rerank model

14. 新增 memory-budget.ts：
   - 最多返回 MEMORY_FINAL_TOP_K 条
   - 总字数不超过 MEMORY_MAX_TOTAL_CHARS
   - 优先使用 summary
   - 超长时截断
   - 控制不同 type 的数量，避免单类记忆占满 prompt

15. 改造 memory-extractor.ts：
   - 输出 memory 时增加：
     - scope
     - summary
     - tags
     - entities
     - confidence
     - status 默认 active
   - 写入 Memory 后自动生成 embedding 并写入 MemoryEmbedding

16. 改造 prompt-builder.ts：
   - 使用 MemoryRetrievalService 返回的相关长期记忆
   - 在 prompt 中说明：
     - 长期记忆是参考信息
     - 长期记忆不能覆盖 core_memory 和 boundaries
   - 只放 budget 后的记忆

17. 改造 chat.service.ts：
   - 在生成回复前调用 MemoryRetrievalService
   - 替换旧的按 importance / updatedAt 简单取 memory 逻辑
   - Telegram / Weixin / Web 都复用同一套检索逻辑

18. 新增 scripts/backfill-memory-embeddings.ts：
   - 读取 active memories
   - 构建 embedding text
   - 计算 contentHash
   - 如果已有同 provider/model/dimensions 且 hash 相同则跳过
   - 否则调用 SiliconFlow 生成 embedding
   - 写入 MemoryEmbedding
   - 打印进度

19. 新增 scripts/inspect-memory-retrieval.ts：
   - 命令行输入 query
   - 调用 MemoryRetrievalService
   - 输出召回 memory 的 id、score、scope、type、summary/content
   - 用于调试检索质量

20. 更新 package.json scripts：
   - "embeddings:backfill": "tsx scripts/backfill-memory-embeddings.ts"
   - "embeddings:inspect": "tsx scripts/inspect-memory-retrieval.ts"

21. 新增 docs/memory-retrieval-v0.4.md：
   - 说明为什么选择 SiliconFlow Qwen/Qwen3-Embedding-4B
   - 说明为什么 dimensions 使用 1024
   - 说明为什么使用 pgvector
   - 说明 Memory 和 MemoryEmbedding 的区别
   - 说明未来 Qdrant 迁移路线
   - 说明如何运行 backfill
   - 说明如何调试检索

限制：
- 不要接 OpenAI embedding
- 不要接 Mem0
- 不要接 Letta
- 不要实际接入 Qdrant
- 不要接 Qwen3-VL-Embedding
- 不要做图片/视频素材检索
- 不要做 rerank model
- 不要把 SiliconFlow API Key 暴露到前端
- 不要让普通 Memory 覆盖陆思源核心身份和边界

验收：
- 可以成功调用 SiliconFlow Qwen/Qwen3-Embedding-4B 获取 1024 维 embedding
- 可以将 embedding 写入 PostgreSQL pgvector
- 可以通过 pgvector 按语义召回相关长期记忆
- 可以运行 backfill 给旧 memory 补 embedding
- 可以运行 inspect 脚本查看检索结果
- /v1/chat 使用新的 MemoryRetrievalService
- Telegram / Weixin / Web 原有功能不受影响
```

---

# 29. 最终建议

v0.4 的最终技术路线就是：

```text
SiliconFlow Qwen/Qwen3-Embedding-4B
+ 1024 dimensions
+ PostgreSQL
+ pgvector
+ structured Memory schema
+ hybrid retrieval
+ rule-based rerank
+ memory budget
+ Qdrant-ready interface
```

这版做完后，陆思源的记忆系统就会从：

```text
按重要度随便想起几条
```

升级成：

```text
根据当前语境，找回真正相关的长期记忆
```

而且以后如果记忆规模变大，不需要推倒重来。你只需要新增：

```text
QdrantMemoryIndex
sync-memory-embeddings-to-qdrant.ts
MEMORY_VECTOR_INDEX_PROVIDER=qdrant
```

PostgreSQL 仍然保留为主库，Qdrant 只作为更强的向量索引层。

[1]: https://docs.siliconflow.com/cn/api-reference/embeddings/create-embeddings?utm_source=chatgpt.com "创建嵌入请求"
[2]: https://github.com/pgvector/pgvector?utm_source=chatgpt.com "pgvector/pgvector: Open-source vector similarity search for ..."
[3]: https://qdrant.tech/documentation/manage-data/indexing/?utm_source=chatgpt.com "Indexing"
[4]: https://www.prisma.io/docs/postgres/database/postgres-extensions?utm_source=chatgpt.com "Postgres extensions | Prisma Documentation"
[5]: https://docs.siliconflow.cn/cn/api-reference/embeddings/create-embeddings?utm_source=chatgpt.com "创建嵌入请求 - SiliconFlow"
