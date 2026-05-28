# ⚠️ 本文档已废弃

**请使用 task_10_01.md（生产稳定化轻量版）替代。**

**废弃原因**：本文档设计了完整的企业级稳定化方案（复杂的 RBAC 权限系统、AuditLog、UsageDailyStat、完整的 Admin Console、Eval Framework 等），对个人项目来说过度设计。

**新方案**：task_10_01.md 只做真正必要的生产稳定化功能：简单的 owner 权限检查、基础限流、错误日志、备份脚本、health check、隐私提示。

---

# task_10：Public Beta & Production Hardening（已废弃）

# 陆思源 Core API v1.0：公开测试与生产稳定化

## 1. v1.0 目标

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
v0.9：Media & Asset Memory
```

v1.0 的目标不是继续加新能力，而是把陆思源系统从：

```text
功能很强的实验系统
```

收束成：

```text
可以长期运行、可以少量公开测试、可以维护、可以备份、可以回滚、可以排查问题的稳定系统。
```

v1.0 的一句话目标：

```text
让陆思源能安全、稳定、可控地进入 Public Beta。
```

---

# 2. v1.0 核心原则

v1.0 要遵守这些原则：

```text
1. 稳定性优先于新功能。
2. 可维护性优先于炫技。
3. 所有高风险能力必须可关闭、可审计、可回滚。
4. 所有 owner/admin 操作必须留下日志。
5. 所有重要数据必须能备份和导出。
6. 公开入口必须有限流、防滥用和隐私提示。
7. 人格、记忆、工具、外部行动、资产系统都必须有健康检查。
8. 陆思源不能因为进入公开测试而突破“不装真人”的核心边界。
```

---

# 3. v1.0 不做什么

v1.0 不做新大功能。

明确不做：

```text
1. 不做语音实时互动
2. 不做自动发布小红书 / B站
3. 不做自动回复私信
4. 不做 LoRA 训练
5. 不做 Qdrant 迁移
6. 不做多 Agent Studio
7. 不做复杂商业化系统
8. 不做公开注册大规模用户系统
9. 不做完整付费系统
10. 不做移动 App
```

v1.0 只做：

```text
权限、管理后台、日志、备份、监控、限流、成本、部署、隐私、评测框架。
```

---

# 4. v1.0 总体架构

v0.9 之后系统能力很多：

```text
Lusiyuan Core API
├── ChatService
├── MemoryRetrievalService
├── Tool & Action Layer
├── DraftService
├── Letta Creator Assistant
├── Letta Reflection Agent
├── OpenClaw Action Gateway
├── Media & Asset Memory
└── Web Admin
```

v1.0 新增稳定化层：

```text
Lusiyuan Core API
├── Auth & Permission
├── Admin Console
├── Audit Log
├── System Event Log
├── Error Log
├── Backup & Export
├── Usage & Cost Tracking
├── Rate Limit
├── Health Check
├── Privacy & Data Control
├── Deployment Profile
└── Evaluation Framework
```

v1.0 之后，系统应该像这样：

```text
公开用户
↓
Web / Telegram / Weixin
↓
Rate Limit / Permission
↓
ChatService
↓
Memory / Tools / Drafts
↓
Model Provider
↓
Reply

Owner / Admin
↓
Admin Console
↓
审核、备份、日志、资产、记忆、Reflection、OpenClaw、成本、状态
```

---

# 5. 用户角色与权限系统

## 5.1 为什么 v1.0 要做权限系统？

之前很多功能都是简单的 `owner only`。
进入 Public Beta 后，需要正式区分不同用户能力。

否则会出现问题：

```text
1. 普通用户访问管理接口
2. 测试用户调用工具
3. 非 owner 审核外部动作
4. 非 owner 查看 Reflection 报告
5. 非 owner 上传资产
6. 普通用户触发高成本模型调用
```

---

## 5.2 用户角色

新增角色：

```text
owner
admin
tester
public_user
blocked
```

### owner

你本人。

权限：

```text
所有权限
系统配置
用户管理
备份恢复
外部动作审核
Reflection proposal 应用
资产删除
成本查看
日志查看
```

### admin

协作者。

权限：

```text
管理内容
管理资产
查看部分日志
审核草稿
查看部分统计
不能修改核心系统配置
不能恢复备份
不能修改 owner 权限
```

### tester

内测用户。

权限：

```text
可以聊天
可以拥有自己的会话和记忆
不能访问后台
不能调用高风险工具
不能访问 Creator Assistant / Reflection / OpenClaw Admin
```

### public_user

普通公开用户。

权限：

```text
只能使用公开聊天入口
更严格限流
默认不允许工具
默认不允许长期记忆或仅允许最小记忆
不能访问管理功能
```

### blocked

封禁用户。

权限：

```text
不能使用服务
```

---

## 5.3 权限模型

新增：

```text
Role
Permission
UserRole
PermissionGuard
```

权限建议：

```text
chat:use
chat:use_public

admin:access

memory:read
memory:write
memory:delete
memory:apply_proposal

draft:read
draft:write
draft:approve

asset:read
asset:upload
asset:review
asset:delete

reflection:read
reflection:run
reflection:approve
reflection:apply

creator_assistant:use

