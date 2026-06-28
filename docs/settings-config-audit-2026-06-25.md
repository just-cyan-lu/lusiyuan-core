# Settings 配置页审计（2026-06-25）

## 背景

目标页面：`http://localhost:64111/admin/settings`

这个页面目前混合了两类配置：

- 运行时配置：来自 `src/config/runtime-settings.registry.ts`，写入数据库，通常保存后立即生效。
- `.env` 连接配置：来自 `src/routes/admin.route.ts` 的 `editableEnvConfig`，写入 `.env`，通常需要重启进程才生效。

审计范围是“是否仍然被代码读取、是否有必要继续出现在配置页、用在哪里”。本次只做审计记录，不改配置逻辑。

## 总结

- 运行时配置原有 91 个。期间新增聊天上下文配置 6 个，新增 `RUNTIME_STATE_AUTO_UPDATE_ENABLED`、`RUNTIME_AUTONOMY_LOW_CHAT_COUNT`、`RUNTIME_AUTONOMY_HIGH_CHAT_COUNT`；已删除 `REFLECTION_OWNER_ONLY`、`REFLECTION_ENABLED`、`REFLECTION_DEFAULT_MESSAGE_LIMIT`、`REFLECTION_MAX_MESSAGE_LIMIT`、`REFLECTION_MIN_MESSAGES`、`REFLECTION_INCLUDE_MEMORIES`、`REFLECTION_AUTO_APPLY`、`REFLECTION_PROPOSAL_MIN_CONFIDENCE`、`REFLECTION_PROPOSAL_MAX_PER_RUN`、`REFLECTION_ENABLE_GROWTH_LOG`、`DREAM_AUTO_APPLY`、`DREAM_AUTO_RUN`、`RUNTIME_AUTONOMY_TIMEZONE`、`MINIMAX_REASONING_SPLIT`、`REPLY_PROGRESS_DRAFT_ENABLED`、`RELATIONSHIP_UPDATE_MODE`、`RELATIONSHIP_REVIEW_MIN_SIGNALS`，以及 23 个 Dream 窗口/阈值/展示/脱敏/阶段配置，当前为 56 个。
- 绝大多数配置可以确认接入了业务路径。
- Dream 已从“固定回看小时 + 抽样上限 + 多个阈值”收敛为“上一次成功 Dream 到本次 Dream 的连续区间”，避免自动整理漏消息。
- `.env` 配置大部分都在用，但有几个需要整理显示语义：`TELEGRAM_MODE`、`WEB_ORIGIN`、`TAVILY_API_KEY`/`TAVILY_API_KEYS`、旧的 `MODEL_*` fallback。

## 运行时配置入口

- 定义：`src/config/runtime-settings.registry.ts`
- 读取与校验：`src/config/runtime-settings.service.ts`
- API：`GET/PATCH /v1/admin/settings`，位于 `src/routes/admin.route.ts`
- 前端页面：`web/src/components/admin/ConfigCenterPage.tsx`

## 运行时配置分组结论

