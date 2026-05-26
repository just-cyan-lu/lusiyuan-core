# TODO: Admin 平台功能清单

## 背景

Core API 目前所有管理操作都只能通过 HTTP API 或 CLI 完成，没有图形界面。
这份文档整理 Admin 平台需要覆盖的功能，作为前端仓库（lusiyuan-web）的规划参考。

---

## 已有的 API 基础

Admin 平台需要对接的现有接口：

| 模块 | 接口 |
|------|------|
| 记忆 | `GET /v1/users/:userId/memories` |
| 草稿 | `GET /v1/drafts`、`GET /v1/drafts/:id`、`PATCH /v1/drafts/:id/status` |
| 工具 | `GET /v1/tools`、`POST /v1/tools/:toolName/execute`、`GET /v1/tool-logs` |
| 对话 | `GET /v1/conversations/:conversationId/messages` |
| 渠道 | `GET /v1/channels/status` |
| Reflection | `POST /v1/reflection/run`、`GET /v1/reflection/reports`、`GET /v1/reflection/proposals`、`POST /v1/reflection/proposals/:id/approve`、`POST /v1/reflection/proposals/:id/reject`、`POST /v1/reflection/proposals/:id/apply`、`GET /v1/reflection/risks` |
| Dream | `POST /v1/dream/run`、`GET /v1/dream/jobs/:id`、`GET /v1/dream/diary`、`GET /v1/dream/daily-notes`、`GET /v1/dream/signals`、`GET /v1/dream/jobs/:id/morning-brief` |

---

## 功能清单

### 1. 记忆管理

- [ ] 列出某个用户的所有记忆（分页、按类型/重要度筛选）
- [ ] 查看单条记忆详情（content、type、scope、importance、confidence、tags、entities、source）
- [ ] 手动编辑记忆内容
- [ ] 手动删除记忆
- [ ] 手动新增记忆

### 2. 记忆提案审核

> 目前只能 curl，是最迫切需要界面的功能

- [ ] 列出待审核的 MemoryProposal（按 Reflection / Dream 来源分组）
- [ ] 查看提案详情（proposalType、content、reason、confidence、riskLevel、sourceMessageIds）
- [ ] 逐条批准 / 拒绝
- [ ] 批准后一键 apply（写入 Memory 表）
- [ ] 批量操作（全部批准、全部拒绝）
- [ ] 查看已处理的历史提案

### 3. Reflection

- [ ] 手动触发 Reflection（选择 scope / userId / 消息数量）
- [ ] 查看 Reflection 报告列表
- [ ] 查看单份报告详情（分析摘要、提案列表、风险标记）
- [ ] 查看风险标记列表（RiskFlag），按严重程度筛选

### 4. Dream Cycle

- [ ] 手动触发 Dream（选择回溯时间范围）
- [ ] 查看 Dream Job 状态（running / completed / failed）
- [ ] 查看 Morning Brief（每次 Dream 的结果摘要）
- [ ] 查看梦境日记（DreamDiary）列表和详情
- [ ] 查看 Daily Note 列表
- [ ] 查看 Dream Signal 列表（提取出的信号，带评分）

### 5. 草稿管理

- [ ] 列出所有草稿（按状态筛选：pending / approved / rejected）
- [ ] 查看草稿详情
- [ ] 更新草稿状态（approve / reject）

### 6. 对话历史

- [ ] 列出用户列表
- [ ] 查看某个用户的对话列表
- [ ] 查看某个对话的消息记录

### 7. 工具调用日志

- [ ] 查看 ToolCallLog 列表（按工具名、状态、时间筛选）
- [ ] 查看单条日志详情（输入、输出、执行时长、是否被拦截）

### 8. 渠道状态

- [ ] 查看各渠道（Telegram、微信等）的连接状态

---

## 优先级建议

最迫切（目前完全没有界面）：

1. **记忆提案审核** — Reflection 和 Dream 生成的提案堆在数据库里，没有界面就没法用
2. **记忆管理** — 查看和清理记忆，目前只能直接查数据库
3. **Dream / Reflection 触发 + 结果查看** — 手动触发目前要 curl

其次：

4. 草稿管理
5. 对话历史
6. 工具调用日志

---

## 不在 Admin 平台做的

- 自动发布内容（不做）
- 用户注册 / 权限管理（目前只有 owner 概念，不需要多用户后台）
- 数据统计 / 图表（v1.1 Content Ops 阶段再考虑）