openclaw:read
openclaw:action_request
openclaw:approve
openclaw:run

tools:execute
tools:debug

logs:read
audit:read

backup:create
backup:restore
backup:export

settings:read
settings:write

cost:read
health:read
```

---

# 6. 数据库设计：权限相关

## 6.1 User 增加字段

如果已有 User 表，建议扩展：

```prisma
model User {
  id             String   @id @default(cuid())
  externalUserId String?  @unique
  displayName    String?
  email          String?

  role           String   @default("public_user")
  status         String   @default("active")

  metadata       Json?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  lastSeenAt     DateTime?

  @@index([role])
  @@index([status])
}
```

`status`：

```text
active
blocked
deleted
```

---

## 6.2 PermissionOverride

可选新增，用于给单个用户开特殊权限。

```prisma
model PermissionOverride {
  id          String   @id @default(cuid())

  userId      String
  permission  String
  effect      String

  reason      String?
  createdBy   String?
  createdAt   DateTime @default(now())
  expiresAt   DateTime?

  @@index([userId])
  @@index([permission])
}
```

`effect`：

```text
allow
deny
```

v1.0 可以先不做复杂 RBAC，只做 role + guard。
但表结构可以预留。

---

# 7. Admin Console 统一后台

## 7.1 目标

v0.6～v0.9 已经有多个后台页面：

```text
/admin/creator-assistant
/admin/reflection
/admin/action-gateway
/admin/assets
/admin/asset-collections
```

v1.0 要统一成：

```text
/admin
```

导航：

```text
Overview
Conversations
Users
Memories
Drafts
Tools
Reflection
Creator Assistant
OpenClaw
Assets
Approvals
Logs
Backups
Costs
Settings
Health
```

---

## 7.2 /admin Overview

展示：

```text
系统状态
今日消息数
今日模型调用
今日成本估算
待审核草稿
待审核外部动作
待审核 Reflection proposals
新 External Inbox 数量
资产数量
最近错误
```

---

## 7.3 /admin Conversations

功能：

```text
查看最近会话
按用户 / 渠道筛选
查看单个会话消息
查看该会话使用的记忆
查看该会话工具调用
手动运行 Reflection
```

---

## 7.4 /admin Memories

功能：

```text
查看 Memory
搜索 Memory
按 scope/type/status 过滤
查看 MemoryEmbedding 状态
手动 archive / supersede
查看 proposal 来源
```

---

## 7.5 /admin Drafts

功能：

```text
查看草稿
编辑草稿
标记 approved / rejected
查看草稿来源
禁止直接发送
```

---

## 7.6 /admin Reflection

功能：

```text
运行复盘
查看 reports
查看 memory proposals
approve / reject / apply proposal
查看 risk flags
查看 growth log proposals
```

---

## 7.7 /admin OpenClaw

功能：

```text
查看 External Inbox
查看 ExternalActionRequest
查看 Approval Queue
查看 ExternalActionLog
查看 OpenClawEventLog
```

---

## 7.8 /admin Assets

功能：

```text
上传资产
查看资产
review 资产
管理 collection
导出 LoRA 候选图
查看 asset usage
```

---

## 7.9 /admin Health

功能：

```text
Core API 状态
PostgreSQL 状态
pgvector 状态
SiliconFlow embedding 状态
Model Provider 状态
Letta 状态
OpenClaw 状态
Storage 状态
Backup 状态
```

---

# 8. 审计日志 AuditLog

## 8.1 为什么需要 AuditLog？

v1.0 后很多操作会影响系统：

```text
应用记忆提案
批准外部动作
删除资产
修改用户角色
恢复备份
修改设置
```

这些必须可追踪。

---

## 8.2 AuditLog 表

```prisma
model AuditLog {
  id          String   @id @default(cuid())

  actorUserId String?
  actorRole   String?
  action      String

  targetType  String?
  targetId    String?

  before      Json?
  after       Json?
  metadata    Json?

  ipAddress   String?
  userAgent   String?
  channel     String?

  createdAt   DateTime @default(now())

  @@index([actorUserId])
  @@index([action])
  @@index([targetType])
  @@index([targetId])
  @@index([createdAt])
}
```

---

## 8.3 必须写 AuditLog 的操作

```text
用户角色变更
用户封禁 / 解封
Memory 创建 / 更新 / 归档 / 删除
MemoryProposal apply
Reflection proposal approve / reject / apply
Draft approve / reject / update
ExternalAction approve / reject / run
Asset upload / review / archive / delete
Backup create / restore
Settings update
OpenClaw action run
```

---

# 9. SystemEventLog 与 ErrorLog

## 9.1 SystemEventLog

记录系统事件：

```prisma
model SystemEventLog {
  id          String   @id @default(cuid())

  eventType   String
  severity    String   @default("info")

  message     String
  metadata    Json?

  createdAt   DateTime @default(now())

  @@index([eventType])
  @@index([severity])
  @@index([createdAt])
}
```

`severity`：

```text
debug
info
warn
error
critical
```

---

## 9.2 ErrorLog

记录异常。

```prisma
model ErrorLog {
  id          String   @id @default(cuid())

  source      String
  errorType   String?
  message     String
  stack       String?

  userId      String?
  requestId   String?
  path        String?
  method      String?

  metadata    Json?

  createdAt   DateTime @default(now())

  @@index([source])
  @@index([errorType])
  @@index([userId])
  @@index([requestId])
  @@index([createdAt])
}
```

---

# 10. Usage & Cost Tracking

## 10.1 为什么要做成本统计？

系统会调用：

```text
聊天模型
embedding 模型
Letta
OpenClaw
资产存储
未来图片 / 音频模型
```

如果没有成本统计，Public Beta 很容易失控。

---

## 10.2 ModelCallLog

```prisma
model ModelCallLog {
  id             String   @id @default(cuid())

  provider       String
  model          String
  purpose        String

  userId         String?
  conversationId String?
  requestId      String?

  inputTokens    Int?
  outputTokens   Int?
  totalTokens    Int?

  estimatedCost  Float?
  currency       String   @default("USD")

  status         String   @default("success")
  error          String?

  latencyMs      Int?
  metadata       Json?

  createdAt      DateTime @default(now())

  @@index([provider])
  @@index([model])
  @@index([purpose])
  @@index([userId])
  @@index([createdAt])
}
```

`purpose`：

```text
chat
embedding
reflection
creator_assistant
summarization
asset_embedding
tool_planning
```

---

## 10.3 UsageDailyStat

可选做聚合表。

```prisma
model UsageDailyStat {
  id           String   @id @default(cuid())

  date         DateTime
  provider     String?
  model        String?
  purpose      String?

  callCount    Int      @default(0)
  inputTokens  Int      @default(0)
  outputTokens Int      @default(0)
  totalTokens  Int      @default(0)
  cost         Float    @default(0)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([date])
  @@index([provider])
  @@index([model])
  @@index([purpose])
}
```

---

## 10.4 CostEstimateService

负责：

```text
1. 记录模型调用
2. 根据配置估算成本
3. 生成每日统计
4. 管理后台展示
```

---

# 11. Rate Limit / 防滥用

## 11.1 限流维度

v1.0 要按这些维度限流：

```text
userId
externalUserId
IP
channel
role
route
```

---

## 11.2 推荐限流策略

```text
owner：
基本不限或高限制

