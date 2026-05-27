# Telegram Bot 集成说明

## v0.8.1+ 新架构

从 v0.8.1 开始，Telegram bot 已集成到主服务进程中，不再需要单独启动。

### 启动方式

**推荐方式（单进程）：**

```bash
# 在 .env 中设置
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token

# 启动主服务（会自动启动 Telegram bot）
pnpm dev
```

**旧方式（已废弃）：**

```bash
# ❌ 不再推荐
pnpm telegram:dev
```

### 优势

1. **简化部署**：只需要一个进程，减少资源占用
2. **统一初始化**：工具注册、数据库连接等只需初始化一次
3. **更好的日志**：所有日志集中在一个进程中，便于调试
4. **配置统一**：通过环境变量控制是否启动 Telegram bot

### 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `TELEGRAM_ENABLED` | 是否启动 Telegram bot | `false` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | 必填（如果启用） |
| `TELEGRAM_MODE` | 运行模式（polling/webhook） | `polling` |
| `TELEGRAM_PROXY` | 代理地址（如需要） | 空 |

### 迁移指南

如果你之前使用 `pnpm telegram:dev` 启动 Telegram bot：

1. 停止 `pnpm telegram:dev` 进程
2. 在 `.env` 中设置 `TELEGRAM_ENABLED=true`
3. 重启 `pnpm dev`

### 技术细节

- Telegram bot 在 `src/app.ts` 的 `buildApp()` 函数中启动
- 使用 grammy 的 long polling 模式
- 与 HTTP 服务共享同一个进程和数据库连接
- 工具注册通过 `src/init.ts` 统一初始化

### 故障排查

**问题：Telegram bot 没有响应**

检查：
1. `TELEGRAM_ENABLED` 是否设置为 `true`
2. `TELEGRAM_BOT_TOKEN` 是否正确
3. 查看启动日志是否有 "Starting Telegram bot..." 和 "Telegram bot @xxx started"
4. 如果使用代理，检查 `TELEGRAM_PROXY` 配置

**问题：工具调用失败**

检查：
1. 你的 Telegram 用户 ID 是否在 `OWNER_USER_IDS` 中
2. 相关工具的环境变量是否配置（如 `TAVILY_API_KEYS`、`CDP_BROWSER_ENABLED` 等）
3. 查看日志中的 `[tool-executor]` 和 `[chat]` 输出
