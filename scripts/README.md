# Scripts

这个目录放的是开发、调试、补数据和后台任务相关脚本。

默认都从项目根目录执行。命令示例用 `npm run ...`，如果你习惯 `pnpm`，同名脚本也可以用 `pnpm ...` 跑。

## 快速判断

| 脚本 | 常用命令 | 会写数据库 | 用途 |
| --- | --- | --- | --- |
| `seed-relationship-conversations.ts` | `npm run seed:relationships` | 是 | 创建关系/身份/对话测试数据。会先清掉自己创建的那批测试数据再重建。 |
| `seed-admin-demo.ts` | `npm run seed:admin` | 是 | 创建 Admin 演示数据，包含用户、消息、记忆、Dream、记忆提案等。 |
| `ensure-pgvector-indexes.ts` | `npm run db:push` 后自动跑 | 是 | 确保 pgvector 扩展和 HNSW 索引存在。 |
| `backfill-memory-embeddings.ts` | `npm run embeddings:backfill` | 是 | 给已有长期记忆补 embedding。 |
| `backfill-message-embeddings.ts` | `npm run context:index -- 500` | 是 | 给历史聊天消息补 embedding，用于旧原文召回。 |
| `inspect-memory-retrieval.ts` | `npm run embeddings:inspect -- "问题" <userId>` | 否 | 调试某个用户的记忆检索结果。 |
| `apply-memory-proposals.ts` | `npm run memory:apply-proposals -- --proposal=<id>` | 是 | 应用记忆提案；也可批量应用已批准提案。 |
| `run-dream.ts` | `npm run dream:run` | 是 | 手动触发一次 Dream Cycle。 |
| `inspect-dream-job.ts` | `npm run dream:inspect -- --latest` | 否 | 查看 Dream Job、daily note、signals、diary、report 和 morning brief。 |
| `inspect-dream-diary.ts` | `npm run dream:diary -- --limit=5` | 否 | 查看 Dream Diary。 |
| `cleanup-dream-locks.ts` | `npm run dream:cleanup-locks` | 是 | 手动清空 Dream 锁。只在 Dream 卡住或测试时用。 |
| `inspect-tools.ts` | `npm run tools:inspect` | 否 | 查看当前注册工具、启用状态、风险等级和 owner-only 状态。 |
| `smoke-test.ts` | `npm run smoke` | 通常否 | 跑基础冒烟测试；如果启用真实聊天，会写聊天数据。 |
| `start-telegram.ts` | `npm run telegram:dev` | 运行时写 | 单独启动 Telegram bot 长轮询。现在更推荐主服务里用 `TELEGRAM_ENABLED=true`。 |

## 测试数据脚本

### `seed-relationship-conversations.ts`

创建用于测试“多个渠道账号属于同一个现实身份”的数据。

会创建：

- 4 个现实身份。
- 9 个渠道用户。
- 6 条身份链接。
- 9 段对话。
- 36 条消息。
- 4 条关系状态。
- 9 条运行事件。

其中：

- `林夏` 同时有 `web:*` 和 `telegram:*` 两个账号。
- `阿澈` 同时有 `web:*` 和 `xiaohongshu:*` 两个账号。
- `小雨` 是单渠道微信身份。
- `Cyan / Owner` 是 `web:owner` 测试身份。
- 另有 3 个未归属身份的 user：只有账号、对话和运行事件，没有现实身份、身份链接和关系状态。

命令：

```bash
npm run seed:relationships
```

这个脚本是幂等的：每次运行会先删除自己创建过的测试账号、身份、对话、关系和相关运行事件，再重新创建。

### `seed-admin-demo.ts`

创建 Admin 演示数据，用于看后台页面是否有内容可展示。

它会创建或重建一批固定 ID 的演示数据，包括：

- demo user。
- demo conversation 和消息。
- user/global memory。
- Dream job、daily note、signals、diary、consolidation report。
- memory proposals。

命令：

```bash
npm run seed:admin
```

这个脚本也会先清理自己创建过的 admin demo 数据。

## 数据库与向量索引

### `ensure-pgvector-indexes.ts`

确保 PostgreSQL 里启用了 `vector` 扩展，并创建：

- `memory_embeddings_hnsw_idx`
- `message_embeddings_hnsw_idx`

一般不用单独跑，因为 `db:push` 已经串了它：

```bash
npm run db:push
```

如果你手动 reset 过数据库，或者发现 pgvector 索引缺失，可以直接跑：

```bash
npx tsx scripts/ensure-pgvector-indexes.ts
```

## Embedding 与上下文召回

