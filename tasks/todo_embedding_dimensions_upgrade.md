# Todo: 升级 embedding 维度（1024 → 2048/2560）

当前维度：1024
目标维度：2048 或 2560（Qwen3-Embedding-4B 最高支持 2560）

## 什么时候做

当发现中文语义召回质量不够好时考虑升级。
对于记忆条数 < 1 万的规模，1024 通常已经足够。

## 需要改的地方（按顺序）

### 1. `.env`

```env
EMBEDDING_DIMENSIONS=2560
```

### 2. 新建 Prisma migration

需要手写 SQL migration，不能自动生成（Prisma 不支持 vector 类型）：

```sql
-- 删除旧 HNSW 索引
DROP INDEX IF EXISTS "memory_embedding_hnsw_idx";

-- 删除旧向量列，新建新维度列
ALTER TABLE "MemoryEmbedding" DROP COLUMN "embedding";
ALTER TABLE "MemoryEmbedding" ADD COLUMN "embedding" vector(2560);

-- 重建 HNSW 索引（改 dimensions 条件）
CREATE INDEX "memory_embedding_hnsw_idx"
  ON "MemoryEmbedding"
  USING hnsw (embedding vector_cosine_ops)
  WHERE provider = 'siliconflow'
    AND model = 'Qwen/Qwen3-Embedding-4B'
    AND dimensions = 2560;
```

文件路径命名示例：
```
prisma/migrations/YYYYMMDDHHMMSS_upgrade_embedding_dimensions/migration.sql
```

### 3. 清空旧 MemoryEmbedding 数据

旧的 1024 维向量不能和新的 2560 维共存（列宽不同），migration 里 DROP COLUMN 已经处理了。
但如果想保留旧记录作为对比，可以先备份：

```sql
-- 备份（可选）
CREATE TABLE "MemoryEmbedding_backup_1024" AS SELECT * FROM "MemoryEmbedding";
```

### 4. 重跑 backfill

```bash
pnpm embeddings:backfill
```

backfill 脚本会按 provider/model/dimensions 判断是否需要重新生成，
因为 dimensions 变了，所有记忆都会重新调用 SiliconFlow API。

### 5. 验证

```bash
pnpm embeddings:inspect "测试查询" <userId>
```

确认能正常召回且 score 合理（通常 > 0.7 算相关）。

## 注意事项

- 改维度必须重跑 backfill，不能只改 `.env` 就完事
- migration 执行后旧 embedding 全部失效，在 backfill 完成前检索会回退到 importance/recency 排序（因为没有 embedding 可用）
- backfill 期间建议暂停新记忆写入，避免混乱（或者接受短暂的检索质量下降）
- SiliconFlow 2560 维调用会消耗更多 token，注意 API 费用
