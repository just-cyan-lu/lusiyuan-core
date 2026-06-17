# Project Map

这是项目当前的模块地图。它讲“这个东西是什么”和“去哪里看代码”。

## 后端入口

**是什么**

`lusiyuan-core` 是陆思源的后端。网页、Telegram、微信桥接等入口，最后都会把消息交给这里。

**在哪里**

- `src/server.ts`：启动服务。
- `src/app.ts`：注册路由、静态前端、Telegram、Dream 定时任务。
- `src/utils/env.ts`：读取 `.env` 配置。

## 聊天主链路

**是什么**

一条用户消息进入后端后，会创建用户和会话、保存消息、读取记忆、编译 prompt、调用模型、保存回复。

**在哪里**

- `src/core/chat.service.ts`：聊天主流程。
- `src/core/prompt-builder.ts`：把 persona、记忆、状态和对话历史编译成给模型看的消息。
- `src/core/persona-projection.ts`：选择当前聊天投影，避免把完整人设整包塞给模型。
- `src/runtime/runtime-state.service.ts`：读取运行态，记录 RuntimeEvent，并只允许 owner、复盘、梦境、自启动和 admin 更新长期状态。
- `src/runtime/relationship-state.service.ts`：读取每个现实身份的关系状态，聊天后先记录关系信号，再由复盘更新关系；也会生成待审核的身份怀疑，admin 可以修正、复盘、审核或绑定渠道账号。
- `src/runtime/runtime-autonomy-scheduler.ts`：可选的运行态自启动定时器，默认关闭。
- `src/routes/chat.route.ts`：HTTP 聊天接口。

## Persona 和聊天投影

**是什么**

`persona/` 是陆思源的人设资料。现在分成两类：

- 完整人设：回答“陆思源是谁”。
- 聊天投影：回答“这次该以什么状态说话”。
- 人设切片：回答“这次问题需要哪几段具体人设”。

日常聊天不会把完整 `personality.md` 全部塞给模型。它会固定带上常驻核心，再由代码按场景和关键词挑选少量相关切片。

**在哪里**

- `persona/identity.md`：核心身份。
- `persona/personality.md`：深层性格。
- `persona/speaking_style.md`：语言风格。
- `persona/boundaries.md`：边界和底线。
- `persona/chat_profiles/`：默认聊天、创造者模式、情绪陪伴、严肃讨论等场景规则。
- `persona/runtime/core.md`：每轮聊天固定带上的常驻核心。
- `persona/runtime/default_state.md`：默认运行态种子，只是 fallback，不是真实实时状态。
- `persona/slices/`：按本轮问题检索的人设切片。
- `src/core/persona-loader.ts`：读取这些文件。
- `src/core/persona-projection.ts`：选择聊天投影和相关切片。

## 模型层

**是什么**

项目不绑定某一个模型。它通过统一的 `ModelProvider` 调用 OpenAI 兼容接口、Anthropic、MiniMax 等。

**在哪里**

- `src/core/model-provider.ts`：模型调用统一入口。
- `src/core/minimax-provider.ts`：MiniMax 特殊字段和 thinking 处理。
- `src/types/model.ts`：聊天消息和模型能力的类型。

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
- `docs/reflection-agent-v0.7.md`：更细设计。

## Dream Cycle

**是什么**

Dream 是闲时整理系统。它把最近发生的事整理成 DailyNote、DreamSignal、DreamDiary，并可能生成记忆提案。

**在哪里**

- `src/dream/`：Dream 的完整流程。
- `src/routes/dream.route.ts`：管理接口。
- `docs/dream-cycle-v0.75.md`：更细设计。

## 工具系统

**是什么**

工具是模型在回复过程中可以调用的外部能力，比如搜索记忆、读网页、生成草稿、查项目状态。

**在哪里**

- `src/tools/tool-registry.ts`：注册工具。
- `src/tools/tool-executor.ts`：执行工具。
- `src/tools/builtin/`：内置工具。
- `src/tools/policy/`：工具权限和风险控制。

## 草稿

**是什么**

草稿是“生成但不自动发送”的内容，比如回复草稿、文案草稿、脚本草稿。它需要人审核。

**在哪里**

- `src/drafts/`
- `src/routes/drafts.route.ts`
- `prisma/schema.prisma` 里的 `Draft`

## 外部信息读取

**是什么**

这部分负责读网页、搜索网页、同步外部 inbox。它们是工具和管理接口的能力来源。

**在哪里**

- `src/web-search/`：Tavily 搜索。
- `src/page-reader/`：Jina / Playwright / CDP 页面读取。
- `src/external-inbox/`：外部消息箱。
- `src/cdp-browser/`：连接本机 Chrome。

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
- `web/src/components/admin/RuntimeStatePage.tsx`：陆思源运行态可视化、事件日志、状态变更和自启动控制页。
- `web/src/components/admin/RelationshipStatePage.tsx`：现实身份关系状态可视化、身份怀疑审核、渠道账号绑定、编辑和变更记录页。
- `web/src/components/admin/ConfigCenterPage.tsx`：`.env` 配置中心和开发期清空数据库业务数据入口。
- `src/routes/*`：各功能的 HTTP 接口。

## 数据库

**是什么**

数据库保存用户、会话、消息、记忆、工具日志、草稿、Reflection、Dream、外部页面等。

开发期清空测试数据走 admin 配置中心。它会清业务表，但保留 `.env`、persona、项目手册和 Prisma migration 记录。

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