### `backfill-memory-embeddings.ts`

给已有 active 长期记忆补 embedding，用于语义记忆检索。

命令：

```bash
npm run embeddings:backfill
```

需要 `.env` 里配置好 embedding 连接，比如 `EMBEDDING_BASE_URL`、`EMBEDDING_API_KEY`、`EMBEDDING_MODEL`、`EMBEDDING_DIMENSIONS`。

### `inspect-memory-retrieval.ts`

调试某个用户在某个 query 下会召回哪些记忆。

命令：

```bash
npm run embeddings:inspect -- "你想查的问题" <userId>
```

如果不传 `userId`，脚本会列出一批可用用户。

### `backfill-message-embeddings.ts`

给历史聊天消息补 embedding，用于聊天上下文里的“旧原文向量召回”。

命令：

```bash
npm run context:index -- 500
```

参数是最多扫描多少条消息，默认 `300`，最大 `2000`。

新消息会在聊天后自动维护索引；这个脚本主要用于旧数据补索引。

## Dream

### `run-dream.ts`

手动触发一次 Dream Cycle。

命令：

```bash
npm run dream:run
```

可指定用户：

```bash
npm run dream:run -- --user-id=<userId>
```

这个脚本会写入 Dream job、daily note、signals、diary、consolidation report、提案等数据，也可能触发关系好感度整理和运行态摘要更新。

### `inspect-dream-job.ts`

查看 Dream Job 的详细结果。

命令：

```bash
npm run dream:inspect -- --latest
npm run dream:inspect -- --job=<jobId>
```

会打印：

- job 状态和阶段。
- daily note。
- dream signals。
- diary。
- consolidation report。
- morning brief。

### `inspect-dream-diary.ts`

查看 Dream Diary。

命令：

```bash
npm run dream:diary -- --limit=5
```

`--latest` 参数目前不会改变查询逻辑，实际按日期倒序取 `--limit` 条。

### `cleanup-dream-locks.ts`

清空 `dream_locks`。

命令：

```bash
npm run dream:cleanup-locks
```

只有在开发测试时 Dream 锁卡住、或者确认没有 Dream 正在跑时才用。它会删除所有 Dream 锁。

## 记忆提案

### `apply-memory-proposals.ts`

应用记忆提案。

查看待处理提案：

```bash
npm run memory:apply-proposals
```

应用单条：

```bash
npm run memory:apply-proposals -- --proposal=<proposalId>
```

应用所有已批准提案：

```bash
npm run memory:apply-proposals -- --approved
```

指定 reviewer：

```bash
npm run memory:apply-proposals -- --proposal=<proposalId> --reviewer=<name>
```

这个脚本会改写记忆和提案状态。

## 工具与渠道

### `inspect-tools.ts`

查看当前注册的工具。

命令：

```bash
npm run tools:inspect
```

会显示：

- 工具名。
- enabled/disabled。
- 风险等级。
- 是否 owner-only。
- 工具描述。

### `start-telegram.ts`

单独启动 Telegram bot 长轮询。

命令：

```bash
npm run telegram:dev
```

需要 `.env` 配置 `TELEGRAM_BOT_TOKEN`。

现在更推荐启动主服务，并在设置里开启 `TELEGRAM_ENABLED`；这个脚本主要用于单独调试 Telegram。

## 冒烟测试

### `smoke-test.ts`

检查本地服务、数据库、pgvector、admin API 和可选聊天链路。

命令：

```bash
npm run smoke
```

常用环境变量：

- `SMOKE_BASE_URL`：默认 `http://localhost:${PORT}`。
- `SMOKE_ADMIN_TOKEN`：默认读取 `ADMIN_API_TOKEN`。
- `SMOKE_REQUIRE_ADMIN_TOKEN=true`：没有 admin token 时直接失败。
- `SMOKE_RUN_CHAT=true`：真的调用聊天接口，会写聊天数据并消耗模型额度。
- `SMOKE_USER_ID`、`SMOKE_CONVERSATION_ID`：指定冒烟聊天使用的用户和会话。
- `SMOKE_TIMEOUT_MS`：请求超时时间，默认 `15000`。

默认不会跑真实聊天。

## 什么时候不要随便跑

- 不确定 Dream 是否正在运行时，不要跑 `dream:cleanup-locks`。
- 不想写数据库时，不要跑 seed、Dream、embedding backfill、memory apply。
- 不想消耗模型额度时，不要跑 `dream:run`，也不要设置 `SMOKE_RUN_CHAT=true`。
- 不想消耗 embedding 额度时，不要跑 `embeddings:backfill` 或 `context:index`。