| 分组 | 配置项 | 结论 | 主要使用位置 |
| --- | --- | --- | --- |
| 模型运行 | `ACTIVE_MODEL_PROVIDER`、`MINIMAX_THINKING_TYPE`、`MINIMAX_MAX_COMPLETION_TOKENS` | 保留 | `src/core/model-provider.ts` |
| 聊天限制 | `MAX_MESSAGE_LENGTH` | 保留 | `src/core/safety.ts`、`src/channels/telegram/telegram.bot.ts` |
| 回复投递 | `REPLY_DELIVERY_MODE`、`REPLY_SEGMENTATION_LLM_ENABLED`、`REPLY_SEGMENT_MIN_CHARS`、`REPLY_SEGMENT_MAX_CHARS`、`REPLY_SEGMENT_MAX_COUNT`、`REPLY_HUMAN_DELAY_MIN_MS`、`REPLY_HUMAN_DELAY_MAX_MS` | 保留 | `src/core/chat.service.ts`、`src/core/reply-segmentation.service.ts` |
| 记忆检索 | `MEMORY_RETRIEVAL_ENABLED`、`MEMORY_SEMANTIC_TOP_K`、`MEMORY_FINAL_TOP_K`、`MEMORY_MAX_TOTAL_CHARS` | 保留 | `src/core/memory.service.ts`、`src/core/memory-retrieval.service.ts`、`src/core/memory-budget.ts`、`src/memory/memory-proposal.service.ts` |
| 工具 | `TOOLS_ENABLED`、`TOOLS_AUTO_EXECUTE_LOW_RISK`、`TOOLS_ALLOW_MEDIUM_RISK`、`TOOLS_ALLOW_HIGH_RISK`、`TOOL_MAX_CALLS_PER_MESSAGE`、`TOOL_TIMEOUT_MS`、`TOOL_LOG_INPUT_OUTPUT` | 保留 | `src/core/chat.service.ts`、`src/tools/policy/action-policy.ts`、`src/tools/tool-executor.ts`、`src/routes/tools.route.ts` |
| 工具访问 | `TOOL_SEARCH_MEMORIES_MODE`、`TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE`、`TOOL_WEB_SEARCH_MODE`、`TOOL_READ_PAGE_MODE` | 保留 | `src/tools/builtin/*.tool.ts` |
| Reflection | 无运行时配置 | 手动 Reflection 已删除；记忆提案审核由 Dream 产物和记忆页面承接 | `src/dream/*`、`src/routes/memory-proposals.route.ts` |
| Dream | `DREAM_ENABLED`、`DREAM_CRON` | 保留 | `src/dream/*`、`src/routes/dream.route.ts`、`src/app.ts` |
| 运行态 | `RUNTIME_STATE_AUTO_UPDATE_ENABLED`、`RUNTIME_AUTONOMY_AUTO_RUN`、`RUNTIME_AUTONOMY_CRON`、`RUNTIME_AUTONOMY_LOW_CHAT_COUNT`、`RUNTIME_AUTONOMY_HIGH_CHAT_COUNT` | 保留；自动校准总开关从 RuntimeState 字段迁到 system_settings，时区改用服务器本地时间；自启动聊天密度阈值可配置 | `src/runtime/runtime-state.service.ts`、`src/runtime/runtime-autonomy-scheduler.ts`、`src/app.ts` |
| 网页能力 | `TAVILY_ENABLED`、`TAVILY_MAX_RESULTS`、`TAVILY_SEARCH_DEPTH`、`JINA_ENABLED`、`PLAYWRIGHT_ENABLED` | 保留；`PLAYWRIGHT_MAX_PAGE_TEXT_CHARS`、`PLAYWRIGHT_SCREENSHOT_ENABLED` 已删除，网页读取不再强制截断；Playwright 或 Chrome MCP 被选中时可返回截图，Jina 不支持截图 | `src/web-search/*`、`src/page-reader/*`、`src/tools/builtin/read-page.tool.ts`、`src/platforms/xiaohongshu/xiaohongshu-url-import.service.ts` |
| Chrome MCP | `MCP_ENABLED`、`CHROME_DEVTOOLS_MCP_ENABLED`、`CHROME_DEVTOOLS_MCP_CONNECTION_MODE`、`CHROME_DEVTOOLS_MCP_BROWSER_URL`、`CHROME_DEVTOOLS_MCP_MIN_OPEN_INTERVAL_MS`、`CHROME_DEVTOOLS_MCP_SETTLE_MIN_MS`、`CHROME_DEVTOOLS_MCP_SETTLE_MAX_MS` | 保留；`CHROME_DEVTOOLS_MCP_MAX_COMMENTS` 已删除，小红书导入使用代码内固定上限 | `src/mcp/chrome-devtools-mcp.service.ts`、`src/tools/builtin/read-page.tool.ts`、`src/app.ts`、小红书导入服务 |
| 渠道 | `TELEGRAM_ENABLED`、`TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS`、`TELEGRAM_FILE_DOWNLOAD_RETRIES`、`TELEGRAM_MAX_IMAGE_FILE_BYTES`、`WEIXIN_ENABLED` | 保留 | `src/channels/telegram/*`、`src/channels/weixin/weixin.route.ts`、`src/app.ts` |

## 本轮已清理的 Dream 运行时配置