admin：
较高限制

tester：
每分钟 10 条，每天 300 条

public_user：
每分钟 3 条，每天 50 条

anonymous web：
每分钟 2 条，每天 20 条
```

实际数值可以配置。

---

## 11.3 环境变量

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PUBLIC_PER_MINUTE=3
RATE_LIMIT_PUBLIC_PER_DAY=50
RATE_LIMIT_TESTER_PER_MINUTE=10
RATE_LIMIT_TESTER_PER_DAY=300
RATE_LIMIT_OWNER_BYPASS=true
RATE_LIMIT_IP_PER_MINUTE=20
RATE_LIMIT_IP_PER_DAY=500
```

---

## 11.4 RateLimitLog

可选记录被限流事件。

```prisma
model RateLimitLog {
  id          String   @id @default(cuid())

  userId      String?
  ipAddress   String?
  route       String?
  channel     String?
  reason      String

  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([ipAddress])
  @@index([createdAt])
}
```

---

# 12. Backup & Export

## 12.1 为什么 v1.0 必须做备份？

陆思源系统里会有：

```text
persona 文件
Memory
Messages
Drafts
Reflection reports
Creator Assistant sessions
External inbox
Assets metadata
Asset reviews
Tool logs
OpenClaw logs
```

这些都是长期资产。

---

## 12.2 备份类型

v1.0 至少支持：

```text
database backup
persona export
memory export
asset metadata export
draft export
project snapshot export
```

---

## 12.3 BackupJob

```prisma
model BackupJob {
  id          String   @id @default(cuid())

  backupType  String
  status      String   @default("pending")

  filePath    String?
  storageKey  String?
  sizeBytes   Int?

  error       String?
  metadata    Json?

  createdBy   String?
  createdAt   DateTime @default(now())
  completedAt DateTime?

  @@index([backupType])
  @@index([status])
  @@index([createdAt])
}
```

`backupType`：

```text
database
persona
memories
assets_metadata
drafts
project_snapshot
full
```

---

## 12.4 Backup scripts

```bash
pnpm backup:create
pnpm backup:create --type=full
pnpm backup:create --type=memories
pnpm backup:restore --file=...
pnpm export:persona
pnpm export:memories
pnpm export:assets-metadata
pnpm export:project-snapshot
```

---

## 12.5 Project Snapshot

`project snapshot` 应包含：

```text
当前版本路线
persona 文件摘要
核心配置摘要
Memory 导出
技术决策导出
资产 metadata 导出
Reflection summaries
Creator Assistant summary
Draft summaries
```

用途：

```text
1. 迁移项目
2. 给 Codex 提供上下文
3. 项目归档
4. 灾难恢复
```

---

# 13. Health Check & Status

## 13.1 API

新增：

```http
GET /v1/health
GET /v1/health/deep
GET /v1/status
```

---

## 13.2 /v1/health

轻量检查：

```json
{
  "ok": true,
  "service": "lusiyuan-core",
  "version": "1.0.0"
}
```

---

## 13.3 /v1/health/deep

