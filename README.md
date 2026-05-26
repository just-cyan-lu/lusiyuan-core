# IP 与角色授权声明

本仓库中的程序代码按 Apache-2.0 License 授权。

但"陆思源 / Lu Siyuan"这一原创数字人角色，包括但不限于名称、人格设定、角色经历、视觉形象、图片、视频、音色、说话风格、世界观、数据集、模型权重及相关创作素材，均不随代码协议开放商业使用权。

未经授权，不得将"陆思源 / Lu Siyuan"用于：
- 商业产品或商业服务；
- 付费聊天机器人、虚拟主播、数字人服务；
- 商品、周边、广告、营销活动；
- 模型训练、LoRA 训练、音色克隆、数据集制作；
- 冒充官方账号或暗示与原作者有关联；
- 出售、分发、再授权相关角色素材或衍生模型。

如需商业授权，请联系作者。

---

# lusiyuan-core

陆思源 AI 数字人 Core API

## 技术栈

- Node.js 20+ / TypeScript
- Fastify
- PostgreSQL + pgvector + Prisma
- OpenAI-compatible Chat Completions API
- pnpm

---

## 环境要求

- Node.js 20+
- pnpm
- Docker & Docker Compose

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少填写以下字段：

```env
# 数据库（默认值和 docker-compose.yml 一致，通常不用改）
DATABASE_URL="postgresql://lusiyuan:password@localhost:5432/lusiyuan_core"

# 对话模型（OpenAI 兼容接口）
MODEL_BASE_URL="https://api.openai.com/v1"
MODEL_API_KEY="your-api-key"
MODEL_NAME="gpt-4.1-mini"
```

### 3. 启动数据库

```bash
docker compose up -d
```

> 使用的镜像是 `pgvector/pgvector:pg16`，内置向量搜索扩展。

### 4. 初始化数据库

**第一次启动**，或数据库重建后：

```bash
npx prisma migrate reset --force
```

这会自动跑所有迁移并建好全部表。

> 日常迭代时（schema 有新变更）用 `pnpm db:migrate` 即可。

### 5. 启动服务

```bash
pnpm dev
```

服务监听 `http://localhost:64100`。

---

## 可选渠道

### Telegram Bot

在 `.env` 里配置：

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_MODE="polling"
# 如果在国内需要代理访问 Telegram：
TELEGRAM_PROXY="http://127.0.0.1:7890"
```

另开终端启动：

```bash
pnpm telegram:dev
```

### Web 前端

前端在独立仓库 `lusiyuan-web`，默认端口 `64111`，详见该仓库 README。

后端 `.env` 里需要配置允许的 origin：

```env
WEB_ORIGIN="http://localhost:64111"
```

---

## 语义记忆检索（v0.4，可选）

默认关闭，用旧的按重要度排序。需要 SiliconFlow API Key 才能开启。

在 `.env` 里追加：

```env
EMBEDDING_API_KEY="your-siliconflow-api-key"
MEMORY_RETRIEVAL_ENABLED=true
```

首次开启，给历史记忆补 embedding：

```bash
pnpm embeddings:backfill
```

调试检索效果：

```bash
pnpm embeddings:inspect "查询内容" <userId>
# userId 不填时会列出数据库里的用户
```

详细设计见 [docs/memory-retrieval-v0.4.md](docs/memory-retrieval-v0.4.md)。

---

## 工具调用（v0.5，可选）

默认关闭。开启后陆思源在回复时可以查询内部数据（记忆、项目状态、对话历史）并生成草稿。

在 `.env` 里追加：

```env
TOOLS_ENABLED=true
```

查看已注册的工具：

```bash
pnpm tools:inspect
```

详细设计见 [docs/tool-action-layer-v0.5.md](docs/tool-action-layer-v0.5.md)。

### 工具调用日志

```bash
curl http://localhost:64100/v1/tool-logs
```

### 草稿

草稿是工具调用的产物，AI 只写入数据库，不会自动发送。

```bash
# 查看草稿列表
curl "http://localhost:64100/v1/drafts?userId=creator_lu"

# 更新草稿状态
curl -X PATCH http://localhost:64100/v1/drafts/<draftId>/status \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

---

## 反思代理（v0.7，可选）

默认关闭。开启后可以对历史对话进行分析，生成记忆提案（需 owner 审核后才写入）。

在 `.env` 里追加：

```env
REFLECTION_ENABLED=true
```

### 触发反思分析

```bash
# 立即运行（创建 job 并执行）
curl -X POST http://localhost:64100/v1/reflection/run \
  -H "Content-Type: application/json" \
  -d '{"userId": "creator_lu", "triggerType": "manual", "scope": "user"}'

# 或用 CLI 脚本
pnpm reflection:run --daily
pnpm reflection:run --conversation=<conversationId> --limit=80
```

### 查看分析报告

```bash
# 列出最近报告
curl http://localhost:64100/v1/reflection/reports

# 查看单份报告
curl http://localhost:64100/v1/reflection/reports/<reportId>

# 或用 CLI 脚本
pnpm reflection:inspect
pnpm reflection:inspect --report=<reportId>
```

### 审核记忆提案