Dream 相关配置已删除 23 个：`DREAM_TIMEZONE`、`DREAM_DEFAULT_LOOKBACK_HOURS`、`DREAM_MAX_LOOKBACK_DAYS`、`DREAM_MIN_SOURCE_EVENTS`、`DREAM_MAX_MESSAGES`、`DREAM_MAX_TOOL_CALLS`、`DREAM_MAX_REFLECTION_REPORTS`、`DREAM_MAX_MEMORY_PROPOSALS`、`DREAM_MORNING_BRIEF_ENABLED`、`DREAM_MIN_SIGNAL_SCORE`、`DREAM_MIN_CONFIDENCE`、`DREAM_MIN_EVIDENCE_COUNT`、`DREAM_MAX_PROPOSALS_PER_RUN`、`DREAM_DIARY_MAX_CHARS`、`DREAM_DIARY_VISIBILITY`、`DREAM_REDACT_PRIVATE_DATA`、`DREAM_LIGHT_ENABLED`、`DREAM_REM_ENABLED`、`DREAM_DEEP_ENABLED`、`DREAM_DIARY_ENABLED`、`DREAM_ALLOW_MEMORY_PROPOSALS`、`DREAM_ALLOW_GROWTH_LOG_PROPOSALS`、`DREAM_LOCK_TTL_MINUTES`。

新的判断：

- `DREAM_TIMEZONE`：删除，`DREAM_CRON` 使用服务器本地时间。
- 回看窗口与各来源抽样上限：删除，Dream 自动/手动运行时使用上一次成功 Dream 的 `toTime` 到本次运行时间，区间内来源完整读取。
- 信号阈值、提案数量和日记长度限制：删除，不在写库前因为配置阈值提前丢弃训练材料。
- `DREAM_MORNING_BRIEF_ENABLED`：删除未接线开关，Morning Brief 保留为 Job 的只读摘要接口。
- `DREAM_DIARY_VISIBILITY`：删除，当前无 admin 账号/权限层，日记固定写入 `internal` 标记。
- `DREAM_REDACT_PRIVATE_DATA`：删除，Dream 产物只在 admin 查看，且后续训练/导出更需要保留完整原始材料。
- Dream 阶段和提案类型开关：删除，`DREAM_ENABLED=true` 时固定完整运行 Daily Note、Dream Signal、Dream Diary、Deep Sleep，并生成待审核提案。
- `DREAM_LOCK_TTL_MINUTES`：删除配置项；Dream 使用不可过期运行锁防并发，拿不到锁时本次运行返回 `running` 并跳过，等待下次 cron 继续。

## Pending：关系好感度入口

- 关系模块已从“熟悉度、信任度、亲近感、关系张力”四维分数收敛为单一 `affinity`（好感度）。
- 当前聊天不再靠关键词自动升降关系，也删除了 `RELATIONSHIP_UPDATE_MODE`、`RELATIONSHIP_REVIEW_MIN_SIGNALS` 两个设置项。
- 未来入口保留在 `relationshipStateService.applyAffinityPatch(...)`：Dream 或未来统一整理器后续如果根据梦境、证据链判断要调整好感度，应通过这个方法写入，并带上 `source`、`reason`、`delta`/`affinity`、`evidence`，方便 admin 审计、导出和后续训练数据整理。
- 后续整理 Dream 时再设计“什么证据可以影响好感度、一次最多变化多少、是否需要 admin 确认或可回滚”。

## Pending：聊天上下文结构

- 第一阶段已从固定最近 10 条 `Message` 改成 `CHAT_CONTEXT_MAX_CHARS` 字符预算：按内容大小回填最近对话，不按消息条数。
- 第一阶段已把同一次最终分条回复按 `replyGroupId` 合并，过滤 `intermediate` 消息，并排除本轮刚入库的用户消息，避免 prompt 里重复出现当前输入。
- 当前先使用字符预算，不是精确 token 预算。后续如果接入模型 tokenizer 或 provider token counting，应把预算从“字符近似”升级为“输入 token 预算”。
- 第二阶段已拆成三层上下文：最近原文热区、较早对话 compact 摘要、按当前问题向量召回的旧原文窗口。
- compact 摘要写入 `conversation_context_summaries`，保留来源消息范围和消息数，后续可以审计、导出或重新生成。
- 旧原文召回写入 `message_embeddings`，召回时返回命中消息前后的原文窗口，不只给模型一个模糊摘要。旧消息可用 `npm run context:index` 做 embedding backfill。
- `summarize_recent_conversation` 目前只是工具调用时从数据库回看最近 20 条消息并结构化总结，和普通 prompt 的最近上下文有重叠。后续要么删除，要么改成明确的“临时原文回看/按范围总结”工具，避免和自动 compact、向量召回重复。

