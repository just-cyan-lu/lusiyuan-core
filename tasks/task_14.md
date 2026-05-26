v1.4 我建议做：

```text
task_14 / v1.4：Advanced Memory Scale-out
长期记忆与资产检索规模化
```

中文名可以叫：

```text
陆思源高级记忆系统与向量检索扩展
```

一句话：

```text
把陆思源的记忆、素材、内容、梦境、声音、外部反馈，升级成更强、更快、更可控的长期检索系统。
```

---

# 为什么 v1.4 该做这个？

前面到 v1.3，陆思源已经有很多东西了：

```text
长期文本记忆
Dream Diary
Reflection Report
Content Ops
Asset Memory
Voice Asset
External Inbox
Publishing Record
Eval Report
```

这些数据会越来越多。

刚开始用：

```text
PostgreSQL + pgvector
```

完全够。

但后面会遇到问题：

```text
1. 记忆越来越多，检索变慢
2. 图片、音频、内容、外部反馈都要检索
3. 不同类型数据需要不同检索策略
4. pgvector 和业务主库混在一起，维护压力变大
5. 需要更复杂的过滤，比如按类型、时间、分数、来源、风险等级筛选
6. 需要做记忆去重、合并、过期、冲突处理
7. 需要评估检索质量，而不是只看“能搜到”
```

所以 v1.4 不是单纯“换 Qdrant”，而是：

```text
长期记忆系统规模化
+
检索质量提升
+
Qdrant 迁移预留或正式接入
+
记忆治理
```

---

# v1.4 的核心定位

我建议 v1.4 不要叫简单的：

```text
Qdrant Migration
```

因为这太窄了。

更准确应该是：

```text
Advanced Memory Scale-out
```

也就是：

```text
1. 继续保留 PostgreSQL 作为主库
2. 把向量索引抽象出来
3. 支持 pgvector / Qdrant 可切换
4. 做记忆质量治理
5. 做多类型检索
6. 做检索评测
```

核心原则是：

```text
PostgreSQL 管事实和业务数据。
Qdrant 管大规模向量检索。
```

不是：

```text
Qdrant 替代 PostgreSQL。
```

---

# v1.4 要做哪些功能？

## 1. VectorIndex 抽象层

现在可能是：

```text
MemoryEmbedding → pgvector
AssetEmbedding → pgvector
```

v1.4 要抽象成：

```text
VectorIndexProvider
├── PgvectorIndexProvider
└── QdrantIndexProvider
```

这样以后可以配置：

```env
VECTOR_INDEX_PROVIDER=pgvector
```

或者：

```env
VECTOR_INDEX_PROVIDER=qdrant
```

业务层不要直接依赖 pgvector。

---

## 2. Qdrant 接入

v1.4 可以正式接 Qdrant，但建议分阶段。

第一阶段：

```text
只接 MemoryEmbedding
```

第二阶段：

```text
接 AssetEmbedding
```

第三阶段：

```text
接 Content / Voice / External Inbox
```

Qdrant collection 可以这样设计：

```text
lusiyuan_memories
lusiyuan_assets
lusiyuan_content
lusiyuan_external_feedback
```

不要一开始全塞一个 collection。

---

## 3. 双写与回填

迁移时不能直接停系统。

要做：

```text
1. PostgreSQL 仍然保存 Memory 本体
2. pgvector 继续可用
3. Qdrant 新建索引
4. backfill 历史 embedding 到 Qdrant
5. 新数据可以双写 pgvector + Qdrant
6. 验证检索结果
7. 再切换默认检索 provider
```

也就是：

```text
先双写
再对比
最后切换
```

不要一上来直接替换。

---

## 4. Memory Governance 记忆治理

这是 v1.4 的重点之一。

随着记忆增多，需要处理：

```text
重复记忆
过期记忆
冲突记忆
低质量记忆
敏感记忆
临时记忆误入长期库
```

新增功能：

```text
MemoryDedupService
MemoryMergeService
MemoryDecayService
MemoryConflictDetector
MemoryQualityScorer
MemoryArchivePolicy
```

简单说就是：

```text
不是记得越多越好，而是记得更干净。
```

---

## 5. Hybrid Search 混合检索

现在可能主要是：

```text
向量相似度检索
```

v1.4 应该做混合检索：

```text
向量检索
+
关键词检索
+
结构化过滤
+
时间权重
+
重要度权重
+
用户/项目/角色 scope
```

比如用户问：

```text
我们之前为什么不用 Dify？
```

系统应该优先搜：

```text
type = technical_decision
tags contains Dify
status = active
importance high
```

而不是只靠向量相似度。

---

## 6. Retrieval Policy 检索策略

不同场景要用不同检索策略。

比如：

```text
聊天回复：
检索用户相关记忆 + 陆思源核心人设 + 最近上下文

Creator Assistant：
检索项目决策 + 版本路线 + todo

Reflection：
检索相关旧记忆 + 最近对话

Dream：
检索近期事件 + 反复主题

Content Ops：
检索内容选题 + 发布记录 + 素材

Voice：
检索声音风格设定 + 音色审核记录
```

v1.4 要把这些策略配置化。

---

## 7. Retrieval Evaluation 检索评测

v1.3 做人格评测。
v1.4 应该做检索评测。

测试问题比如：

```text
我们为什么不用 Dify？
v0.75 是做什么的？
OpenClaw 在系统里的定位是什么？
Dream Cycle 会不会直接写 Memory？
陆思源为什么不能装真人？
v1.2 为什么不做实时直播？
```

