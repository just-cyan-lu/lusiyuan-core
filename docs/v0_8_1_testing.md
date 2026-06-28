# v0.8.1 外部世界感知层 — 测试步骤

## 前提

1. **启动数据库**（如果还没启动）：
   ```bash
   docker compose up -d
   ```

2. **运行 migration**（如果还没跑）：
   ```bash
   npx prisma migrate deploy
   ```

3. **启动服务**：
   ```bash
   pnpm dev
   ```

   服务会在 `http://localhost:64100` 启动。

4. **管理接口鉴权**：
   下方 `/v1/read-page`、`/v1/search`、`/v1/external-inbox` 等外部世界感知接口需要在 `.env` 配置 `ADMIN_API_TOKEN`，调用时带上：
   ```bash
   -H "Authorization: Bearer $ADMIN_API_TOKEN"
   ```

---

## 测试 1：Jina AI Reader（最简单，无需配置）

Jina AI Reader 默认开启，不需要 API key。

```bash
curl -X POST http://localhost:64100/v1/read-page \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "user_id": "telegram:123456"
  }'
```

**期望结果**：
```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "content": "Example Domain\n\nThis domain is for use in...",
  "tool": "jina"
}
```

**验证**：
- 返回了 `content` 字段，内容是干净的 markdown 文本
- `tool` 是 `"jina"`

---

## 测试 2：查看 External Inbox（无需配置）

```bash
curl "http://localhost:64100/v1/external-inbox?user_id=telegram:123456"
```

**期望结果**：
```json
{
  "items": []
}
```

因为还没同步过任何平台，所以是空列表。

---

## 测试 3：Tavily 网页搜索（需要 API key）

### 配置

在 `.env` 里添加：
```env
TAVILY_ENABLED=true
TAVILY_API_KEY="你的Tavily API key"
```

重启服务：`pnpm dev`

### 测试

```bash
curl -X POST http://localhost:64100/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "陆思源 AI 数字人",
    "user_id": "telegram:123456"
  }'
```

**期望结果**：
```json
{
  "query": "陆思源 AI 数字人",
  "answer": "...",
  "results": [
    {
      "title": "...",
      "url": "...",
      "snippet": "...",
      "score": 0.95
    }
  ]
}
```

**验证**：
- 返回了搜索结果列表
- 每个结果有 `title`、`url`、`snippet`

---

## 测试 4：Playwright 无头浏览器（需要安装浏览器）

### 配置

1. 安装 Chromium：
   ```bash
   npx playwright install chromium
   ```

2. 在 `.env` 里添加：
   ```env
   PLAYWRIGHT_ENABLED=true
   ```

3. 重启服务：`pnpm dev`

### 测试

```bash
curl -X POST http://localhost:64100/v1/read-page \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "tool": "playwright",
    "user_id": "telegram:123456"
  }'
```

**期望结果**：
```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "content": "Example Domain\n\nThis domain is for use in...",
  "tool": "playwright"
}
```

**验证**：
- `tool` 是 `"playwright"`
- 内容和 Jina 类似，但 Playwright 能处理 JS 渲染的页面

---

## 测试 5：截图功能（需要 Playwright）

### 配置

在 `.env` 里添加：
```env
PLAYWRIGHT_ENABLED=true
```

重启服务。

### 测试

```bash
curl -X POST http://localhost:64100/v1/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "user_id": "telegram:123456"
  }'
```

**期望结果**：
```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "content": "...",
  "tool": "playwright",
  "screenshotPath": "/var/folders/.../screenshot-1234567890.png"
}
```

**验证**：
- 返回了 `screenshotPath`
- 文件存在于 `/tmp` 或系统临时目录

---

## 测试 6：CDP 连接用户 Chrome（需要手动启动 Chrome）

### 配置

1. 启动 Chrome 并开启调试端口：
   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   
   # Linux
   google-chrome --remote-debugging-port=9222
   
   # Windows
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```

2. 在 `.env` 里添加：
   ```env
   CDP_BROWSER_ENABLED=true
   CDP_BROWSER_PORT=9222
   ```

3. 重启服务：`pnpm dev`

### 测试

在 Chrome 里先登录小红书（或任意需要登录的网站），然后：

```bash
curl -X POST http://localhost:64100/v1/read-page \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.xiaohongshu.com/notification",
    "tool": "cdp",
    "user_id": "telegram:123456"
  }'
```

**期望结果**：
```json
{
  "url": "https://www.xiaohongshu.com/notification",
  "title": "通知 - 小红书",
  "content": "...",
  "tool": "cdp"
}
```

**验证**：
- `tool` 是 `"cdp"`
- 能读取到需要登录才能看到的页面内容

---

## 测试 7：External Inbox 同步（需要 CDP + 小红书登录）

### 配置

确保 CDP 已配置（见测试 6），并且在 `.env` 里：
```env
CDP_BROWSER_ENABLED=true
EXTERNAL_INBOX_ENABLED=true
```

### 测试

```bash
curl -X POST http://localhost:64100/v1/external-inbox/sync \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "xiaohongshu",
    "user_id": "telegram:123456"
  }'
```

**期望结果**：
```json
{
  "platform": "xiaohongshu",
  "fetched": 5,
  "saved": 5,
  "skipped": 0
}
```

**验证**：
- `fetched` > 0 说明读取到了评论/通知
- `saved` > 0 说明保存到数据库了

再查看 inbox 列表：
```bash
curl "http://localhost:64100/v1/external-inbox?user_id=telegram:123456"
```

应该能看到刚才同步的条目。

---

## 快速验证路径

如果只想快速验证整个系统能跑，按这个顺序：

1. **测试 1（Jina）** — 不需要任何配置，能返回内容就说明路由、service、prisma 都通了
2. **测试 2（Inbox 列表）** — 验证数据库表创建成功
3. **测试 3（Tavily）** — 如果有 API key，验证搜索功能

其他测试（Playwright、CDP、截图、小红书同步）是可选的，需要额外配置。

---

## 常见问题

### 1. 403 Forbidden

检查请求是否带了 `Authorization: Bearer $ADMIN_API_TOKEN`，以及 `.env` 是否配置了 `ADMIN_API_TOKEN`。

### 2. Playwright not installed

运行：
```bash
npx playwright install chromium
```

### 3. CDP 连接失败

确保：
- Chrome 用 `--remote-debugging-port=9222` 启动
- `.env` 里 `CDP_BROWSER_ENABLED=true`
- 端口 9222 没被占用

### 4. Tavily 搜索失败

检查：
- `.env` 里 `TAVILY_ENABLED=true`
- `TAVILY_API_KEY` 填了有效的 key
- 免费额度没用完（1000 次/月）
