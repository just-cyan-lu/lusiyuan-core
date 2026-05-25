# Memory Retrieval v0.4

## 为什么选 SiliconFlow Qwen/Qwen3-Embedding-4B

- 中文语义理解强，适合陆思源以中文为主的对话场景
- SiliconFlow 国内访问稳定，延迟低
- 1024 维在检索质量和存储成本之间平衡良好
- 免费额度足够早期使用

## 为什么 dimensions=1024

- Qwen3-Embedding 支持 matryoshka 多尺寸（256/512/1024）
- 1024 在语义保真度和 HNSW 索引性能之间取得平衡
- 后续如果要降低成本，可以迁到 512 并重新 backfill

## 为什么用 pgvector

- 无需引入新基础设施，PostgreSQL 已经是主库
- pgvector 对千条级别记忆检索性能足够
- Prisma 可以用 `$queryRaw` 直接执行向量查询
- 如果未来记忆量级变大，可以平滑迁移到 Qdrant（接口已抽象）

## Memory 与 MemoryEmbedding 的关系

```
Memory        — 主数据，记录记忆内容、类型、重要度、状态等
MemoryEmbedding — 索引，存储向量 + provider/model/dimensions/contentHash
```

- Memory 是事实来源（source of truth）
- MemoryEmbedding 可以随时从 Memory 重建
- 一条 Memory 可以有多个 MemoryEmbedding（不同 provider/model）
- 当 Memory.content 变更时，通过 contentHash 判断是否需要重新 embed

## 未来 Qdrant 迁移路线

当记忆量级超过 ~10 万条时，pgvector 的 HNSW 索引性能仍然足够，但如果有更高吞吐或多租户需求，可以迁移到 Qdrant：

1. 在 `src/vector-index/` 新增 `QdrantMemoryIndex` 实现 `VectorMemoryIndex` 接口
2. 运行 `scripts/sync-memory-embeddings-to-qdrant.ts`（待写）将现有向量同步到 Qdrant
3. 将 `.env` 中 `MEMORY_VECTOR_INDEX_PROVIDER` 改为 `qdrant`

PostgreSQL 仍然是主库，Qdrant 只做向量索引层。

## 如何运行 backfill

给已有 Memory 补充 embedding：

```bash
# 确保 EMBEDDING_API_KEY 和 MEMORY_RETRIEVAL_ENABLED=true 已配置
pnpm embeddings:backfill
```

输出含义：
- `.` — 已有相同 hash，跳过
- `+` — 新建或更新 embedding
- `!` — 失败（见错误日志）

## 如何调试检索

```bash
pnpm embeddings:inspect "我们为什么不用 Dify？" <userId>
```

如果不传 userId，会列出数据库中已有的用户。

输出示例：

```
Query: 我们为什么不用 Dify？
UserId: clxxx...

Top 3 memories:

1. score=0.847 type=technical_decision scope=project
   用户不想使用 Dify，希望陆思源拥有自己的 Core API

2. score=0.791 type=project_context scope=project
   v0.1 目标是实现 Lusiyuan Core API，而不是使用 Dify / Coze
```

## 检索流程

```
用户消息
↓
SiliconFlow Qwen3-Embedding-4B → query embedding
↓
pgvector cosine search → top 30 语义候选
↓
合并 top-5 高重要度 + top-3 最近记忆（去重）
↓
MemoryReranker 规则重排（semantic 0.45 + importance 0.15 + recency 0.10 + type 0.15 + scope 0.10 + confidence 0.05）
↓
MemoryBudgetController（最多 8 条，总字数 ≤ 1200，单类型上限）
↓
注入 prompt
```