深度检查：

```json
{
  "ok": true,
  "checks": {
    "database": "ok",
    "pgvector": "ok",
    "embedding": "ok",
    "model_provider": "ok",
    "storage": "ok",
    "letta": "disabled",
    "openclaw": "disabled"
  }
}
```

---

## 13.4 检查项

```text
PostgreSQL 连接
pgvector extension
MemoryEmbedding 查询
SiliconFlow embedding API
ModelProvider
Local/S3 Storage
Letta server
OpenClaw gateway
Web frontend build
Backup directory writable
```

---

# 14. Privacy & Data Control

## 14.1 Public Beta 必须有提示

公开聊天入口需要显示：

```text
陆思源是原创 AI 数字人，不是真人。
请不要输入敏感隐私信息。
聊天内容可能被用于改进角色体验和长期记忆系统。
你可以请求删除自己的对话或记忆。
```

---

## 14.2 用户数据控制

v1.0 至少提供 owner/admin 侧能力：

```text
查看某个用户的 conversations
查看某个用户的 memories
删除某个用户的 conversations
删除某个用户的 memories
禁用某个用户的长期记忆
导出某个用户的数据
封禁某个用户
```

---

## 14.3 UserPrivacySetting

```prisma
model UserPrivacySetting {
  id               String   @id @default(cuid())

  userId            String   @unique

  memoryEnabled     Boolean  @default(true)
  analyticsEnabled  Boolean  @default(true)
  allowReflection   Boolean  @default(true)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
}
```

对 public_user 可以默认：

```text
memoryEnabled = false 或 limited
```

具体策略由你决定。

---

# 15. Evaluation Framework，占位版

v1.0 要建立评测框架，但具体人格测试用例后补。

## 15.1 评测类型

先定义几类评测：

```text
persona_eval
memory_eval
safety_eval
tool_boundary_eval
action_boundary_eval
style_eval
project_recall_eval
```

---

## 15.2 EvalCase 表

```prisma
model EvalCase {
  id          String   @id @default(cuid())

  category    String
  name        String
  input       String

  expected    Json?
  forbidden   Json?
  scoring     Json?

  status      String   @default("active")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([status])
}
```

---

## 15.3 EvalRun 表

```prisma
model EvalRun {
  id          String   @id @default(cuid())

  runType     String
  status      String   @default("pending")

  model       String?
  promptVersion String?
  gitCommit   String?

  summary     Json?
  createdBy   String?

  createdAt   DateTime @default(now())
  completedAt DateTime?

  results     EvalResult[]

  @@index([runType])
  @@index([status])
  @@index([createdAt])
}
```

---

## 15.4 EvalResult 表

```prisma
model EvalResult {
  id          String   @id @default(cuid())

  runId       String
  caseId      String

  output      String
  score       Float?
  passed      Boolean?
  flags       Json?
  judgeOutput Json?

  createdAt   DateTime @default(now())

  run         EvalRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId])
  @@index([caseId])
  @@index([passed])
}
```

---

## 15.5 评测脚本

先占位：

```bash
pnpm eval:persona
pnpm eval:memory
pnpm eval:safety
pnpm eval:all
```

---

## 15.6 测试用例占位

v1.0 文档中先创建目录和占位文件：

```text
eval/
├── cases/
│   ├── persona.eval.yaml
│   ├── memory.eval.yaml
│   ├── safety.eval.yaml
│   ├── tool-boundary.eval.yaml
│   └── action-boundary.eval.yaml
└── README.md
```

具体用例后续补充。
暂时只写说明：

```text
TODO:
后续补充具体人格回归测试用例。
每个用例需要包含：
- id
- category
- name
- input
- expected_points
- forbidden
- scoring
- pass_condition
```

---

# 16. Deployment Profile

## 16.1 目标

v1.0 要从“本地能跑”升级为“可部署”。

至少支持：

```text
development
staging
production
```

---

## 16.2 环境文件

新增：

```text
.env.example
.env.development.example
.env.staging.example
.env.production.example
```

---

## 16.3 Docker Compose

标准服务：

```text
postgres + pgvector
lusiyuan-core-api
web
letta
openclaw
storage/minio 可选
nginx/caddy 可选
```

---

## 16.4 部署文档

新增：

```text
docs/DEPLOYMENT.md
docs/PRODUCTION_CHECKLIST.md
docs/BACKUP_RESTORE.md
docs/SECURITY.md
docs/PRIVACY.md
```

---

# 17. System Settings

v1.0 可以新增系统配置表。