评测：

```text
1. 是否检索到正确记忆
2. 排名是否靠前
3. 是否召回过期记忆
4. 是否召回冲突记忆
5. 最终回答是否引用了正确上下文
```

这很重要。

否则你不知道：

```text
陆思源答错，是模型问题？
还是检索没搜到？
还是记忆本身脏了？
```

---

# v1.4 推荐模块

```text
src/vector/
├── vector-index-provider.ts
├── pgvector-index-provider.ts
├── qdrant-index-provider.ts
├── vector-index-router.ts
├── vector-sync.service.ts
├── vector-backfill.service.ts
└── vector.types.ts

src/memory-governance/
├── memory-quality.service.ts
├── memory-dedup.service.ts
├── memory-merge.service.ts
├── memory-conflict.service.ts
├── memory-decay.service.ts
├── memory-archive.service.ts
└── memory-governance.types.ts

src/retrieval/
├── retrieval-policy.service.ts
├── hybrid-retrieval.service.ts
├── retrieval-reranker.service.ts
├── retrieval-eval.service.ts
└── retrieval.types.ts
```

---

# v1.4 新增后台页面

在 Admin 里新增：

```text
/admin/memory-scale
/admin/vector-index
/admin/memory-governance
/admin/retrieval-eval
```

页面功能：

```text
1. 查看当前向量索引 provider
2. 查看 pgvector / Qdrant 状态
3. 手动触发 backfill
4. 查看双写状态
5. 查看检索测试结果
6. 查看重复记忆
7. 查看冲突记忆
8. 查看低质量记忆
9. 批量归档 / 合并 / supersede
```

这会很有用。

---

# v1.4 不做什么？

不要过度设计。

v1.4 不做：

```text
1. 不重写整个 Memory 系统
2. 不让 Qdrant 取代 PostgreSQL 主库
3. 不做复杂知识图谱
4. 不做自动删除记忆
5. 不做自动合并高风险记忆
6. 不做多租户大规模商业化
7. 不强制迁移所有数据到 Qdrant
```

v1.4 要稳一点：

```text
先抽象
再双写
再回填
再评测
最后切换
```

---

# v1.4 最小可行版本 MVP

我建议 MVP 做这些：

```text
1. VectorIndexProvider 抽象
2. PgvectorIndexProvider 保持现状
3. QdrantIndexProvider 接入
4. MemoryEmbedding 支持写入 Qdrant
5. 历史 Memory backfill 到 Qdrant
6. 检索时支持 pgvector / qdrant 配置切换
7. 增加 Hybrid Search
8. 增加 MemoryQualityScore
9. 增加重复记忆检测
10. 增加 Retrieval Eval
11. Admin 页面显示索引状态和评测结果
```

暂时不强求：

```text
1. AssetEmbedding 全量迁移
2. VoiceEmbedding
3. ContentEmbedding
4. 复杂 reranker
5. 自动合并记忆
```

---

# v1.4 和前面版本的关系

## 和 v0.4 Memory Retrieval

v0.4 是第一版记忆检索。
v1.4 是它的规模化升级。

```text
v0.4：能搜
v1.4：搜得准、搜得快、搜得稳、搜得可评测
```

---

## 和 v0.75 Dream Cycle

Dream 会产生很多 DailyNote、DreamSignal、MemoryProposal。
v1.4 要防止这些东西污染记忆库。

比如：

```text
DreamDiary 不能进正式 Memory
DreamSignal 只有审核后才能进入 Memory
Dream 生成的 proposal 要有来源证据
```

v1.4 可以进一步检查这些规则有没有被破坏。

---

## 和 v1.3 Eval

v1.3 测“陆思源像不像自己”。
v1.4 测“陆思源有没有搜到正确记忆”。

两个应该联动。

比如人格测试失败了，可以分析：

```text
是 prompt 变了？
是模型变了？
是检索错了？
是记忆冲突了？
```

---

## 和 v0.9 Asset Memory

v1.4 可以预留 Asset 向量检索升级。

现在先重点做 Memory。
后续再把图片/音频/视频资产的 embedding 也迁到 Qdrant。

---

# v1.4 的最终效果

做完 v1.4 后，陆思源的记忆系统会从：

```text
能记住、能检索
```

升级成：

```text
可扩展、可迁移、可治理、可评测的长期记忆系统
```

他不会只是“记得更多”，而是：

```text
记得更干净
搜得更准确
旧记忆会过期
冲突记忆会被发现
低质量记忆会被标记
检索结果能被评测
向量库可以从 pgvector 平滑迁移到 Qdrant
```

---

# 我建议 v1.4 的名称

```text
task_14 / v1.4：Advanced Memory Scale-out
```

中文：

```text
高级记忆系统与向量检索扩展
```

一句话描述：

```text
把陆思源的长期记忆系统升级成支持 Qdrant、混合检索、记忆治理和检索评测的可扩展架构。
```

---

# 后面 v1.5 可以做什么？

v1.4 之后，我建议 v1.5 做：

```text
Multi-Agent Studio
多 Agent 协作工作室
```

也就是把现在这些角色正式拆成工作室：

```text
陆思源本人
Creator Assistant
Reflection Agent
Dream Agent
Content Planner
Voice Director
Asset Curator
Safety Reviewer
Memory Librarian
```

但 v1.5 是后话。
v1.4 先把记忆系统打稳，因为所有 Agent 都会依赖记忆。