```bash
# 查看待审核提案
curl http://localhost:64100/v1/reflection/proposals

# 批准提案
curl -X POST http://localhost:64100/v1/reflection/proposals/<proposalId>/approve

# 拒绝提案
curl -X POST http://localhost:64100/v1/reflection/proposals/<proposalId>/reject

# 批准后写入记忆
curl -X POST http://localhost:64100/v1/reflection/proposals/<proposalId>/apply

# 或用 CLI 脚本（批量处理所有已批准的提案）
pnpm reflection:apply --approved
```

### 查看风险标记

```bash
curl http://localhost:64100/v1/reflection/risks
```

详细设计见 [docs/reflection-agent-v0.7.md](docs/reflection-agent-v0.7.md)。

---

## 接口速查

### 健康检查

```bash
curl http://localhost:64100/health
```

### 发送消息

```bash
curl -X POST http://localhost:64100/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "creator_lu",
    "channel": "web",
    "conversation_id": "web_default",
    "message": "你是谁？"
  }'
```

### 查看用户记忆

```bash
curl http://localhost:64100/v1/users/creator_lu/memories
```

### 手动添加记忆

```bash
curl -X POST http://localhost:64100/v1/users/creator_lu/memories \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user_preference",
    "content": "用户希望陆思源说话轻松自然，不喜欢太抒情。",
    "importance": 8
  }'
```

### 查看对话历史

```bash
curl http://localhost:64100/v1/conversations/web_default/messages
```

### 渠道状态

```bash
curl http://localhost:64100/v1/channels/status
```

---

## 项目目录

```
src/
├── server.ts               # 入口，启动 HTTP 服务
├── app.ts                  # Fastify 实例，注册路由和 CORS
├── routes/
│   ├── health.route.ts
│   ├── chat.route.ts       # /v1/chat、记忆、对话历史接口
│   ├── channels.route.ts   # /v1/channels/status
│   ├── tools.route.ts      # v0.5 工具调用接口
│   ├── drafts.route.ts     # v0.5 草稿接口
│   └── reflection.route.ts # v0.7 反思代理接口
├── channels/
│   ├── telegram/           # Telegram Bot 适配器
│   └── weixin/             # 微信 webhook 接口（待接官方 API）
├── core/
│   ├── chat.service.ts           # 核心流程编排
│   ├── prompt-builder.ts         # 组装发给模型的 messages
│   ├── persona-loader.ts         # 读取 persona/ 人格文件
│   ├── memory.service.ts         # 长期记忆读写
│   ├── memory-extractor.ts       # 从对话中提取长期记忆
│   ├── memory-retrieval.service.ts  # v0.4 语义检索
│   ├── memory-reranker.ts        # v0.4 规则重排
│   ├── memory-budget.ts          # v0.4 记忆预算控制
│   ├── model-provider.ts         # OpenAI-compatible 模型调用
│   └── safety.ts                 # 输入校验与输出清理
├── tools/                  # v0.5 工具调用层
│   ├── tool.types.ts             # 核心类型定义
│   ├── tool-registry.ts          # 工具注册表
│   ├── tool-executor.ts          # 执行器（含超时、日志）
│   ├── tool-intent-detector.ts   # 模型驱动意图检测
│   ├── tool-result-formatter.ts  # 工具结果格式化
│   ├── policy/
│   │   ├── action-policy.ts      # 权限与风险检查
│   │   └── owner-check.ts        # owner 身份判断
│   ├── builtin/                  # 5 个低风险内置工具
│   └── future/                   # 高风险工具占位符（全部禁用）
├── drafts/                 # v0.5 草稿层
│   ├── draft.service.ts
│   └── draft.types.ts
├── reflection/             # v0.7 反思代理层
│   ├── reflection.types.ts           # 核心类型定义
│   ├── reflection-context-builder.ts # 从 DB 构建分析上下文
│   ├── reflection.prompt.ts          # 模型 system prompt
│   ├── reflection-policy.ts          # 提案过滤与风险策略
│   ├── reflection-report-formatter.ts# 调用模型，解析输出
│   ├── reflection.service.ts         # Job 创建与执行
│   └── reflection-proposal.service.ts# 提案审核与写入记忆
├── mcp/                    # v0.5 MCP 预留（占位符）
├── embeddings/             # v0.4 Embedding 层
├── vector-index/           # v0.4 向量索引层（pgvector / Qdrant 接口）
├── db/
│   └── prisma.ts           # Prisma 单例客户端
├── types/                  # TypeScript 类型定义
└── utils/                  # env 校验、logger

persona/                    # 陆思源人格 Markdown 文件
prisma/
├── schema.prisma           # 数据库 schema
└── migrations/             # 所有迁移 SQL（需跟随代码提交）
scripts/
├── start-telegram.ts              # Telegram bot 启动入口
├── backfill-memory-embeddings.ts  # 给旧记忆补 embedding
├── inspect-memory-retrieval.ts    # 调试语义检索
├── inspect-tools.ts               # 查看已注册工具列表
├── run-reflection.ts              # 触发反思分析（CLI）
├── inspect-reflection-report.ts   # 查看反思报告（CLI）
└── apply-memory-proposals.ts      # 审核并写入记忆提案（CLI）
docs/
├── memory-retrieval-v0.4.md       # v0.4 技术设计文档
├── tool-action-layer-v0.5.md      # v0.5 技术设计文档
└── reflection-agent-v0.7.md       # v0.7 技术设计文档
```