```prisma
model SystemSetting {
  id          String   @id @default(cuid())

  key         String   @unique
  value       Json
  description String?

  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

用于保存：

```text
public_beta_enabled
public_chat_enabled
memory_enabled_for_public_users
openclaw_enabled
reflection_auto_run
asset_upload_enabled
rate_limit_config
maintenance_mode
```

---

# 18. API 设计

## 18.1 Admin status

```http
GET /v1/admin/overview
```

owner/admin only。

返回：

```json
{
  "messages_today": 120,
  "model_calls_today": 180,
  "estimated_cost_today": 0.42,
  "pending_drafts": 5,
  "pending_approvals": 2,
  "pending_reflection_proposals": 7,
  "new_external_inbox": 9,
  "asset_count": 320,
  "recent_errors": []
}
```

---

## 18.2 Users

```http
GET /v1/admin/users
GET /v1/admin/users/:userId
PATCH /v1/admin/users/:userId/role
POST /v1/admin/users/:userId/block
POST /v1/admin/users/:userId/unblock
GET /v1/admin/users/:userId/export
DELETE /v1/admin/users/:userId/data
```

---

## 18.3 Audit logs

```http
GET /v1/admin/audit-logs
```

query：

```text
actorUserId
action
targetType
from
to
limit
```

---

## 18.4 Error logs

```http
GET /v1/admin/error-logs
```

---

## 18.5 Usage / cost

```http
GET /v1/admin/usage/daily
GET /v1/admin/usage/models
GET /v1/admin/costs
```

---

## 18.6 Backups

```http
POST /v1/admin/backups
GET /v1/admin/backups
GET /v1/admin/backups/:id
POST /v1/admin/backups/:id/restore
```

restore 必须 owner only。

---

## 18.7 Settings

```http
GET /v1/admin/settings
PATCH /v1/admin/settings/:key
```

---

## 18.8 Eval

```http
POST /v1/admin/eval/runs
GET /v1/admin/eval/runs
GET /v1/admin/eval/runs/:id
GET /v1/admin/eval/cases
```

测试用例内容后补。

---

# 19. 推荐目录结构

新增：

```text
src/
├── auth/
│   ├── auth.types.ts
│   ├── permission.service.ts
│   ├── permission-guard.ts
│   ├── role-permissions.ts
│   └── user-role.service.ts
│
├── admin/
│   ├── admin-overview.service.ts
│   ├── admin.types.ts
│   └── admin-dashboard.service.ts
│
├── audit/
│   ├── audit-log.service.ts
│   └── audit.types.ts
│
├── logs/
│   ├── system-event-log.service.ts
│   ├── error-log.service.ts
│   └── request-logger.ts
│
├── usage/
│   ├── model-call-log.service.ts
│   ├── cost-estimate.service.ts
│   ├── usage-daily-stat.service.ts
│   └── usage.types.ts
│
├── rate-limit/
│   ├── rate-limit.service.ts
│   ├── rate-limit-guard.ts
│   └── rate-limit.types.ts
│
├── backup/
│   ├── backup.service.ts
│   ├── export.service.ts
│   ├── restore.service.ts
│   └── backup.types.ts
│
├── health/
│   ├── health.service.ts
│   ├── checks/
│   │   ├── database-health.check.ts
│   │   ├── pgvector-health.check.ts
│   │   ├── embedding-health.check.ts
│   │   ├── model-provider-health.check.ts
│   │   ├── storage-health.check.ts
│   │   ├── letta-health.check.ts
│   │   └── openclaw-health.check.ts
│   └── health.types.ts
│
├── privacy/
│   ├── privacy.service.ts
│   ├── user-data-export.service.ts
│   └── user-data-delete.service.ts
│
├── eval/
│   ├── eval.service.ts
│   ├── eval-runner.ts
│   ├── eval-judge.ts
│   └── eval.types.ts
│
└── routes/
    ├── admin.route.ts
    ├── health.route.ts
    ├── backup.route.ts
    ├── usage.route.ts
    ├── eval.route.ts
    └── privacy.route.ts
```

---

# 20. 环境变量

`.env.example` 增加：

```env
# Version
APP_VERSION="1.0.0"
APP_ENV="development"

# Public Beta
PUBLIC_BETA_ENABLED=false
PUBLIC_CHAT_ENABLED=true
PUBLIC_USER_MEMORY_ENABLED=false

# Auth / Permission
AUTH_ENABLED=true
ADMIN_OWNER_EMAIL=""
OWNER_USER_IDS=""

# Rate Limit
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PUBLIC_PER_MINUTE=3
RATE_LIMIT_PUBLIC_PER_DAY=50
RATE_LIMIT_TESTER_PER_MINUTE=10
RATE_LIMIT_TESTER_PER_DAY=300
RATE_LIMIT_OWNER_BYPASS=true
RATE_LIMIT_IP_PER_MINUTE=20
RATE_LIMIT_IP_PER_DAY=500

# Audit / Logs
AUDIT_LOG_ENABLED=true
ERROR_LOG_ENABLED=true
SYSTEM_EVENT_LOG_ENABLED=true
REQUEST_LOG_ENABLED=true

# Usage / Cost
USAGE_TRACKING_ENABLED=true
COST_TRACKING_ENABLED=true
COST_CURRENCY="USD"

# Backup
BACKUP_ENABLED=true
BACKUP_DIR="./data/backups"
BACKUP_RETENTION_DAYS=30
BACKUP_INCLUDE_ASSET_METADATA=true
BACKUP_INCLUDE_PERSONA=true
BACKUP_INCLUDE_MEMORIES=true

# Health
HEALTH_DEEP_CHECK_ENABLED=true
HEALTH_CHECK_TIMEOUT_MS=5000

# Eval
EVAL_ENABLED=true
EVAL_CASES_DIR="./eval/cases"
EVAL_OUTPUT_DIR="./eval/runs"

