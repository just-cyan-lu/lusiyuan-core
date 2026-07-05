# Project Map

这是项目当前的模块地图。它讲“这个东西是什么”和“去哪里看代码”。

## 后端入口

**是什么**

`lusiyuan-core` 是陆思源的后端。网页、Telegram、微信桥接等入口，最后都会把消息交给这里。

**在哪里**

- `src/server.ts`：启动服务。
- `src/app.ts`：注册路由、静态前端、Telegram、Dream 定时任务。
- `src/utils/env.ts`：只读取启动、连接和秘密配置。
- `src/config/`：数据库实时运行配置、默认值、校验和变更通知。

## 聊天主链路

**是什么**

一条用户消息进入后端后，会创建用户和会话、保存消息、读取记忆、编译 prompt、调用模型、保存回复。

**在哪里**

- `src/core/chat.service.ts`：聊天主流程。
- `src/core/prompt-builder.ts`：把 persona、记忆、状态和对话历史编译成给模型看的消息。
- `src/core/persona-projection.ts`：选择当前聊天投影，避免把完整人设整包塞给模型。
- `src/runtime/runtime-state.service.ts`：读取运行态、记录状态变更，并只允许梦境、自主检查和 admin 更新长期状态。
- `src/runtime/relationship-state.service.ts`：读取每个现实身份的关系状态，聊天后先记录关系信号，再由复盘更新关系；也会生成待审核的身份怀疑，admin 可以修正、复盘、审核或绑定渠道账号。
- `src/runtime/runtime-autonomy-scheduler.ts`：可选的运行态自启动定时器，默认关闭。
- `src/routes/chat.route.ts`：HTTP 聊天接口。

## Persona 和聊天投影

**是什么**

`persona/` 是陆思源的人设资料。现在分成几类：

- 长设定圣经：回答“陆思源完整来说是谁”。
- 核心卡和接话规则：回答“每轮最少要稳定什么、怎么别像客服”。
- 场景策略：回答“这类对话先怎么接”。
- 行为切片和语气样本：回答“本轮触发什么稳定反应、参考哪类说法”。

日常聊天不会把完整 `personality.md` 全部塞给模型。它会固定带上核心卡和接话规则，再由代码按场景、关系语气和关键词挑选少量相关切片与样本。

**在哪里**

- `persona/personality.md`：长设定圣经。
- `persona/conversation_behavior.md`：每轮聊天固定带上的接话规则。
- `persona/tool_usage.md`：有工具可用时进入 prompt 的工具规则。
- `persona/chat_profiles/`：默认聊天、创造者模式、情绪陪伴、严肃讨论等场景策略。
- `persona/runtime/core.md`：每轮聊天固定带上的核心卡。
- `persona/runtime/default_state.md`：默认运行态种子，只是 fallback，不是真实实时状态。
- `persona/slices/`：按本轮问题检索的行为切片。
- `persona/samples/`：按本轮问题检索的语气样本。
- `src/core/persona-loader.ts`：读取这些文件。
- `src/core/persona-projection.ts`：选择场景策略、关系语气、相关切片和样本。

## 模型层

**是什么**

项目不绑定某一个模型。它通过统一的 `ModelProvider` 调用 OpenAI 兼容接口、Anthropic、MiniMax 等。

**在哪里**

- `src/core/model-provider.ts`：模型调用统一入口。
- `src/core/minimax-provider.ts`：MiniMax 特殊字段和 thinking 处理。
- `src/types/model.ts`：聊天消息和模型能力的类型。

## 语音层

**是什么**

语音层把已生成的文字回复渲染成声音，也把语音消息和自动通话里的浏览器识别文本送回聊天主链路。它不替代聊天主链路：ASR 后仍走 `chat.service.ts`，TTS 只播放已经保存的 assistant message。

Web Chat 可以开启自动朗读；每条 assistant 消息也可以 hover 后手动播放。播放过的音频按 `lastPlayedAt` 缓存，超过配置天数未播放会被清理。