## `.env` 配置审计

`.env` 配置定义在 `src/routes/admin.route.ts` 的 `editableEnvConfig`。这些字段不是数据库 runtime settings，修改后通常需要重启。

| 配置项 | 当前状态 | 主要使用位置 | 建议 |
| --- | --- | --- | --- |
| `OPENAI_*`、`ANTHROPIC_*`、`GLM_*`、`QWEN_*`、`DEEPSEEK_*`、`MINIMAX_*`、`KIMI_*`、`SILICONFLOW_*` | 在用 | `src/core/model-provider.ts` | 保留。它们和 `ACTIVE_MODEL_PROVIDER` 配套。 |
| `TELEGRAM_BOT_TOKEN` | 在用 | `src/channels/telegram/telegram-runtime.ts` | 保留。 |
| `TELEGRAM_MODE` | 只用于状态展示；页面选项只有 `polling`，代码也只实际支持 polling。 | `src/routes/channels.route.ts` | 可以保留为只读展示，也可以先从可编辑配置中移除，等 webhook 真实现再加回来。 |
| `TELEGRAM_PROXY` | 在用 | `src/channels/telegram/telegram.bot.ts` | 保留。注意 `EXTERNAL_HTTP_PROXY` 默认也会 fallback 到它。 |
| `WEIXIN_BRIDGE_SECRET` | 在用 | `src/channels/weixin/weixin.route.ts` | 保留。 |
| `WEB_ORIGIN` | 部分在用。SSE chat route 写了 `Access-Control-Allow-Origin`，但全局 CORS 仍是 `origin: true`。 | `src/routes/chat.route.ts`、`src/app.ts` | 要么改全局 CORS 真正使用它，要么在页面文案里说明它只影响部分 SSE 响应。 |
| `EMBEDDING_BASE_URL`、`EMBEDDING_API_KEY`、`EMBEDDING_MODEL`、`EMBEDDING_DIMENSIONS` | 在用 | `src/embeddings/siliconflow-embedding-provider.ts` | 保留。它们会影响记忆、表达学习等 embedding 能力。 |
| `TAVILY_API_KEY`、`TAVILY_API_KEYS` | 都能生效，但最终会合并成 `env.TAVILY_API_KEYS`。 | `src/utils/env.ts`、`src/web-search/tavily-client.ts` | 页面上建议主推 `TAVILY_API_KEYS`，把单数 key 标成“兼容旧单 key”或移除单数入口。 |
| `JINA_API_KEY` | 在用 | `src/page-reader/jina-reader.ts` | 保留。 |
| `EXTERNAL_HTTP_PROXY` | 在用 | Tavily、Jina、Telegram 文件下载 | 保留。 |

## 额外发现

- `MODEL_BASE_URL`、`MODEL_API_KEY`、`MODEL_NAME` 仍在 `src/utils/env.ts` 和 `src/core/model-provider.ts` 里作为旧单 provider fallback，但没有出现在 settings 页面。开发期如果已经迁到多 provider 结构，可以考虑后续直接删除这组 legacy fallback。
- `WEB_ORIGIN` 目前像是“安全配置”，但全局 CORS 仍允许任意 origin。这个最好单独修，不然配置页会给人一种已经限制来源的错觉。
- 手动 Reflection 已删除。后续记忆提案、成长记录、风险项统一从 Dream 深睡阶段进入待审核队列。
- 已处理：旧 `reflection_jobs`、`reflection_reports`、`reflection_risk_flags` 表已删除；记忆提案、风险项、成长日志现在直接挂到 `dream_consolidation_reports`，由 Dream 深睡阶段统一生成和审核。

## 建议清理顺序

1. 整理 `.env` 页面语义：`TELEGRAM_MODE`、`WEB_ORIGIN`、`TAVILY_API_KEY`/`TAVILY_API_KEYS`。
2. 决定是否删除 legacy `MODEL_*` fallback。
3. 最后再做前端分组文案优化，把“立即生效”和“需要重启”更明显地区分开。

## 审计命令

主要用这些方式核对：

- 从 `runtimeSettingDefinitions` 取出全部 runtime key，扫描 `src` 下除 registry/service 外的业务引用。
- 扫描 `editableEnvConfig` 中的 `.env` key，排除 admin route/env loader 后看实际业务引用。
- 对问题项逐个看调用链和路由行为。