# Privacy
PRIVACY_USER_EXPORT_ENABLED=true
PRIVACY_USER_DELETE_ENABLED=true

# Admin
ADMIN_CONSOLE_ENABLED=true
ADMIN_REQUIRE_OWNER_FOR_BACKUP_RESTORE=true

# Maintenance
MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE="陆思源正在维护中，稍后再来。"
```

---

# 21. Scripts

新增脚本：

```json
{
  "scripts": {
    "backup:create": "tsx scripts/backup-create.ts",
    "backup:restore": "tsx scripts/backup-restore.ts",
    "export:persona": "tsx scripts/export-persona.ts",
    "export:memories": "tsx scripts/export-memories.ts",
    "export:assets-metadata": "tsx scripts/export-assets-metadata.ts",
    "export:project-snapshot": "tsx scripts/export-project-snapshot.ts",

    "usage:aggregate": "tsx scripts/aggregate-usage-daily.ts",
    "health:check": "tsx scripts/health-check.ts",

    "eval:persona": "tsx scripts/run-eval.ts --type=persona",
    "eval:memory": "tsx scripts/run-eval.ts --type=memory",
    "eval:safety": "tsx scripts/run-eval.ts --type=safety",
    "eval:all": "tsx scripts/run-eval.ts --type=all"
  }
}
```

---

# 22. 开发步骤

## Step 1：权限系统

实现：

```text
User.role
User.status
PermissionService
PermissionGuard
role-permissions.ts
```

把所有 admin / owner only 接口接入 PermissionGuard。

---

## Step 2：Admin Overview

实现：

```text
GET /v1/admin/overview
```

聚合：

```text
messages
model calls
cost
drafts
approvals
reflection proposals
external inbox
assets
errors
```

---

## Step 3：AuditLog

新增 AuditLog 表和 AuditLogService。
接入所有重要 mutation。

---

## Step 4：ErrorLog / SystemEventLog

新增统一错误记录。
Fastify error handler 中写 ErrorLog。

---

## Step 5：Usage / Cost

新增 ModelCallLog。
在所有 ModelProvider / EmbeddingProvider 调用处记录。

---

## Step 6：Rate Limit

实现 RateLimitGuard。
接入 public chat、web chat、Telegram、Weixin。

---

## Step 7：Backup & Export

实现：

```text
backup create
memory export
persona export
asset metadata export
project snapshot export
```

restore 可以先只支持 owner 手动脚本，API 可预留。

---

## Step 8：Health Check

实现：

```text
/v1/health
/v1/health/deep
/v1/status
```

---

## Step 9：Privacy

实现：

```text
user data export
user data delete
user memory disable
```

---

## Step 10：Eval Framework

先实现框架和占位，不写具体测试用例。

创建：

```text
eval/cases/persona.eval.yaml
eval/cases/memory.eval.yaml
eval/cases/safety.eval.yaml
```

每个文件放 TODO 占位。

---

## Step 11：Admin Console 整合

把原本分散页面统一到 `/admin` 导航下。

---

## Step 12：部署文档

新增：

```text
docs/DEPLOYMENT.md
docs/PRODUCTION_CHECKLIST.md
docs/BACKUP_RESTORE.md
docs/SECURITY.md
docs/PRIVACY.md
```

---

# 23. 验收标准

v1.0 完成后，应满足：

```text
1. 系统有 owner/admin/tester/public_user/blocked 角色
2. admin 接口都有权限保护
3. 普通用户不能访问后台接口
4. 所有重要 mutation 写 AuditLog
5. 系统错误写 ErrorLog
6. 模型调用写 ModelCallLog
7. Public 用户有限流
8. 备份脚本可以运行
9. persona / memories / assets metadata 可以导出
10. /v1/health 可用
11. /v1/health/deep 可检查数据库、pgvector、embedding、模型、storage
12. 用户数据可以导出
13. 用户记忆可以删除或禁用
14. Web 前端有公开隐私提示
15. Admin Overview 可以看到核心状态
16. Eval 框架存在，测试用例文件占位
17. 部署文档完整
18. OpenClaw / Letta / Assets / Reflection 原功能不受影响
19. MAINTENANCE_MODE 可关闭公开入口
20. v1.0 可以作为 Public Beta 版本运行
```

---

# 24. 给 Codex 的开发指令

可以把下面这段交给 Codex：

```text
请在现有 lusiyuan-core v0.9 项目基础上实现 task_10 / v1.0：Public Beta & Production Hardening。

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
- Media & Asset Memory

v1.0 目标：
不要增加大型新功能，而是把系统稳定化，准备 Public Beta。重点包括权限、后台整合、审计日志、错误日志、成本统计、限流、备份、健康检查、隐私控制、部署文档和评测框架。人格回归测试具体用例先占位，后续补充。

请完成以下任务：

