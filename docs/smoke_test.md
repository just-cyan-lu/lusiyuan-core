# Smoke Test Checklist

Use this checklist after changes to chat, Telegram, model providers, database
migrations, auth, tools, reflection, dream, or deployment config.

## 1. Start Dependencies

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

The server should listen on `http://localhost:64100` unless `PORT` is changed.

## 2. Automated Smoke Test

Default mode does not call the LLM. It checks HTTP health, public read routes,
database tables, Prisma migrations, pgvector, the HNSW index, and admin-protected
read endpoints when `ADMIN_API_TOKEN` is configured.

```bash
pnpm smoke
```

Useful options:

```bash
SMOKE_BASE_URL="http://localhost:64100" pnpm smoke
SMOKE_REQUIRE_ADMIN_TOKEN=true pnpm smoke
SMOKE_RUN_CHAT=true pnpm smoke
SMOKE_RUN_CHAT=true SMOKE_USER_ID="smoke:manual" pnpm smoke
```

`SMOKE_RUN_CHAT=true` makes a real `/v1/chat` call, verifies the reply is
non-empty, verifies duplicate `external_message_id` handling, and checks the
conversation history route. This spends model tokens.

## 3. Telegram Manual Test

Restart the server or bot after changing `.env`:

```bash
pnpm dev
```

Run these in a private chat with the bot:

| Scenario | Input | Expected |
| --- | --- | --- |
| Text | `你好，用一句话回复我` | Bot replies normally. |
| Reset | `/reset` | Bot says the session restarted. |
| After reset | `刚才我说了什么？` | Bot should not rely on the previous session context. |
| Photo | Send a normal Telegram photo with a caption. | Bot answers about the image or caption. |
| Image file | Send a `.jpg`, `.png`, `.webp`, or `.gif` as file/document. | Bot handles it as an image. |
| Non-image file | Send a PDF or text file. | Bot says ordinary files are not supported yet. |
| Duplicate delivery | Retry/resend the same Telegram message if the client allows it. | No duplicate assistant reply from idempotency. |

For Telegram access behind a proxy:

```env
TELEGRAM_PROXY="http://127.0.0.1:7890"
TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS=30000
TELEGRAM_FILE_DOWNLOAD_RETRIES=2
TELEGRAM_MAX_IMAGE_FILE_BYTES=10485760
```

`EXTERNAL_HTTP_PROXY` can override the proxy used for file downloads.

## 4. MiniMax-M3 Manual Test

Use this `.env` shape:

```env
ACTIVE_MODEL_PROVIDER="minimax"
MINIMAX_BASE_URL="https://api.minimax.io/v1"
MINIMAX_API_KEY="your-api-key"
MINIMAX_MODEL="MiniMax-M3"
MINIMAX_THINKING_TYPE="adaptive"
MINIMAX_MAX_COMPLETION_TOKENS=8192
```

`MiniMax-M3` requests always enable `reasoning_split` in code so reasoning content stays separate from the final reply.

Recommended checks:

| Scenario | Input | Expected |
| --- | --- | --- |
| Text | `用一句话介绍你自己` | Normal reply, no visible `<think>` text. |
| Image | Send a Telegram image. | M3 receives image input and replies about it. |
| Tool planning | Ask a question that should use tools, with `TOOLS_ENABLED=true`. | Tool logs show calls; user sees only natural text. |
| Long answer | Ask for a structured multi-step answer. | Not truncated at normal lengths. |

If tool calls fail with MiniMax, inspect logs for the raw assistant message. The
next-turn assistant history should preserve raw `content`, `tool_calls`, and any
MiniMax reasoning metadata.

## 5. Admin API Manual Test

```bash
curl -i http://localhost:64100/v1/tools

curl -i \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  http://localhost:64100/v1/tools
```

Expected:

- Without token: `401 Unauthorized`
- With token: `200 OK`

Also spot-check:

```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "http://localhost:64100/v1/reflection/reports?limit=1"

curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "http://localhost:64100/v1/dream/daily-notes?limit=1"
```

## 6. Common Failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `fetch failed` downloading Telegram image | File download did not reach Telegram CDN. | Set `TELEGRAM_PROXY` or `EXTERNAL_HTTP_PROXY`; increase timeout. |
| `Unsupported image type: application/octet-stream` | CDN sent a generic content type. | Current code falls back to file extension; restart the bot. |
| Admin endpoints return `503` | `ADMIN_API_TOKEN` is empty. | Set a token and restart. |
| `pnpm smoke` cannot reach `/health` | Server is not running or wrong port. | Start `pnpm dev` or set `SMOKE_BASE_URL`. |
| `SMOKE_RUN_CHAT=true` fails | Model provider/API key issue. | Check `ACTIVE_MODEL_PROVIDER`, provider key, base URL, and model name. |
