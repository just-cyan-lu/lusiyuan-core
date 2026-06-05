import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface HttpResult {
  status: number;
  body: JsonValue | undefined;
  text: string;
}

interface SmokeConfig {
  baseUrl: string;
  adminToken: string;
  requireAdminToken: boolean;
  runChat: boolean;
  timeoutMs: number;
}

const expectedTables = [
  "_prisma_migrations",
  "app_users",
  "channel_events",
  "chat_conversations",
  "chat_messages",
  "drafts",
  "dream_consolidation_reports",
  "dream_daily_notes",
  "dream_diary_entries",
  "dream_jobs",
  "dream_locks",
  "dream_signals",
  "external_inbox_items",
  "external_page_snapshots",
  "growth_log_proposals",
  "memories",
  "memory_change_proposals",
  "memory_embeddings",
  "reflection_jobs",
  "reflection_reports",
  "reflection_risk_flags",
  "tool_call_logs",
];

function boolEnv(key: string, defaultValue = false): boolean {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(val.toLowerCase());
}

function getConfig(): SmokeConfig {
  const port = process.env.PORT ?? "64100";
  return {
    baseUrl: (process.env.SMOKE_BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, ""),
    adminToken: (process.env.SMOKE_ADMIN_TOKEN ?? process.env.ADMIN_API_TOKEN ?? "").trim(),
    requireAdminToken: boolEnv("SMOKE_REQUIRE_ADMIN_TOKEN", false),
    runChat: boolEnv("SMOKE_RUN_CHAT", false),
    timeoutMs: parseInt(process.env.SMOKE_TIMEOUT_MS ?? "15000", 10),
  };
}

function asRecord(value: JsonValue | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected JSON object response");
  }
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectStatus(result: HttpResult, expected: number, context: string): void {
  if (result.status !== expected) {
    const detail = result.text.slice(0, 300);
    throw new Error(`${context}: expected HTTP ${expected}, got ${result.status}. ${detail}`);
  }
}

async function request(
  config: SmokeConfig,
  path: string,
  init: RequestInit = {}
): Promise<HttpResult> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const text = await res.text();
  let body: JsonValue | undefined;
  if (text) {
    try {
      body = JSON.parse(text) as JsonValue;
    } catch {
      body = undefined;
    }
  }
  return { status: res.status, body, text };
}