1. 更新 .env.example，增加：
   - APP_VERSION="1.0.0"
   - APP_ENV="development"
   - PUBLIC_BETA_ENABLED=false
   - PUBLIC_CHAT_ENABLED=true
   - PUBLIC_USER_MEMORY_ENABLED=false
   - AUTH_ENABLED=true
   - ADMIN_OWNER_EMAIL=""
   - RATE_LIMIT_ENABLED=true
   - RATE_LIMIT_PUBLIC_PER_MINUTE=3
   - RATE_LIMIT_PUBLIC_PER_DAY=50
   - RATE_LIMIT_TESTER_PER_MINUTE=10
   - RATE_LIMIT_TESTER_PER_DAY=300
   - RATE_LIMIT_OWNER_BYPASS=true
   - RATE_LIMIT_IP_PER_MINUTE=20
   - RATE_LIMIT_IP_PER_DAY=500
   - AUDIT_LOG_ENABLED=true
   - ERROR_LOG_ENABLED=true
   - SYSTEM_EVENT_LOG_ENABLED=true
   - REQUEST_LOG_ENABLED=true
   - USAGE_TRACKING_ENABLED=true
   - COST_TRACKING_ENABLED=true
   - COST_CURRENCY="USD"
   - BACKUP_ENABLED=true
   - BACKUP_DIR="./data/backups"
   - BACKUP_RETENTION_DAYS=30
   - BACKUP_INCLUDE_ASSET_METADATA=true
   - BACKUP_INCLUDE_PERSONA=true
   - BACKUP_INCLUDE_MEMORIES=true
   - HEALTH_DEEP_CHECK_ENABLED=true
   - HEALTH_CHECK_TIMEOUT_MS=5000
   - EVAL_ENABLED=true
   - EVAL_CASES_DIR="./eval/cases"
   - EVAL_OUTPUT_DIR="./eval/runs"
   - PRIVACY_USER_EXPORT_ENABLED=true
   - PRIVACY_USER_DELETE_ENABLED=true
   - ADMIN_CONSOLE_ENABLED=true
   - ADMIN_REQUIRE_OWNER_FOR_BACKUP_RESTORE=true
   - MAINTENANCE_MODE=false
   - MAINTENANCE_MESSAGE="陆思源正在维护中，稍后再来。"

2. 扩展 User model：
   - role String default "public_user"
   - status String default "active"
   - lastSeenAt DateTime?
   - metadata Json?

3. 新增 Prisma models：
   - PermissionOverride
   - AuditLog
   - SystemEventLog
   - ErrorLog
   - ModelCallLog
   - UsageDailyStat
   - RateLimitLog
   - BackupJob
   - UserPrivacySetting
   - EvalCase
   - EvalRun
   - EvalResult
   - SystemSetting

4. 实现 src/auth/：
   - permission.service.ts
   - permission-guard.ts
   - role-permissions.ts
   - user-role.service.ts
   角色包括：
   - owner
   - admin
   - tester
   - public_user
   - blocked

