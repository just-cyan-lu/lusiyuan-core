# Settings 配置页审计（2026-06-25）

## 背景

目标页面：`http://localhost:64111/admin/settings`

这个页面目前混合了两类配置：

- 运行时配置：来自 `src/config/runtime-settings.registry.ts`，写入数据库，通常保存后立即生效。
- `.env` 连接配置：来自 `src/routes/admin.route.ts` 的 `editableEnvConfig`，写入 `.env`，通常需要重启进程才生效。

审计范围是“是否仍然被代码读取、是否有必要继续出现在配置页、用在哪里”。本次只做审计记录，不改配置逻辑。

## 总结

- 运行时配置原有 91 个，已删除 `REFLECTION_OWNER_ONLY`、`DREAM_AUTO_APPLY`、`MINIMAX_REASONING_SPLIT`、`REPLY_PROGRESS_DRAFT_ENABLED`、`RELATIONSHIP_UPDATE_MODE`、`RELATIONSHIP_REVIEW_MIN_SIGNALS`，当前为 85 个。
- 绝大多数配置可以确认接入了业务路径。
- 2 个完全没有业务读取，先保留给 Dream 后续重构：`DREAM_MORNING_BRIEF_ENABLED`、`DREAM_MIN_SIGNAL_SCORE`。
- 1 个只出现在 admin 状态摘要里，没有真正约束业务，先保留给 Dream 后续重构：`DREAM_MAX_LOOKBACK_DAYS`。
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
| 记忆检索 | `MEMORY_RETRIEVAL_ENABLED`、`MEMORY_SEMANTIC_TOP_K`、`MEMORY_FINAL_TOP_K`、`MEMORY_MAX_TOTAL_CHARS` | 保留 | `src/core/memory.service.ts`、`src/core/memory-retrieval.service.ts`、`src/core/memory-budget.ts`、`src/reflection/reflection-proposal.service.ts` |
| 工具 | `TOOLS_ENABLED`、`TOOLS_AUTO_EXECUTE_LOW_RISK`、`TOOLS_ALLOW_MEDIUM_RISK`、`TOOLS_ALLOW_HIGH_RISK`、`TOOL_MAX_CALLS_PER_MESSAGE`、`TOOL_TIMEOUT_MS`、`TOOL_LOG_INPUT_OUTPUT` | 保留 | `src/core/chat.service.ts`、`src/tools/policy/action-policy.ts`、`src/tools/tool-executor.ts`、`src/routes/tools.route.ts` |
| 工具访问 | `TOOL_SEARCH_MEMORIES_MODE`、`TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE`、`TOOL_WEB_SEARCH_MODE`、`TOOL_READ_PAGE_MODE` | 保留 | `src/tools/builtin/*.tool.ts` |
| Reflection | 全部 Reflection 配置 | 保留 | `src/routes/reflection.route.ts`、`src/reflection/*` |
| Dream | 除下方问题项外的 Dream 配置 | 保留 | `src/dream/*`、`src/routes/dream.route.ts`、`src/app.ts` |
| 运行态自启动 | `RUNTIME_AUTONOMY_AUTO_RUN`、`RUNTIME_AUTONOMY_CRON`、`RUNTIME_AUTONOMY_TIMEZONE` | 保留 | `src/runtime/runtime-autonomy-scheduler.ts`、`src/app.ts` |
| 网页能力 | `TAVILY_ENABLED`、`TAVILY_MAX_RESULTS`、`TAVILY_SEARCH_DEPTH`、`JINA_ENABLED`、`PLAYWRIGHT_ENABLED`、`PLAYWRIGHT_MAX_PAGE_TEXT_CHARS`、`PLAYWRIGHT_SCREENSHOT_ENABLED` | 保留 | `src/web-search/*`、`src/page-reader/*`、`src/tools/builtin/read-page.tool.ts`、`src/platforms/xiaohongshu/xiaohongshu-url-import.service.ts` |
| Chrome MCP | `MCP_ENABLED`、`CHROME_DEVTOOLS_MCP_ENABLED`、`CHROME_DEVTOOLS_MCP_CONNECTION_MODE`、`CHROME_DEVTOOLS_MCP_BROWSER_URL`、`CHROME_DEVTOOLS_MCP_MIN_OPEN_INTERVAL_MS`、`CHROME_DEVTOOLS_MCP_SETTLE_MIN_MS`、`CHROME_DEVTOOLS_MCP_SETTLE_MAX_MS`、`CHROME_DEVTOOLS_MCP_MAX_COMMENTS` | 保留 | `src/mcp/chrome-devtools-mcp.service.ts`、`src/tools/builtin/read-page.tool.ts`、`src/app.ts`、小红书导入服务 |
| 渠道 | `TELEGRAM_ENABLED`、`TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS`、`TELEGRAM_FILE_DOWNLOAD_RETRIES`、`TELEGRAM_MAX_IMAGE_FILE_BYTES`、`WEIXIN_ENABLED` | 保留 | `src/channels/telegram/*`、`src/channels/weixin/weixin.route.ts`、`src/app.ts` |

