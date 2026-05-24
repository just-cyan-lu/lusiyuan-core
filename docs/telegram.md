# Telegram 接入文档

## 1. 创建 Telegram Bot

1. 打开 Telegram，搜索 **@BotFather**
2. 发送 `/newbot`
3. 按提示输入 bot 名称（显示名，如 `陆思源`）和 username（如 `lusiyuan_bot`）
4. BotFather 会返回一个 **Bot Token**，格式类似 `123456789:AABBCCDDEEFFaabbccddeeff`

## 2. 配置环境变量

在 `.env` 中填入：

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN="123456789:AABBCCDDEEFFaabbccddeeff"
TELEGRAM_MODE="polling"

# 可选：你的 Telegram 用户 ID，用于 /memories 等管理员命令
OWNER_USER_IDS="telegram:你的TelegramUserId"
```

你的 Telegram User ID 可以通过 @userinfobot 查询。

## 3. 启动 Telegram Worker

先启动 Core API：

```bash
pnpm dev
```

再开一个终端，启动 Telegram bot：

```bash
pnpm telegram:dev
```

## 4. 测试

给你的 bot 发送：

- `/start` — 打招呼
- `/help` — 查看帮助
- `/reset` — 重置会话
- `你是谁？` — 正常聊天

预期：bot 会以陆思源的人格回复。

## 5. 支持的命令

| 命令 | 说明 |
|------|------|
| `/start` | 陆思源自我介绍 |
| `/help` | 查看可用命令 |
| `/reset` | 重置当前会话 |
| `/memories` | 查看记忆（仅 OWNER_USER_IDS 中的用户可用） |

## 6. 群聊说明

在群聊中，bot 只响应 @提及自己的消息（`@bot_username 消息内容`）。
私聊中，bot 响应所有文字消息。

## 7. 常见问题

**Q: bot 没有回复**
- 检查 `TELEGRAM_BOT_TOKEN` 是否正确
- 检查 Core API 是否正在运行（`pnpm dev`）
- 检查 `pnpm telegram:dev` 是否有报错

**Q: 想部署到服务器**
- v0.2 使用 long polling，可以直接在服务器运行 `pnpm telegram:dev`
- 后续可以改成 webhook 模式（在 `.env` 中设置 `TELEGRAM_MODE=webhook`，需要公网 HTTPS 域名）