5. 将所有 admin / owner only 接口接入 PermissionGuard：
   - /admin/*
   - /v1/reflection/*
   - /v1/creator-assistant/*
   - /v1/openclaw/*
   - /v1/external-actions/*
   - /v1/assets/upload
   - /v1/tools/execute
   - /v1/admin/backups/*
   - /v1/admin/settings/*

6. 实现 AuditLogService：
   - src/audit/audit-log.service.ts
   - 记录所有重要 mutation：
     - user role change
     - memory apply/update/archive
     - reflection proposal approve/reject/apply
     - draft approve/reject/update
     - external action approve/reject/run
     - asset upload/review/archive/delete
     - backup create/restore
     - settings update

7. 实现 ErrorLogService 和 SystemEventLogService：
   - src/logs/error-log.service.ts
   - src/logs/system-event-log.service.ts
   - Fastify error handler 中写 ErrorLog
   - 关键系统事件写 SystemEventLog

8. 实现 Usage / Cost Tracking：
   - src/usage/model-call-log.service.ts
   - src/usage/cost-estimate.service.ts
   - src/usage/usage-daily-stat.service.ts
   - 所有 ModelProvider / EmbeddingProvider 调用写 ModelCallLog
   - 支持 usage daily aggregation

9. 实现 Rate Limit：
   - src/rate-limit/rate-limit.service.ts
   - src/rate-limit/rate-limit-guard.ts
   - public_user / tester / owner 不同限制
   - 被限流时写 RateLimitLog
   - owner 可绕过限流

10. 实现 Backup & Export：
    - src/backup/backup.service.ts
    - src/backup/export.service.ts
    - src/backup/restore.service.ts
    - scripts/backup-create.ts
    - scripts/backup-restore.ts
    - scripts/export-persona.ts
    - scripts/export-memories.ts
    - scripts/export-assets-metadata.ts
    - scripts/export-project-snapshot.ts
    v1.0 restore 可以先做脚本，不强制做完整 UI。

11. 实现 Health Check：
    - src/health/health.service.ts
    - checks:
      - database-health.check.ts
      - pgvector-health.check.ts
      - embedding-health.check.ts
      - model-provider-health.check.ts
      - storage-health.check.ts
      - letta-health.check.ts
      - openclaw-health.check.ts
    routes:
      - GET /v1/health
      - GET /v1/health/deep
      - GET /v1/status

12. 实现 Privacy：
    - src/privacy/privacy.service.ts
    - src/privacy/user-data-export.service.ts
    - src/privacy/user-data-delete.service.ts
    - UserPrivacySetting
    - 支持导出某个用户数据
    - 支持删除某个用户 conversations / memories
    - 支持禁用某个用户长期记忆

13. 实现 Admin Overview：
    - src/admin/admin-overview.service.ts
    - GET /v1/admin/overview
    返回：
    - messages_today
    - model_calls_today
    - estimated_cost_today
    - pending_drafts
    - pending_approvals
    - pending_reflection_proposals
    - new_external_inbox
    - asset_count
    - recent_errors

14. 实现 admin routes：
    - GET /v1/admin/overview
    - GET /v1/admin/users
    - GET /v1/admin/users/:userId
    - PATCH /v1/admin/users/:userId/role
    - POST /v1/admin/users/:userId/block
    - POST /v1/admin/users/:userId/unblock
    - GET /v1/admin/users/:userId/export
    - DELETE /v1/admin/users/:userId/data
    - GET /v1/admin/audit-logs
    - GET /v1/admin/error-logs
    - GET /v1/admin/usage/daily
    - GET /v1/admin/usage/models
    - GET /v1/admin/costs
    - GET /v1/admin/settings
    - PATCH /v1/admin/settings/:key

15. 实现 backup routes：
    - POST /v1/admin/backups
    - GET /v1/admin/backups
    - GET /v1/admin/backups/:id
    - POST /v1/admin/backups/:id/restore
    restore 必须 owner only。

16. 实现 Eval Framework 占位：
    - src/eval/eval.service.ts
    - src/eval/eval-runner.ts
    - src/eval/eval-judge.ts
    - EvalCase / EvalRun / EvalResult models
    - scripts/run-eval.ts
    - 创建 eval/cases/persona.eval.yaml
    - 创建 eval/cases/memory.eval.yaml
    - 创建 eval/cases/safety.eval.yaml
    - 创建 eval/cases/tool-boundary.eval.yaml
    - 创建 eval/cases/action-boundary.eval.yaml
    具体测试用例先写 TODO 占位，不需要补全。

17. 更新 package.json scripts：
    - "backup:create": "tsx scripts/backup-create.ts"
    - "backup:restore": "tsx scripts/backup-restore.ts"
    - "export:persona": "tsx scripts/export-persona.ts"
    - "export:memories": "tsx scripts/export-memories.ts"
    - "export:assets-metadata": "tsx scripts/export-assets-metadata.ts"
    - "export:project-snapshot": "tsx scripts/export-project-snapshot.ts"
    - "usage:aggregate": "tsx scripts/aggregate-usage-daily.ts"
    - "health:check": "tsx scripts/health-check.ts"
    - "eval:persona": "tsx scripts/run-eval.ts --type=persona"
    - "eval:memory": "tsx scripts/run-eval.ts --type=memory"
    - "eval:safety": "tsx scripts/run-eval.ts --type=safety"
    - "eval:all": "tsx scripts/run-eval.ts --type=all"

18. Web Admin 整合：
    - /admin
    - Overview
    - Users
    - Conversations
    - Memories
    - Drafts
    - Reflection
    - Creator Assistant
    - OpenClaw
    - Assets
    - Approvals
    - Logs
    - Backups
    - Costs
    - Settings
    - Health
    不要求 UI 很漂亮，但必须能查看和操作关键后台功能。

19. Public Web 隐私提示：
    - 陆思源是原创 AI 数字人，不是真人
    - 不要输入敏感隐私
    - 聊天可能被用于改进角色体验和长期记忆系统
    - 用户可以请求删除自己的对话或记忆

20. 新增文档：
    - docs/DEPLOYMENT.md
    - docs/PRODUCTION_CHECKLIST.md
    - docs/BACKUP_RESTORE.md
    - docs/SECURITY.md
    - docs/PRIVACY.md
    - docs/EVAL_FRAMEWORK.md
    - docs/PUBLIC_BETA_V1.0.md

限制：
- 不要新增语音实时互动
- 不要新增自动发布
- 不要新增自动回复私信
- 不要做 Qdrant 迁移
- 不要做多 Agent Studio
- 不要做完整付费系统
- 不要补具体人格测试用例，只做 Eval 框架和占位
- 不要让 public_user 访问 admin 功能
- 不要让 public_user 调用高风险工具
- 不要把备份恢复开放给非 owner

验收：
- owner/admin/tester/public_user/blocked 角色可用
- admin 接口有权限保护
- 重要 mutation 写 AuditLog
- 错误写 ErrorLog
- 模型调用写 ModelCallLog
- public_user 有限流
- 备份和导出脚本可运行
- /v1/health 和 /v1/health/deep 可用
- 用户数据可导出和删除
- Eval 框架存在，测试用例文件占位
- Admin Overview 可查看系统状态
- Public Web 有隐私提示
- 部署文档和生产检查清单存在
- 原有 v0.1-v0.9 功能不受影响
```

---

# 25. v1.0 最终效果

v1.0 完成后，陆思源系统会从：

```text
一个功能很完整的开发中系统
```

变成：

```text
一个可以长期运行、可以少量公开测试、可以维护、可以审计、可以备份、可以回滚的 Public Beta 系统。
```

这一步非常重要。
因为 v0.1～v0.9 是“造能力”，而 v1.0 是“让这些能力不会失控”。