**在哪里**

- `src/voice/minimax-tts.service.ts`：MiniMax T2A WebSocket 合成。
- `src/voice/voice-cache.service.ts`：按消息和音色参数缓存音频文件。
- `src/voice/voice.route.ts`：语音播放、音频读取和前端语音配置 API。
- `src/voice/voice-cleanup-scheduler.ts`：语音缓存过期清理。
- `web/src/hooks/useVoicePlayback.ts`：前端播放队列、自动朗读和单条播放。
- `web/src/hooks/useVoiceCall.ts`：语音消息、自动通话循环、浏览器 ASR 和转写发送。
- `web/src/components/VoiceCallPanel.tsx`：语音电话面板。
- `project-handbook/voice-feature-design.md`：语音功能设计和后续注意事项。

## 记忆系统

**是什么**

记忆不是聊天记录。聊天记录是原始对话；记忆是从对话里提炼出来、以后可复用的长期事实或关系信息。

**在哪里**

- `src/core/memory.service.ts`：创建、读取、列出记忆。
- `src/core/memory-retrieval.service.ts`：语义检索。
- `src/core/memory-budget.ts`：限制本轮最多塞多少记忆。
- `src/embeddings/`：把记忆转成向量。
- `src/vector-index/`：pgvector 检索。

## Reflection

**是什么**

Reflection 是复盘系统。它读历史对话和现有记忆，生成记忆提案或风险提示。它不应该随便直接改正式记忆。

**在哪里**

- `src/reflection/`：复盘、报告、记忆提案、审核应用。
- `src/routes/reflection.route.ts`：管理接口。
- `web/src/components/admin/OpsPage.tsx`：admin 里的 Reflection 手动触发和报告查看。
- `docs/reflection-agent-v0.7.md`：更细设计。

## Dream Cycle

**是什么**

Dream 是闲时整理系统。它把最近发生的事整理成 DailyNote、DreamSignal、DreamDiary，并可能生成记忆提案。

**在哪里**

- `src/dream/`：Dream 的完整流程。
- `src/routes/dream.route.ts`：管理接口。
- `web/src/components/admin/OpsPage.tsx`：admin 里的 Dream 手动触发、作业状态、Morning Brief、Deep Sleep、Daily Note、Signal 和内在日记查看。
- `docs/dream-cycle-v0.75.md`：更细设计。

## 工具系统

**是什么**

工具是模型在回复过程中可以调用的外部能力，比如搜索记忆、读网页、查项目状态。

**在哪里**

- `src/tools/tool-registry.ts`：注册工具。
- `src/tools/tool-executor.ts`：执行工具。
- `src/tools/builtin/`：内置工具。
- `src/tools/policy/`：工具权限和风险控制。

## Skill 系统

**是什么**

Skill 是项目内部的正式能力流程，不等同于一段 prompt，也不等同于 Tool。

现在已有的是 `xiaohongshu_reply`：小红书评论回复工作流。它用 LLM 判断评论是否需要回复、风险等级和回复口吻，然后生成待审核草稿。

关闭 skill 时，小红书工作台不能生成回复草稿。帖子、二维评论线程和草稿都保存在数据库里，最终仍由 owner 手动审核。评论关系与“作者”标记由页面 DOM 决定，不依赖 LLM 猜测。

**在哪里**

- `src/skills/skill-registry.ts`：Skill 列表。
- `src/skills/xiaohongshu-reply/`：小红书回复 skill、prompt 配置和 LLM 草稿生成。
- `web/src/components/admin/SkillsAdminPage.tsx`：admin 的 Skill 列表页和详情页。
- `web/src/components/admin/PlatformsPage.tsx`：小红书帖子、二维评论线程和回复草稿工作台。

## 表达学习

**是什么**

记录 owner 如何采用、修改、重写或放弃思源的回复，再把这次取舍分析成可检索的表达经验。它是跨平台底层，小红书只是第一个接入方。

