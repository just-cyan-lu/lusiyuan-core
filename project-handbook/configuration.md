# 配置系统

项目配置分成两层，不能混在一起。

## `.env`：启动、连接和秘密

`.env` 只保留系统启动前必须知道，或者不应该写进数据库的内容：

- 数据库地址、后端端口、Web Origin。
- Admin Token、清库密码、owner 身份。
- 模型、Embedding、搜索、页面读取、TTS 和渠道的 API Key、Base URL、Model、Token、Secret、Proxy。

MiniMax TTS 使用 `MINIMAX_API_KEY`。这个 key 仍然只放 `.env`，不写入数据库。ASR 第一版使用浏览器 Web Speech API，不需要后端 API Key。

这些内容很少修改，部分改动需要重启。Admin 不允许编辑 `ADMIN_API_TOKEN`、`ADMIN_DATABASE_CLEAR_PASSWORD`、`DATABASE_URL` 或 `OWNER_USER_IDS`。

## 数据库：日常运行配置

功能开关、访问权限、数量限制、Dream/Reflection 规则、定时频率、模型路由、工具策略、网页读取和平台参数保存在 `SystemSetting`。Admin 保存后会立即更新当前进程，不需要重启。

每次修改会写入 `SystemSettingEvent`，记录旧值、新值和修改时间。代码里的配置注册表负责默认值、类型、范围和合法选项；数据库只保存经过校验的值。

特殊组件会在保存后重新配置：

- 切换模型路由：聊天、Dream、表达学习和通用内部能力各自可选择连接档案；下一次对应调用会重建客户端。
- 修改 Dream 或自启动时间：停止旧定时器并重新排程。
- 修改 Chrome MCP 连接：断开旧客户端，下次读取重新连接。
- 开关 Telegram：立即启动或停止长轮询。

语音相关配置也在 `SystemSetting`：

- `VOICE_TTS_*`：MiniMax TTS endpoint、模型、音色、语速、音量、音高和音频格式。
- `VOICE_ASR_*`：浏览器 ASR 启用状态、provider、语言、单段最长时长和自动通话停顿阈值。
- `VOICE_CACHE_RETENTION_DAYS`：语音缓存按最近播放时间保留多久。
- `VOICE_AUTOPLAY_FINAL_ONLY`：自动朗读是否只读最终回复。

这些值不含秘密，Admin 保存后即时生效。语音缓存清理任务读取最新保留天数；TTS 下一次调用读取最新模型和音色设置；Web Chat 通过 `/v1/voice/config` 读取浏览器 ASR 配置和自动通话停顿阈值。

## Web Chat 身份

Web Chat 不再把浏览器随机 id 当成默认用户。默认操作者是 `WEBCHAT_OWNER_USER_ID`（默认 `web:owner`），Codex 代聊或测试使用 `WEBCHAT_CODEX_USER_ID`（默认 `web:codex`）。两者虽然都来自 `web` 渠道，但会分别写入不同的 User、Conversation、关系状态和记忆。

`WEBCHAT_OWNER_USER_ID` 会被视为 owner。多个 owner 渠道账号会自动链接到同一个 `PersonIdentity`，避免陆思源把 Telegram owner 和 Web owner 当成两个不同的人。

## Owner 自述

`owner/profile.md` 是 owner 亲自写给陆思源的稳定自述，只在 owner 对话里进入 prompt。它用来描述“当前这个人是谁、和陆思源是什么关系、陆思源应该如何理解对方”，优先级高于模型从零散聊天中自行推断出的身份印象。

这份 markdown 不放在配置中心，也不放在 `persona/` 里。它描述的是“和陆思源对话的人”，不是陆思源的人设或自我描述。数据库里的 `RelationshipState` 会在它的基础上描述当前关系状态和近期变化，用来做微调，而不是替代 owner 自述。

## Skill 配置

Skill 不在 `SystemSetting` 里复制一份。小红书 Skill 的开关、账号模式、字数和 prompt 都归 `SkillConfig` 管理，保存后立即生效。

## 清空测试数据

“清空数据库业务数据”会保留 `SystemSetting`、`SystemSettingEvent` 和 `SkillConfig`。配置不是聊天测试数据，清理聊天和记忆时不应该一起丢失。

## 代码位置

- `src/config/runtime-settings.registry.ts`：可实时修改的配置清单和校验范围。
- `src/config/runtime-settings.service.ts`：加载、缓存、保存和通知运行组件。
- `src/utils/env.ts`：只读取启动、连接和秘密配置。
- `web/src/components/admin/ConfigCenterPage.tsx`：运行配置、连接配置和变更记录。
