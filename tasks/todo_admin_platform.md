# TODO: Admin 平台功能清单

## 背景

Core API 目前所有管理操作都只能通过 HTTP API 或 CLI 完成，没有图形界面。
这份文档整理 Admin 平台需要覆盖的功能，作为前端仓库（lusiyuan-web）的规划参考。

> 2026-06 更新：记忆库、记忆提案审核、Reflection / Dream 工作台已经进入当前 admin。这里仍保留原始清单，但已实现项会标成完成。

---

## 已有的 API 基础

Admin 平台需要对接的现有接口：

| 模块 | 接口 |
|------|------|
| 记忆 | `GET /v1/users/:userId/memories` |
| 工具 | `GET /v1/tools`、`POST /v1/tools/:toolName/execute`、`GET /v1/tool-logs` |
| 对话追溯 | `GET /v1/admin/conversation-people`、`GET /v1/admin/conversation-people/:personId`、`GET /v1/admin/conversations/:conversationId/messages` |
| Skills | `GET /v1/admin/skills`、`GET /v1/admin/skills/xiaohongshu-reply/config`、`PATCH /v1/admin/skills/xiaohongshu-reply/config`、`POST /v1/admin/skills/xiaohongshu-reply/config/reset`、`POST /v1/admin/skills/xiaohongshu-reply/draft` |
| 小红书工作台 | `GET /v1/admin/xiaohongshu/posts`、`GET /v1/admin/xiaohongshu/import-status`、`POST /v1/admin/xiaohongshu/import-url`、`PATCH /v1/admin/xiaohongshu/posts/:postId`、`PATCH /v1/admin/xiaohongshu/comments/:commentId`、`POST /v1/admin/xiaohongshu/comments/:commentId/generate-reply`、`POST /v1/admin/xiaohongshu/comments/:commentId/final-decision` |
| 渠道 | `GET /v1/channels/status` |
| Reflection | `POST /v1/reflection/run`、`GET /v1/reflection/reports`、`GET /v1/reflection/proposals`、`POST /v1/reflection/proposals/:id/approve`、`POST /v1/reflection/proposals/:id/reject`、`POST /v1/reflection/proposals/:id/apply`、`GET /v1/reflection/risks` |
| Dream | `POST /v1/dream/run`、`GET /v1/dream/jobs/:id`、`GET /v1/dream/diary`、`GET /v1/dream/daily-notes`、`GET /v1/dream/signals`、`GET /v1/dream/jobs/:id/morning-brief` |

---

## 功能清单

### 1. 记忆管理

- [x] 列出记忆（按用户、状态、范围、类型、时间、关键词筛选）
- [x] 查看单条记忆详情（content、type、scope、importance、confidence、tags、entities、source）
- [x] 手动编辑记忆内容
- [x] 手动归档记忆
- [x] 手动新增记忆

### 2. 记忆提案审核

> 目前只能 curl，是最迫切需要界面的功能

- [x] 列出待审核的 MemoryProposal（可按状态、风险、类型、范围、关键词筛选）
- [x] 查看提案详情（proposalType、content、reason、confidence、riskLevel、sourceMessageIds）
- [x] 逐条批准 / 拒绝
- [x] 批准后一键 apply（写入 Memory 表）
- [x] 批量操作（当前筛选下批量批准、批量应用）
- [x] 查看已处理的历史提案

### 3. Reflection

- [x] 手动触发 Reflection（选择复盘范围 / userId / conversationId / 消息数量）
- [x] 查看 Reflection 报告列表
- [x] 查看单份报告详情（分析摘要、提案列表、风险标记、成长日志）
- [x] 查看风险标记列表（RiskFlag）

### 4. Dream Cycle

- [x] 手动触发 Dream（选择回溯小时数，可选 userId）
- [x] 查看 Dream Job 状态（running / completed / failed）
- [x] 查看 Morning Brief（每次 Dream 的结果摘要）
- [x] 查看梦境日记（DreamDiary）列表和内容
- [x] 查看 Daily Note 列表
- [x] 查看 Dream Signal 列表（提取出的信号，带评分）
- [x] 查看 Deep Sleep 整合结果（记忆提案、风险项、成长日志提案）

### 5. 对话追溯

- [x] 按现实身份列出用户，owner 置顶、最近互动优先
- [x] 支持搜索现实身份 / 渠道 user / 显示名
- [x] 查看某个现实身份绑定的渠道账号
- [x] 查看某个渠道账号的会话列表
- [x] 查看某个会话的消息记录
- [x] 和关系页面互相跳转，但关系修改仍留在关系页面

### 6. 工具调用日志

- [ ] 查看 ToolCallLog 列表（按工具名、状态、时间筛选）
- [ ] 查看单条日志详情（输入、输出、执行时长、是否被拦截）

### 7. Skill 管理

- [x] 查看已注册的 skill 和平台 profile
- [x] 小红书回复 skill 开关归入 SkillConfig，保存后立即生效
- [x] 小红书评论回复草稿测试入口
- [x] 编辑小红书回复 prompt 规范
- [x] 小红书平台页读取回复 skill 状态，关闭时不能生成草稿
- [x] 小红书平台页记录帖子、评论，并手动选择评论生成草稿
- [x] 记录 owner 最终回复或不回复决定，并形成通用表达经验
- [x] 表达学习页面查看、修正、停用和重新分析经验
- [x] 小红书账号镜像与幂等同步 API
- [x] 通过 chrome-devtools-mcp 从帖子 URL 读取当前已加载内容
- [x] 导入后编辑帖子、评论和配图 Alt
- [x] 同一页面复用、15 秒新开冷却、3–5 秒随机稳定等待、保留页面和只读工具白名单
- [x] owner 手动导入时有限展开已加载回复，并按顶层评论、子回复、回复目标和作者标记保存

### 8. 渠道状态

- [ ] 查看各渠道（Telegram、微信等）的连接状态

---

## 优先级建议

最迫切（目前完全没有界面）：

1. **记忆提案审核** — Reflection 和 Dream 生成的提案堆在数据库里，没有界面就没法用
2. **记忆管理** — 查看和清理记忆，目前只能直接查数据库
3. **Dream / Reflection 触发 + 结果查看** — 已进入 admin，后续主要是长期试用和细节打磨

其次：

4. 工具调用日志
5. 渠道状态

---

## 不在 Admin 平台做的

- 自动发布内容（不做）
- 用户注册 / 权限管理（目前只有 owner 概念，不需要多用户后台）
- 数据统计 / 图表（v1.1 Content Ops 阶段再考虑）