## 需要清理或接线的运行时配置

| 配置项 | 当前状态 | 判断 | 建议 |
| --- | --- | --- | --- |
| `DREAM_MORNING_BRIEF_ENABLED` | Morning Brief 服务和接口存在，但这个开关没有被读取。接口 `GET /v1/dream/jobs/:jobId/morning-brief` 总是可用。 | 开关未接线。 | 如果 Morning Brief 要一直作为只读报告，删除开关；如果要可关闭，就在路由或 service 加判断。 |
| `DREAM_MIN_SIGNAL_SCORE` | `computeSignalScore` 会计算并写入 `strength`，但没有用这个配置做过滤。 | 配置名表达“最低分数”，实际不生效。 | 要么在 `filterSignals` 或写入前用 `computeSignalScore(s) >= DREAM_MIN_SIGNAL_SCORE` 过滤，要么删除。 |
| `DREAM_MAX_LOOKBACK_DAYS` | 只在 admin runtime 摘要里展示，没有限制手动 `lookback_hours` 或 job 的 `from/to`。 | 弱生效，属于“显示有，约束无”。 | 若保留，应在 `dream.route.ts` 或 `dream.service.ts` clamp 最大回看范围；否则删除。 |

## Pending：关系好感度入口

- 关系模块已从“熟悉度、信任度、亲近感、关系张力”四维分数收敛为单一 `affinity`（好感度）。
- 当前聊天不再靠关键词自动升降关系，也删除了 `RELATIONSHIP_UPDATE_MODE`、`RELATIONSHIP_REVIEW_MIN_SIGNALS` 两个设置项。
- 未来入口保留在 `relationshipStateService.applyAffinityPatch(...)`：Reflection/Dream 后续如果根据复盘、梦境、证据链判断要调整好感度，应通过这个方法写入，并带上 `source`、`reason`、`delta`/`affinity`、`evidence`，方便 admin 审计、导出和后续训练数据整理。
- 后续整理 Dream/Reflection 时再设计“什么证据可以影响好感度、一次最多变化多少、是否需要 admin 确认或可回滚”。

## Pending：聊天上下文结构

- 第一阶段已从固定最近 10 条 `Message` 改成 `CHAT_CONTEXT_MAX_CHARS` 字符预算：按内容大小回填最近对话，不按消息条数。
- 第一阶段已把同一次最终分条回复按 `replyGroupId` 合并，过滤 `intermediate` 消息，并排除本轮刚入库的用户消息，避免 prompt 里重复出现当前输入。
- 当前先使用字符预算，不是精确 token 预算。后续如果接入模型 tokenizer 或 provider token counting，应把预算从“字符近似”升级为“输入 token 预算”。
- 后续应设计真正的 compact：较早历史不直接整段塞进 prompt，而是压缩成可审计的阶段摘要/事实摘要，并保留来源消息窗口，方便用户追问时回看原文。
- `summarize_recent_conversation` 目前只是工具调用时从数据库回看最近 20 条消息并结构化总结，和普通 prompt 的最近上下文有重叠。后续要么删除，要么改成明确的“更早历史压缩/原文回看”工具，例如命中旧话题后拉取相关消息窗口并产出上下文摘要。

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
- `REFLECTION_AUTO_APPLY` 真的会用于 proposal service；已删除没有真实应用路径的 `DREAM_AUTO_APPLY`。

## 建议清理顺序

1. 后续 Dream 重构时重新处理 `DREAM_MORNING_BRIEF_ENABLED`、`DREAM_MIN_SIGNAL_SCORE`、`DREAM_MAX_LOOKBACK_DAYS`。
2. 整理 `.env` 页面语义：`TELEGRAM_MODE`、`WEB_ORIGIN`、`TAVILY_API_KEY`/`TAVILY_API_KEYS`。
3. 决定是否删除 legacy `MODEL_*` fallback。
4. 最后再做前端分组文案优化，把“立即生效”和“需要重启”更明显地区分开。

## 审计命令

主要用这些方式核对：

- 从 `runtimeSettingDefinitions` 取出全部 runtime key，扫描 `src` 下除 registry/service 外的业务引用。
- 扫描 `editableEnvConfig` 中的 `.env` key，排除 admin route/env loader 后看实际业务引用。
- 对问题项逐个看调用链和路由行为。
