# IP 与角色授权声明

本仓库中的程序代码按 Apache-2.0 License 授权。

但“陆思源 / Lu Siyuan”这一原创数字人角色，包括但不限于名称、人格设定、角色经历、视觉形象、图片、视频、音色、说话风格、世界观、数据集、模型权重及相关创作素材，均不随代码协议开放商业使用权。

未经授权，不得将“陆思源 / Lu Siyuan”用于：
- 商业产品或商业服务；
- 付费聊天机器人、虚拟主播、数字人服务；
- 商品、周边、广告、营销活动；
- 模型训练、LoRA 训练、音色克隆、数据集制作；
- 冒充官方账号或暗示与原作者有关联；
- 出售、分发、再授权相关角色素材或衍生模型。

如需商业授权，请联系作者。

---

# lusiyuan-core

陆思源 AI 数字人 Core API v0.1

## 技术栈

- Node.js 20+ / TypeScript
- Fastify
- PostgreSQL + Prisma
- OpenAI-compatible Chat Completions API
- pnpm

## 环境要求

- Node.js 20+
- pnpm
- Docker / Docker Compose

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 PostgreSQL

```bash
docker compose up -d
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入你的模型 API 信息：

```env
DATABASE_URL="postgresql://lusiyuan:password@localhost:5432/lusiyuan_core"
PORT=64100
MODEL_BASE_URL="https://api.minimax.chat/v1"
MODEL_API_KEY="your-api-key"
MODEL_NAME="gpt-4.1-mini"
MEMORY_EXTRACTION_MODEL_NAME="gpt-4.1-mini"
```

### 4. 迁移数据库

```bash
pnpm db:migrate
# 提示输入迁移名称时，输入：init
```

### 5. 启动开发服务

```bash
pnpm dev
```

## 测试接口

### 健康检查

```bash
curl http://localhost:64100/health
```

返回：

```json
{ "status": "ok" }
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

返回：

```json
{
  "reply": "我是陆思源，一个原创 AI 数字人……",
  "conversation_id": "web_default",
  "memory_written": false
}
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

## 项目目录

```
src/
├── server.ts          # 入口，启动 HTTP 服务
├── app.ts             # Fastify 实例，注册路由
├── routes/
│   ├── health.route.ts
│   └── chat.route.ts  # /v1/chat 及记忆调试接口
├── core/
│   ├── chat.service.ts       # 核心流程编排
│   ├── prompt-builder.ts     # 组装发给模型的 messages
│   ├── persona-loader.ts     # 读取 persona/ 人格文件
│   ├── memory.service.ts     # 长期记忆读写
│   ├── memory-extractor.ts   # 从对话中提取长期记忆
│   ├── model-provider.ts     # OpenAI-compatible 模型调用
│   └── safety.ts             # 输入校验与输出清理
├── db/
│   └── prisma.ts      # Prisma 单例客户端
├── types/             # TypeScript 类型定义
└── utils/             # env 校验、logger

persona/               # 陆思源人格 Markdown 文件
prisma/
└── schema.prisma      # 数据库 schema
```