async function runStep(name: string, fn: () => Promise<void>): Promise<boolean> {
  const started = Date.now();
  try {
    await fn();
    console.log(`[ok] ${name} (${Date.now() - started}ms)`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fail] ${name}: ${message}`);
    return false;
  }
}

function skip(name: string, reason: string): void {
  console.log(`[skip] ${name}: ${reason}`);
}

function bearer(config: SmokeConfig): HeadersInit {
  return { authorization: `Bearer ${config.adminToken}` };
}

async function checkHttpBasics(config: SmokeConfig): Promise<void> {
  const health = await request(config, "/health");
  expectStatus(health, 200, "health");
  assert(asRecord(health.body).status === "ok", "health status should be ok");

  const channels = await request(config, "/v1/channels/status");
  expectStatus(channels, 200, "channels status");
  const channelsBody = asRecord(channels.body);
  assert(typeof channelsBody.telegram === "object", "channels status should include telegram");
  assert(typeof channelsBody.weixin === "object", "channels status should include weixin");

  const missingHistory = await request(config, "/v1/conversations/smoke-missing/messages");
  expectStatus(missingHistory, 200, "missing conversation history");
  assert(Array.isArray(asRecord(missingHistory.body).messages), "history should include messages array");
}

async function checkAdminEndpoints(config: SmokeConfig): Promise<void> {
  if (!config.adminToken) {
    if (config.requireAdminToken) {
      throw new Error("ADMIN_API_TOKEN is missing");
    }
    skip("admin protected endpoints", "ADMIN_API_TOKEN is not configured");
    return;
  }

  const unauthenticated = await request(config, "/v1/tools");
  expectStatus(unauthenticated, 401, "unauthenticated admin request");

  const endpoints: Array<[string, (body: JsonValue | undefined) => void]> = [
    ["/v1/tools", (body) => assert(Array.isArray(asRecord(body).tools), "tools should be an array")],
    ["/v1/tool-logs?limit=1", (body) => assert(Array.isArray(asRecord(body).logs), "logs should be an array")],
    ["/v1/drafts?limit=1", (body) => assert(Array.isArray(asRecord(body).drafts), "drafts should be an array")],
    ["/v1/reflection/reports?limit=1", (body) => assert(Array.isArray(asRecord(body).reports), "reports should be an array")],
    ["/v1/reflection/proposals?limit=1", (body) => assert(Array.isArray(asRecord(body).proposals), "proposals should be an array")],
    ["/v1/reflection/risks?limit=1", (body) => assert(Array.isArray(asRecord(body).risks), "risks should be an array")],
    ["/v1/dream/daily-notes?limit=1", (body) => assert(Array.isArray(body), "daily notes should be an array")],
    ["/v1/dream/signals?limit=1", (body) => assert(Array.isArray(body), "signals should be an array")],
    ["/v1/dream/diary?limit=1", (body) => assert(Array.isArray(body), "diary entries should be an array")],
    ["/v1/external-inbox?limit=1", (body) => assert(Array.isArray(asRecord(body).items), "items should be an array")],
  ];

  for (const [path, validate] of endpoints) {
    const result = await request(config, path, { headers: bearer(config) });
    expectStatus(result, 200, path);
    validate(result.body);
  }
}

async function checkDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;
  const tableNames = new Set(tables.map((t) => t.table_name));
  const missingTables = expectedTables.filter((table) => !tableNames.has(table));
  assert(missingTables.length === 0, `Missing tables: ${missingTables.join(", ")}`);

  const migrations = await prisma.$queryRaw<Array<{
    migration_name: string;
    finished_at: Date | null;
    rolled_back_at: Date | null;
  }>>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at
  `;
  assert(migrations.length > 0, "No Prisma migrations recorded");
  const unfinished = migrations.filter((m) => !m.finished_at && !m.rolled_back_at);
  assert(
    unfinished.length === 0,
    `Unfinished migrations: ${unfinished.map((m) => m.migration_name).join(", ")}`
  );

  const vector = await prisma.$queryRaw<Array<{ extname: string }>>`
    SELECT extname FROM pg_extension WHERE extname = 'vector'
  `;
  assert(vector.length === 1, "pgvector extension is missing");

  const hnsw = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'memory_embeddings'
      AND indexname = 'memory_embeddings_hnsw_idx'
  `;
  assert(hnsw.length === 1, "memory_embeddings_hnsw_idx is missing");
}

async function checkChat(config: SmokeConfig): Promise<void> {
  if (!config.runChat) {
    skip("real chat", "set SMOKE_RUN_CHAT=true to call the configured LLM");
    return;
  }

  const suffix = Date.now();
  const userId = process.env.SMOKE_USER_ID ?? `smoke:${suffix}`;
  const conversationId = process.env.SMOKE_CONVERSATION_ID ?? `smoke:${suffix}`;
  const payload = {
    user_id: userId,
    channel: "smoke",
    conversation_id: conversationId,
    message: "请用一句话回复：smoke test ok",
    external_message_id: `smoke-message:${suffix}`,
    display_name: "Smoke Test",
  };

  const chatResult = await request(config, "/v1/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  expectStatus(chatResult, 200, "chat");
  const chatBody = asRecord(chatResult.body);
  assert(typeof chatBody.reply === "string" && chatBody.reply.length > 0, "chat reply should be non-empty");
  assert(chatBody.conversation_id === conversationId, "chat conversation_id mismatch");

  const duplicate = await request(config, "/v1/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  expectStatus(duplicate, 200, "duplicate chat");
  assert(asRecord(duplicate.body).duplicated === true, "duplicate chat should be idempotent");

  const history = await request(config, `/v1/conversations/${encodeURIComponent(conversationId)}/messages`);
  expectStatus(history, 200, "chat history");
  const messages = asRecord(history.body).messages;
  assert(Array.isArray(messages) && messages.length >= 2, "chat history should contain user and assistant messages");

  if (config.adminToken) {
    const memories = await request(config, `/v1/users/${encodeURIComponent(userId)}/memories`, {
      headers: bearer(config),
    });
    expectStatus(memories, 200, "user memories");
    assert(Array.isArray(asRecord(memories.body).memories), "memories should be an array");
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  console.log(`[info] Smoke base URL: ${config.baseUrl}`);
  console.log(`[info] Real chat: ${config.runChat ? "enabled" : "disabled"}`);

  const results = [
    await runStep("HTTP basics", () => checkHttpBasics(config)),
    await runStep("database schema", checkDatabase),
    await runStep("admin protected endpoints", () => checkAdminEndpoints(config)),
    await runStep("real chat", () => checkChat(config)),
  ];

  await prisma.$disconnect();

  if (results.some((ok) => !ok)) {
    console.error("[fail] Smoke test failed");
    process.exit(1);
  }

  console.log("[ok] Smoke test passed");
}

main().catch(async (err) => {
  await prisma.$disconnect();
  console.error("[fail] Smoke test crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