**在哪里**

- `src/expression-learning/`：通用分析、保存、向量索引和检索。
- `src/platforms/xiaohongshu/`：小红书 URL 导入、评论线程、作者回复和同步入口。
- `web/src/components/admin/ExpressionLearningPage.tsx`：查看、修正、停用和重新分析表达经验。
- `project-handbook/expression-learning.md`：功能边界和当前流程。

## 外部信息读取

**是什么**

这部分负责读网页、搜索网页、同步外部 inbox。它们是工具和管理接口的能力来源。

**在哪里**

- `src/web-search/`：Tavily 搜索。
- `src/page-reader/`：Jina / Playwright 公开页面读取。
- `src/external-inbox/`：外部消息箱。
- `src/mcp/mcp-client.ts`：本地 MCP stdio 客户端。
- `src/mcp/chrome-devtools-mcp.service.ts`：只读连接已登录 Chrome，复用并保留页面。

## 渠道层

**是什么**

渠道层负责接入不同聊天入口，然后统一转成后端聊天输入。

**在哪里**

- `src/channels/telegram/`：Telegram Bot。
- `src/channels/weixin/`：微信桥接。
- `src/routes/chat.route.ts`：网页和 HTTP API 聊天入口。

## 管理后台和前端

**是什么**

`web/` 是网页聊天和管理界面。后端也提供 admin API 给管理页面使用。

**在哪里**

- `web/`：React 前端。
- `src/routes/admin.route.ts`：管理后台 API。
- `web/src/components/admin/RuntimeStatePage.tsx`：陆思源运行态可视化、状态变更和自主任务控制页。
- `web/src/components/admin/RuntimeStateSourceMaterials.tsx`：状态变更的来源追溯，展示它引用过的消息。
- `web/src/components/admin/RelationshipStatePage.tsx`：现实身份关系状态可视化、身份怀疑审核、渠道账号绑定、编辑和变更记录页。
- `web/src/components/admin/ConversationHistoryPage.tsx`：现实身份对话追溯页，只查看渠道账号、会话和消息，不修改关系。
- `web/src/components/admin/SkillsAdminPage.tsx`：Skill 列表和详情页，查看小红书回复 skill、开关、prompt 和测试入口。
- `web/src/components/admin/OpsPage.tsx`：Reflection / Dream 工作台，负责手动触发和查看后台整理产物。
- `web/src/components/admin/StateChangeDetail.tsx`：状态变更详情组件，用来解释一次运行态或关系态为什么变、实际改了哪些字段。
- `web/src/components/admin/AdminDetailPrimitives.tsx`：admin 详情页共用的小展示组件，避免状态变更详情重复写相同 UI。
- `web/src/components/admin/admin-detail-utils.ts`：admin 详情页共用的值格式化和 JSON 工具。
- `web/src/components/admin/ConfigCenterPage.tsx`：数据库实时运行配置、`.env` 连接配置、变更记录和开发期清库入口。
- `web/src/audio/voicePlayer.ts`：Web 端音频播放封装。
- `src/routes/*`：各功能的 HTTP 接口。

## 数据库

**是什么**

数据库保存用户、会话、消息、记忆、工具日志、Reflection、Dream、外部页面等。

开发期清空测试数据走 admin 配置中心。它会清业务表，但保留数据库运行配置、Skill 配置、配置变更记录、`.env`、persona、项目手册和 Prisma migration。

**在哪里**

- `prisma/schema.prisma`：数据库结构。
- `prisma/migrations/`：历史迁移。
- `src/db/prisma.ts`：Prisma 客户端。

## 测试和脚本

**是什么**

测试保护关键逻辑；脚本负责手动运行或检查系统。

**在哪里**

- `tests/`：自动测试。
- `scripts/`：运行 Reflection、Dream、embedding backfill、smoke test 等。
- `package.json`：可用命令。
