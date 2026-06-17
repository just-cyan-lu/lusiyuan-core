import type { FastifyInstance } from "fastify";
import { env } from "../utils/env.js";
import { requireAdminAuth } from "./admin-auth.js";
import { prisma } from "../db/prisma.js";
import { memoryService } from "../core/memory.service.js";
import { Prisma } from "@prisma/client";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  runtimeStateService,
  type RuntimeStatePatch,
} from "../runtime/runtime-state.service.js";
import {
  relationshipPatchFromAdminBody,
  relationshipStateService,
} from "../runtime/relationship-state.service.js";

function configured(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

function routeError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return cleanString(value);
}

function clampLimit(value: unknown, fallback = 80): number {
  const parsed = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 200);
}

type MemoryDateField = "createdAt" | "updatedAt" | "lastAccessedAt";

interface MemoryListQuery {
  user_id?: string;
  status?: string;
  scope?: string;
  type?: string;
  q?: string;
  from?: string;
  to?: string;
  date_field?: string;
  sort?: string;
  limit?: string;
}

type EnvConfigType = "string" | "secret" | "boolean" | "integer" | "number" | "select";

interface EnvConfigDescriptor {
  key: string;
  group: string;
  label: string;
  type: EnvConfigType;
  defaultValue?: string;
  options?: string[];
  min?: number;
  max?: number;
  description?: string;
}

const editableEnvConfig: EnvConfigDescriptor[] = [
  {
    key: "ACTIVE_MODEL_PROVIDER",
    group: "模型 / 当前渠道",
    label: "当前模型渠道",
    type: "select",
    defaultValue: "openai",
    options: ["openai", "anthropic", "glm", "qwen", "deepseek", "minimax", "siliconflow"],
  },
  ...[
    ["OPENAI", "OpenAI"],
    ["ANTHROPIC", "Anthropic"],
    ["GLM", "GLM"],
    ["QWEN", "Qwen"],
    ["DEEPSEEK", "DeepSeek"],
    ["MINIMAX", "MiniMax"],
    ["SILICONFLOW", "SiliconFlow"],
  ].flatMap(([prefix, label]) => [
    {
      key: `${prefix}_BASE_URL`,
      group: `模型 / ${label}`,
      label: `${label} Base URL`,
      type: "string" as const,
    },
    {
      key: `${prefix}_API_KEY`,
      group: `模型 / ${label}`,
      label: `${label} API Key`,
      type: "secret" as const,
      description: "留空保存表示不修改现有密钥。",
    },
    {
      key: `${prefix}_MODEL`,
      group: `模型 / ${label}`,
      label: `${label} Model`,
      type: "string" as const,
    },
  ]),
  {
    key: "MINIMAX_THINKING_TYPE",
    group: "模型 / MiniMax",
    label: "MiniMax Thinking Type",
    type: "select",
    defaultValue: "adaptive",
    options: ["adaptive", "disabled"],
  },
  {
    key: "MINIMAX_REASONING_SPLIT",
    group: "模型 / MiniMax",
    label: "MiniMax Reasoning Split",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "MINIMAX_MAX_COMPLETION_TOKENS",
    group: "模型 / MiniMax",
    label: "MiniMax Max Completion Tokens",
    type: "integer",
    min: 1,
  },
  ...[
    ["TOOL_SEARCH_MEMORIES_MODE", "search_memories"],
    ["TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE", "summarize_recent_conversation"],
    ["TOOL_WEB_SEARCH_MODE", "web_search"],
    ["TOOL_READ_PAGE_MODE", "read_page"],
    ["TOOL_SEND_INTERMEDIATE_MESSAGE_MODE", "send_intermediate_message"],
  ].map(([key, toolName]) => ({
    key,
    group: "工具 / 访问模式",
    label: `${toolName} 访问模式`,
    type: "select" as const,
    defaultValue: toolName === "web_search" || toolName === "read_page"
      ? "owner_only"
      : "on",
    options: ["off", "owner_only", "on"],
    description: "off=关闭工具；owner_only=仅 owner 可用；on=普通可用。",
  })),
  {
    key: "TELEGRAM_ENABLED",
    group: "渠道",
    label: "Telegram 启用",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "TELEGRAM_BOT_TOKEN",
    group: "渠道密钥",
    label: "Telegram Bot Token",
    type: "secret",
    description: "留空保存表示不修改现有 Token。",
  },
  {
    key: "TELEGRAM_MODE",
    group: "渠道",
    label: "Telegram Mode",
    type: "select",
    defaultValue: "polling",
    options: ["polling"],
  },
  {
    key: "TELEGRAM_PROXY",
    group: "渠道",
    label: "Telegram Proxy",
    type: "string",
  },
  {
    key: "TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS",
    group: "渠道",
    label: "Telegram 文件下载超时 ms",
    type: "integer",
    min: 1000,
  },
  {
    key: "TELEGRAM_FILE_DOWNLOAD_RETRIES",
    group: "渠道",
    label: "Telegram 文件下载重试",
    type: "integer",
    min: 0,
  },
  {
    key: "TELEGRAM_MAX_IMAGE_FILE_BYTES",
    group: "渠道",
    label: "Telegram 图片最大字节",
    type: "integer",
    min: 1,
  },
  {
    key: "WEIXIN_ENABLED",
    group: "渠道",
    label: "Weixin 启用",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "WEIXIN_BRIDGE_SECRET",
    group: "渠道密钥",
    label: "Weixin Bridge Secret",
    type: "secret",
    description: "留空保存表示不修改现有 Secret。",
  },
  {
    key: "WEB_ORIGIN",
    group: "Web",
    label: "Web Origin",
    type: "string",
    defaultValue: "http://localhost:64111",
  },
  {
    key: "ADMIN_DATABASE_CLEAR_PASSWORD",
    group: "安全",
    label: "清空数据库确认密码",
    type: "secret",
    description: "设置中心清空测试数据时需要输入。留空保存表示不修改现有密码。",
  },
  {
    key: "MAX_MESSAGE_LENGTH",
    group: "限制",
    label: "单条消息最大长度",
    type: "integer",
    min: 1,
  },
  {
    key: "EMBEDDING_BASE_URL",
    group: "Embedding",
    label: "Embedding Base URL",
    type: "string",
  },
  {
    key: "EMBEDDING_API_KEY",
    group: "Embedding 密钥",
    label: "Embedding API Key",
    type: "secret",
    description: "留空保存表示不修改现有密钥。",
  },
  {
    key: "EMBEDDING_MODEL",
    group: "Embedding",
    label: "Embedding Model",
    type: "string",
  },
  {
    key: "EMBEDDING_DIMENSIONS",
    group: "Embedding",
    label: "Embedding Dimensions",
    type: "integer",
    min: 1,
  },
  {
    key: "RELATIONSHIP_UPDATE_MODE",
    group: "关系状态",
    label: "关系更新模式",
    type: "select",
    defaultValue: "review",
    options: ["review", "immediate"],
    description: "review=先记录多次聊天信号，再复盘更新；immediate=每轮聊天直接小幅更新。",
  },
  ...[
    ["MEMORY_RETRIEVAL_ENABLED", "记忆检索启用", "功能"],
    ["TOOLS_ENABLED", "工具调用启用", "功能"],
    ["TOOLS_AUTO_EXECUTE_LOW_RISK", "低风险工具自动执行", "安全"],
    ["TOOLS_ALLOW_MEDIUM_RISK", "允许中风险工具", "安全"],
    ["TOOLS_ALLOW_HIGH_RISK", "允许高风险工具", "安全"],
    ["TOOL_LOG_INPUT_OUTPUT", "记录工具入参出参", "安全"],
    ["MCP_ENABLED", "MCP 启用", "功能"],
    ["REFLECTION_ENABLED", "Reflection 启用", "功能"],
    ["REFLECTION_OWNER_ONLY", "Reflection 仅 Owner", "安全"],
    ["REFLECTION_INCLUDE_MEMORIES", "Reflection 包含记忆", "功能"],
    ["REFLECTION_AUTO_APPLY", "Reflection 自动写入", "安全"],
    ["REFLECTION_ENABLE_GROWTH_LOG", "Reflection 成长日志", "功能"],
    ["DREAM_ENABLED", "Dream 启用", "功能"],
    ["DREAM_AUTO_RUN", "Dream 自动运行", "功能"],
    ["DREAM_LIGHT_ENABLED", "Dream Light 阶段", "功能"],
    ["DREAM_REM_ENABLED", "Dream REM 阶段", "功能"],
    ["DREAM_DEEP_ENABLED", "Dream Deep 阶段", "功能"],
    ["DREAM_DIARY_ENABLED", "Dream Diary", "功能"],
    ["DREAM_MORNING_BRIEF_ENABLED", "Morning Brief", "功能"],
    ["DREAM_AUTO_APPLY", "Dream 自动写入", "安全"],
    ["DREAM_ALLOW_MEMORY_PROPOSALS", "Dream 允许记忆提案", "功能"],
    ["DREAM_ALLOW_GROWTH_LOG_PROPOSALS", "Dream 允许成长日志提案", "功能"],
    ["DREAM_REDACT_PRIVATE_DATA", "Dream 隐私脱敏", "安全"],
    ["RUNTIME_AUTONOMY_AUTO_RUN", "运行态自启动", "功能"],
    ["TAVILY_ENABLED", "Tavily Web Search", "功能"],
    ["JINA_ENABLED", "Jina Reader", "功能"],
    ["PLAYWRIGHT_ENABLED", "Playwright Reader", "功能"],
    ["PLAYWRIGHT_SCREENSHOT_ENABLED", "Playwright 截图", "功能"],
    ["CDP_BROWSER_ENABLED", "CDP Browser", "功能"],
  ].map(([key, label, group]) => ({
    key,
    group,
    label,
    type: "boolean" as const,
  })),
  ...[
    ["MEMORY_SEMANTIC_TOP_K", "Memory Semantic Top K", "记忆"],
    ["MEMORY_FINAL_TOP_K", "Memory Final Top K", "记忆"],
    ["MEMORY_MAX_TOTAL_CHARS", "Memory 最大字符", "记忆"],
    ["RELATIONSHIP_REVIEW_MIN_SIGNALS", "关系复盘最小信号数", "关系状态"],
    ["TOOL_MAX_CALLS_PER_MESSAGE", "单条消息最大工具调用", "限制"],
    ["TOOL_TIMEOUT_MS", "工具超时 ms", "限制"],
    ["REFLECTION_DEFAULT_MESSAGE_LIMIT", "Reflection 默认消息数", "限制"],
    ["REFLECTION_MAX_MESSAGE_LIMIT", "Reflection 最大消息数", "限制"],
    ["REFLECTION_MIN_MESSAGES", "Reflection 最小消息数", "限制"],
    ["REFLECTION_PROPOSAL_MAX_PER_RUN", "Reflection 单次最大提案", "限制"],
    ["DREAM_DEFAULT_LOOKBACK_HOURS", "Dream 默认回看小时", "限制"],
    ["DREAM_MAX_LOOKBACK_DAYS", "Dream 最大回看天数", "限制"],
    ["DREAM_MIN_SOURCE_EVENTS", "Dream 最小源事件", "限制"],
    ["DREAM_MAX_MESSAGES", "Dream 最大消息", "限制"],
    ["DREAM_MAX_TOOL_CALLS", "Dream 最大工具调用", "限制"],
    ["DREAM_MAX_REFLECTION_REPORTS", "Dream 最大复盘报告", "限制"],
    ["DREAM_MAX_MEMORY_PROPOSALS", "Dream 最大记忆提案", "限制"],
    ["DREAM_MIN_EVIDENCE_COUNT", "Dream 最小证据数", "限制"],
    ["DREAM_MAX_PROPOSALS_PER_RUN", "Dream 单次最大提案", "限制"],
    ["DREAM_DIARY_MAX_CHARS", "Dream Diary 最大字符", "限制"],
    ["DREAM_LOCK_TTL_MINUTES", "Dream 锁 TTL 分钟", "限制"],
    ["TAVILY_MAX_RESULTS", "Tavily 最大结果数", "限制"],
    ["PLAYWRIGHT_MAX_PAGE_TEXT_CHARS", "Playwright 最大文本字符", "限制"],
    ["CDP_BROWSER_PORT", "CDP Browser 端口", "限制"],
  ].map(([key, label, group]) => ({
    key,
    group,
    label,
    type: "integer" as const,
    min: 1,
  })),
  {
    key: "REFLECTION_PROPOSAL_MIN_CONFIDENCE",
    group: "限制",
    label: "Reflection 提案最低置信度",
    type: "number",
    min: 0,
    max: 1,
  },
  {
    key: "DREAM_MIN_SIGNAL_SCORE",
    group: "限制",
    label: "Dream 最低 Signal Score",
    type: "number",
    min: 0,
    max: 1,
  },
  {
    key: "DREAM_MIN_CONFIDENCE",
    group: "限制",
    label: "Dream 最低置信度",
    type: "number",
    min: 0,
    max: 1,
  },
  {
    key: "DREAM_CRON",
    group: "Dream",
    label: "Dream Cron",
    type: "string",
    defaultValue: "30 3 * * *",
  },
  {
    key: "DREAM_TIMEZONE",
    group: "Dream",
    label: "Dream Timezone",
    type: "string",
    defaultValue: "Asia/Taipei",
  },
  {
    key: "DREAM_DIARY_VISIBILITY",
    group: "Dream",
    label: "Dream Diary Visibility",
    type: "select",
    defaultValue: "owner_only",
    options: ["owner_only", "private", "internal"],
  },
  {
    key: "RUNTIME_AUTONOMY_CRON",
    group: "Runtime",
    label: "Autonomy Cron",
    type: "string",
    defaultValue: "*/30 * * * *",
  },
  {
    key: "RUNTIME_AUTONOMY_TIMEZONE",
    group: "Runtime",
    label: "Autonomy Timezone",
    type: "string",
    defaultValue: "Asia/Shanghai",
  },
  {
    key: "TAVILY_API_KEY",
    group: "搜索密钥",
    label: "Tavily API Key",
    type: "secret",
    description: "留空保存表示不修改现有密钥。",
  },
  {
    key: "TAVILY_API_KEYS",
    group: "搜索密钥",
    label: "Tavily API Keys",
    type: "secret",
    description: "多个 key 用英文逗号分隔。代码会优先读取 TAVILY_API_KEYS，再 fallback 到 TAVILY_API_KEY。",
  },
  {
    key: "TAVILY_SEARCH_DEPTH",
    group: "搜索",
    label: "Tavily Search Depth",
    type: "select",
    defaultValue: "basic",
    options: ["basic", "advanced"],
  },
  {
    key: "JINA_API_KEY",
    group: "页面读取密钥",
    label: "Jina API Key",
    type: "secret",
    description: "留空保存表示不修改现有密钥。",
  },
  {
    key: "EXTERNAL_HTTP_PROXY",
    group: "网络",
    label: "External HTTP Proxy",
    type: "string",
  },
];

const editableEnvConfigByKey = new Map(
  editableEnvConfig.map((descriptor) => [descriptor.key, descriptor])
);

function boundedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

function hasOwn(object: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function runtimeStatePatchFromBody(body: Record<string, unknown>): RuntimeStatePatch {
  const patch: RuntimeStatePatch = {};

  if (hasOwn(body, "moodLabel")) patch.moodLabel = cleanNullableString(body.moodLabel) ?? "";
  if (hasOwn(body, "moodScore")) {
    patch.moodScore = boundedNumber(body.moodScore, 0, -100, 100);
  }
  if (hasOwn(body, "energyLevel")) {
    patch.energyLevel = boundedNumber(body.energyLevel, 62, 0, 100);
  }
  if (hasOwn(body, "stressLevel")) {
    patch.stressLevel = boundedNumber(body.stressLevel, 24, 0, 100);
  }
  if (hasOwn(body, "socialBattery")) {
    patch.socialBattery = boundedNumber(body.socialBattery, 58, 0, 100);
  }
  if (hasOwn(body, "currentGoal")) patch.currentGoal = cleanNullableString(body.currentGoal) ?? null;
  if (hasOwn(body, "currentFocus")) patch.currentFocus = cleanNullableString(body.currentFocus) ?? null;
  if (hasOwn(body, "currentActivity")) {
    patch.currentActivity = cleanNullableString(body.currentActivity) ?? null;
  }
  if (hasOwn(body, "recentEventSummary")) {
    patch.recentEventSummary = cleanNullableString(body.recentEventSummary) ?? null;
  }
  if (hasOwn(body, "statusNote")) patch.statusNote = cleanNullableString(body.statusNote) ?? null;
  if (hasOwn(body, "autoUpdateEnabled")) {
    patch.autoUpdateEnabled =
      body.autoUpdateEnabled === true || body.autoUpdateEnabled === "true";
  }
  if (hasOwn(body, "updateMode")) patch.updateMode = cleanString(body.updateMode);
  if (hasOwn(body, "updateStrategy")) {
    patch.updateStrategy = cleanString(body.updateStrategy);
  }
  if (hasOwn(body, "metadata")) patch.metadata = jsonInput(body.metadata);

  return patch;
}

function memoryScope(value: unknown, fallback = "user"): string {
  const scope = cleanString(value) ?? fallback;
  if (scope !== "user" && scope !== "global" && scope !== "project") {
    throw routeError("scope must be user, global, or project", 400);
  }
  return scope;
}

function metadataObject(metadata: Prisma.JsonValue | null): Prisma.JsonObject {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Prisma.JsonObject)
    : {};
}

function parseDate(value: unknown): Date | undefined {
  const raw = cleanString(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw routeError("Invalid date filter", 400);
  }
  return date;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday(): Date {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function daysAgoStart(days: number): Date {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  return date;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function memoryDateField(value: unknown, fallback: MemoryDateField): MemoryDateField {
  const field = cleanString(value) ?? fallback;
  if (field === "createdAt" || field === "updatedAt" || field === "lastAccessedAt") {
    return field;
  }
  throw routeError("date_field must be createdAt, updatedAt, or lastAccessedAt", 400);
}

function applyMemoryDateRange(
  where: Prisma.MemoryWhereInput,
  field: MemoryDateField,
  from?: Date,
  to?: Date
): void {
  if (!from && !to) return;
  const range: Prisma.DateTimeNullableFilter = {};
  if (from) range.gte = from;
  if (to) range.lte = to;

  if (field === "createdAt") where.createdAt = range as Prisma.DateTimeFilter;
  if (field === "updatedAt") where.updatedAt = range as Prisma.DateTimeFilter;
  if (field === "lastAccessedAt") where.lastAccessedAt = range;
}

function memoryOrderBy(value: unknown): Prisma.MemoryOrderByWithRelationInput[] {
  switch (cleanString(value) ?? "updated_desc") {
    case "created_desc":
      return [{ createdAt: "desc" }, { importance: "desc" }];
    case "importance_desc":
      return [{ importance: "desc" }, { updatedAt: "desc" }];
    case "confidence_desc":
      return [{ confidence: "desc" }, { updatedAt: "desc" }];
    case "access_desc":
      return [{ accessCount: "desc" }, { updatedAt: "desc" }];
    case "stale_access":
      return [{ lastAccessedAt: "asc" }, { updatedAt: "asc" }];
    case "review_focus":
      return [{ importance: "desc" }, { confidence: "asc" }, { updatedAt: "desc" }];
    case "updated_desc":
    default:
      return [{ updatedAt: "desc" }, { importance: "desc" }];
  }
}

async function buildMemoryWhere(
  query: MemoryListQuery,
  opts: {
    defaultDateField?: MemoryDateField;
    defaultFrom?: Date;
    defaultTo?: Date;
  } = {}
): Promise<Prisma.MemoryWhereInput> {
  const where: Prisma.MemoryWhereInput = {};
  const status = cleanString(query.status);
  const scope = cleanString(query.scope);
  const type = cleanString(query.type);
  const search = cleanString(query.q);

  if (status && status !== "all") where.status = status;
  if (scope && scope !== "all") where.scope = memoryScope(scope);
  if (type && type !== "all") where.type = type;

  if (query.user_id) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: query.user_id }, { externalId: query.user_id }],
      },
      select: { id: true },
    });
    if (!user) throw routeError("User not found", 404);
    where.userId = user.id;
  }

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { userId: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { source: { contains: search, mode: "insensitive" } },
      { channel: { contains: search, mode: "insensitive" } },
      { conversationId: { contains: search, mode: "insensitive" } },
      {
        user: {
          is: {
            OR: [
              { id: { contains: search, mode: "insensitive" } },
              { externalId: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  applyMemoryDateRange(
    where,
    memoryDateField(query.date_field, opts.defaultDateField ?? "updatedAt"),
    parseDate(query.from) ?? opts.defaultFrom,
    parseDate(query.to) ?? opts.defaultTo
  );

  return where;
}

function envFilePath(): string {
  return path.join(process.cwd(), ".env");
}

const databaseDataTables = [
  "channel_events",
  "chat_messages",
  "chat_conversations",
  "tool_call_logs",
  "memory_embeddings",
  "memories",
  "runtime_state_events",
  "runtime_states",
  "runtime_events",
  "identity_link_proposals",
  "relationship_state_events",
  "relationship_states",
  "identity_links",
  "person_identities",
  "memory_change_proposals",
  "reflection_risk_flags",
  "growth_log_proposals",
  "reflection_reports",
  "reflection_jobs",
  "dream_daily_notes",
  "dream_signals",
  "dream_diary_entries",
  "dream_consolidation_reports",
  "dream_locks",
  "dream_jobs",
  "external_page_snapshots",
  "app_users",
] as const;

async function clearDatabaseData() {
  const tableSql = databaseDataTables.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableSql} RESTART IDENTITY CASCADE`);
  return {
    tableCount: databaseDataTables.length,
    tables: [...databaseDataTables],
    clearedAt: new Date().toISOString(),
  };
}

function parseEnvFile(content: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values.set(match[1], parseEnvValue(match[2]));
  }
  return values;
}

function parseEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, "\"").replace(/\\n/g, "\n");
  }
  const commentIndex = trimmed.search(/\s#/);
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
}

function formatEnvValue(value: string, descriptor: EnvConfigDescriptor): string {
  if (descriptor.type === "boolean" || descriptor.type === "integer" || descriptor.type === "number") {
    return value;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n")}"`;
}

function maskEnvValue(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  if (value.length <= 16) return `${value.slice(0, 4)}...${value.slice(-4)}`;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function splitSecretValues(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function maskSecretValues(value: string): string[] {
  return splitSecretValues(value).map(maskEnvValue);
}

function deleteSecretValueIndexes(value: string, indexes: Set<number>): string {
  return splitSecretValues(value)
    .filter((_item, index) => !indexes.has(index))
    .join(",");
}

function normalizeConfigValue(
  descriptor: EnvConfigDescriptor,
  value: unknown
): string | null {
  if (descriptor.type === "secret" && value === "") {
    return null;
  }

  if (descriptor.type === "boolean") {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value === "true" || value === "false") return value;
    throw routeError(`${descriptor.key} must be boolean`, 400);
  }

  if (descriptor.type === "integer") {
    const parsed = typeof value === "number" ? value : Number(String(value ?? ""));
    if (!Number.isInteger(parsed)) {
      throw routeError(`${descriptor.key} must be an integer`, 400);
    }
    if (descriptor.min !== undefined && parsed < descriptor.min) {
      throw routeError(`${descriptor.key} must be >= ${descriptor.min}`, 400);
    }
    if (descriptor.max !== undefined && parsed > descriptor.max) {
      throw routeError(`${descriptor.key} must be <= ${descriptor.max}`, 400);
    }
    return String(parsed);
  }

  if (descriptor.type === "number") {
    const parsed = typeof value === "number" ? value : Number(String(value ?? ""));
    if (!Number.isFinite(parsed)) {
      throw routeError(`${descriptor.key} must be a number`, 400);
    }
    if (descriptor.min !== undefined && parsed < descriptor.min) {
      throw routeError(`${descriptor.key} must be >= ${descriptor.min}`, 400);
    }
    if (descriptor.max !== undefined && parsed > descriptor.max) {
      throw routeError(`${descriptor.key} must be <= ${descriptor.max}`, 400);
    }
    return String(parsed);
  }

  const normalized = String(value ?? "").trim();
  if (descriptor.type === "select" && descriptor.options && !descriptor.options.includes(normalized)) {
    throw routeError(
      `${descriptor.key} must be one of: ${descriptor.options.join(", ")}`,
      400
    );
  }
  return normalized;
}

function writeEnvContent(
  original: string,
  updates: Map<string, string>,
  deletes = new Set<string>()
): string {
  const lines = original.split(/\r?\n/);
  const seen = new Set<string>();
  const next = lines.flatMap((line) => {
    const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
    if (!match) return [line];
    const key = match[2];
    if (deletes.has(key) && !updates.has(key)) return [];
    const value = updates.get(key);
    if (value === undefined) return [line];
    const descriptor = editableEnvConfigByKey.get(key);
    if (!descriptor) return [line];
    seen.add(key);
    return [`${match[1]}${key}${match[3]}${formatEnvValue(value, descriptor)}`];
  });

  const missing = Array.from(updates.entries()).filter(([key]) => !seen.has(key));
  if (missing.length > 0) {
    if (next.length > 0 && next[next.length - 1] !== "") next.push("");
    next.push("# Admin-managed config");
    for (const [key, value] of missing) {
      const descriptor = editableEnvConfigByKey.get(key);
      if (!descriptor) continue;
      next.push(`${key}=${formatEnvValue(value, descriptor)}`);
    }
  }

  return next.join("\n").replace(/\n*$/, "\n");
}

async function readEditableEnvConfig() {
  let content = "";
  try {
    content = await readFile(envFilePath(), "utf8");
  } catch {
    content = "";
  }
  const fileValues = parseEnvFile(content);
  return {
    envPath: envFilePath(),
    restartRequired: true,
    fields: editableEnvConfig.map((descriptor) => {
      const fileValue = fileValues.get(descriptor.key);
      const processValue = process.env[descriptor.key];
      const value = descriptor.type === "secret"
        ? ""
        : fileValue ?? processValue ?? descriptor.defaultValue ?? "";
      return {
        ...descriptor,
        value,
        configured: configured(fileValue ?? processValue ?? ""),
        fromFile: fileValues.has(descriptor.key),
        maskedValue: descriptor.type === "secret"
          ? maskEnvValue(fileValue ?? processValue ?? "")
          : undefined,
        maskedValues: descriptor.type === "secret"
          ? maskSecretValues(fileValue ?? processValue ?? "")
          : undefined,
        secret: descriptor.type === "secret",
        restartRequired: true,
      };
    }),
  };
}

async function resolveMemoryOwnerId(
  inputUserId: unknown,
  scope: string
): Promise<string | null> {
  if (scope === "global" || scope === "project") return null;

  const userId = cleanString(inputUserId);
  if (!userId) {
    throw routeError("user_id is required for user-scoped memories", 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: userId }, { externalId: userId }],
    },
    select: { id: true },
  });

  if (!user) throw routeError("User not found", 404);
  return user.id;
}

async function resolveUserInternalId(inputUserId: unknown): Promise<string> {
  const userId = cleanString(inputUserId);
  if (!userId) throw routeError("user_id is required", 400);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: userId }, { externalId: userId }],
    },
    select: { id: true },
  });

  if (!user) throw routeError("User not found", 404);
  return user.id;
}

function shouldRegenerateEmbedding(data: Prisma.MemoryUpdateInput): boolean {
  return Boolean(
    data.content !== undefined ||
      data.summary !== undefined ||
      data.type !== undefined ||
      data.scope !== undefined ||
      data.tags !== undefined ||
      data.entities !== undefined
  );
}

export async function adminRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  app.get("/v1/admin/runtime", async (_request, reply) => {
    const providers = [
      {
        name: "openai",
        label: "OpenAI",
        active: env.ACTIVE_MODEL_PROVIDER === "openai",
        baseUrlConfigured: configured(env.OPENAI_BASE_URL),
        apiKeyConfigured: configured(env.OPENAI_API_KEY),
        model: env.OPENAI_MODEL || null,
      },
      {
        name: "anthropic",
        label: "Anthropic",
        active: env.ACTIVE_MODEL_PROVIDER === "anthropic",
        baseUrlConfigured: configured(env.ANTHROPIC_BASE_URL),
        apiKeyConfigured: configured(env.ANTHROPIC_API_KEY),
        model: env.ANTHROPIC_MODEL || null,
      },
      {
        name: "glm",
        label: "GLM",
        active: env.ACTIVE_MODEL_PROVIDER === "glm",
        baseUrlConfigured: configured(env.GLM_BASE_URL),
        apiKeyConfigured: configured(env.GLM_API_KEY),
        model: env.GLM_MODEL || null,
      },
      {
        name: "qwen",
        label: "Qwen",
        active: env.ACTIVE_MODEL_PROVIDER === "qwen",
        baseUrlConfigured: configured(env.QWEN_BASE_URL),
        apiKeyConfigured: configured(env.QWEN_API_KEY),
        model: env.QWEN_MODEL || null,
      },
      {
        name: "deepseek",
        label: "DeepSeek",
        active: env.ACTIVE_MODEL_PROVIDER === "deepseek",
        baseUrlConfigured: configured(env.DEEPSEEK_BASE_URL),
        apiKeyConfigured: configured(env.DEEPSEEK_API_KEY),
        model: env.DEEPSEEK_MODEL || null,
      },
      {
        name: "minimax",
        label: "MiniMax",
        active: env.ACTIVE_MODEL_PROVIDER === "minimax",
        baseUrlConfigured: configured(env.MINIMAX_BASE_URL),
        apiKeyConfigured: configured(env.MINIMAX_API_KEY),
        model: env.MINIMAX_MODEL || null,
      },
      {
        name: "siliconflow",
        label: "SiliconFlow",
        active: env.ACTIVE_MODEL_PROVIDER === "siliconflow",
        baseUrlConfigured: configured(env.SILICONFLOW_BASE_URL),
        apiKeyConfigured: configured(env.SILICONFLOW_API_KEY),
        model: env.SILICONFLOW_MODEL || null,
      },
    ];

    return reply.send({
      activeModelProvider: env.ACTIVE_MODEL_PROVIDER,
      providers,
      channels: {
        telegram: {
          enabled: env.TELEGRAM_ENABLED,
          mode: env.TELEGRAM_ENABLED ? env.TELEGRAM_MODE : null,
          tokenConfigured: configured(env.TELEGRAM_BOT_TOKEN),
          proxyConfigured: configured(env.TELEGRAM_PROXY || env.EXTERNAL_HTTP_PROXY),
        },
        weixin: {
          enabled: env.WEIXIN_ENABLED,
          mode: env.WEIXIN_ENABLED ? "openclaw_bridge" : null,
          secretConfigured: configured(env.WEIXIN_BRIDGE_SECRET),
        },
      },
      features: {
        memoryRetrieval: env.MEMORY_RETRIEVAL_ENABLED,
        tools: env.TOOLS_ENABLED,
        reflection: env.REFLECTION_ENABLED,
        dream: env.DREAM_ENABLED,
        dreamAutoRun: env.DREAM_AUTO_RUN,
        runtimeAutonomy: env.RUNTIME_AUTONOMY_AUTO_RUN,
        webSearch: env.TAVILY_ENABLED,
        pageReader: env.JINA_ENABLED || env.PLAYWRIGHT_ENABLED || env.CDP_BROWSER_ENABLED,
        mcp: env.MCP_ENABLED,
      },
      safety: {
        reflectionAutoApply: env.REFLECTION_AUTO_APPLY,
        dreamAutoApply: env.DREAM_AUTO_APPLY,
        toolsAllowMediumRisk: env.TOOLS_ALLOW_MEDIUM_RISK,
        toolsAllowHighRisk: env.TOOLS_ALLOW_HIGH_RISK,
      },
      limits: {
        maxMessageLength: env.MAX_MESSAGE_LENGTH,
        toolMaxCallsPerMessage: env.TOOL_MAX_CALLS_PER_MESSAGE,
        reflectionDefaultMessageLimit: env.REFLECTION_DEFAULT_MESSAGE_LIMIT,
        reflectionMaxMessageLimit: env.REFLECTION_MAX_MESSAGE_LIMIT,
        dreamDefaultLookbackHours: env.DREAM_DEFAULT_LOOKBACK_HOURS,
        dreamMaxLookbackDays: env.DREAM_MAX_LOOKBACK_DAYS,
      },
    });
  });

  app.get("/v1/admin/runtime/state", async (_request, reply) => {
    const [state, events, runtimeEvents] = await Promise.all([
      runtimeStateService.getOrCreate(),
      runtimeStateService.listEvents(12),
      runtimeStateService.listRuntimeEvents(12),
    ]);
    return reply.send({ state, events, runtimeEvents });
  });

  app.patch("/v1/admin/runtime/state", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const state = await runtimeStateService.applyPatch({
      patch: runtimeStatePatchFromBody(body),
      eventType: "manual_update",
      source: "admin",
      summary: cleanString(body.summary) ?? "Admin 手动更新运行态。",
    });
    const [events, runtimeEvents] = await Promise.all([
      runtimeStateService.listEvents(12),
      runtimeStateService.listRuntimeEvents(12),
    ]);
    return reply.send({ state, events, runtimeEvents });
  });

  app.post("/v1/admin/runtime/state/reset", async (_request, reply) => {
    const state = await runtimeStateService.reset("admin");
    const [events, runtimeEvents] = await Promise.all([
      runtimeStateService.listEvents(12),
      runtimeStateService.listRuntimeEvents(12),
    ]);
    return reply.send({ state, events, runtimeEvents });
  });

  app.get("/v1/admin/runtime/state/events", async (request, reply) => {
    const query = request.query as { limit?: string };
    const events = await runtimeStateService.listEvents(clampLimit(query.limit, 30));
    return reply.send({ events });
  });

  app.get("/v1/admin/runtime/state/events/:eventId/sources", async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const sources = await runtimeStateService.getEventSources(eventId);
    if (!sources) throw routeError("Runtime state event not found", 404);
    return reply.send(sources);
  });

  app.get("/v1/admin/runtime/events", async (request, reply) => {
    const query = request.query as { limit?: string };
    const runtimeEvents = await runtimeStateService.listRuntimeEvents(
      clampLimit(query.limit, 30)
    );
    return reply.send({ runtimeEvents });
  });

  app.post("/v1/admin/runtime/autonomy/tick", async (_request, reply) => {
    const result = await runtimeStateService.runAutonomyTick();
    const [events, runtimeEvents] = await Promise.all([
      runtimeStateService.listEvents(12),
      runtimeStateService.listRuntimeEvents(12),
    ]);
    return reply.send({
      state: result.state,
      event: result.event,
      events,
      runtimeEvents,
    });
  });

  app.get("/v1/admin/relationships", async (request, reply) => {
    const query = request.query as { limit?: string; q?: string };
    const relationships = await relationshipStateService.list(
      clampLimit(query.limit, 80),
      query.q
    );
    return reply.send({ relationships });
  });

  app.get("/v1/admin/relationships/:relationshipId", async (request, reply) => {
    const { relationshipId } = request.params as { relationshipId: string };
    const detail = await relationshipStateService.getDetail(relationshipId, 20);
    return reply.send(detail);
  });

  app.patch("/v1/admin/relationships/:relationshipId", async (request, reply) => {
    const { relationshipId } = request.params as { relationshipId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const current = await prisma.relationshipState.findUniqueOrThrow({
      where: { id: relationshipId },
    });
    await relationshipStateService.applyPatch({
      relationshipId,
      patch: relationshipPatchFromAdminBody(current, body),
      eventType: "manual_update",
      source: "admin",
      summary: cleanString(body.eventSummary) ?? "Admin 手动调整关系状态。",
    });
    const detail = await relationshipStateService.getDetail(relationshipId, 20);
    return reply.send(detail);
  });

  app.post("/v1/admin/relationships/:relationshipId/link-user", async (request, reply) => {
    const { relationshipId } = request.params as { relationshipId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    await relationshipStateService.linkUserToPerson({
      relationshipId,
      userId: await resolveUserInternalId(body.user_id),
      source: "admin_manual",
      verifiedBy: cleanString(body.verified_by) ?? "admin",
    });
    const detail = await relationshipStateService.getDetail(relationshipId, 20);
    return reply.send(detail);
  });

  app.post("/v1/admin/relationships/:relationshipId/reset", async (request, reply) => {
    const { relationshipId } = request.params as { relationshipId: string };
    await relationshipStateService.reset(relationshipId, "admin");
    const detail = await relationshipStateService.getDetail(relationshipId, 20);
    return reply.send(detail);
  });

  app.post("/v1/admin/relationships/:relationshipId/review", async (request, reply) => {
    const { relationshipId } = request.params as { relationshipId: string };
    await relationshipStateService.reviewRelationship({
      relationshipId,
      source: "admin_relationship_review",
      limit: 50,
    });
    const detail = await relationshipStateService.getDetail(relationshipId, 20);
    return reply.send(detail);
  });

  app.get("/v1/admin/identity-link-proposals", async (request, reply) => {
    const query = request.query as { status?: string; limit?: string };
    const proposals = await relationshipStateService.listIdentityLinkProposals(
      cleanString(query.status) ?? "pending",
      clampLimit(query.limit, 50)
    );
    return reply.send({ proposals });
  });

  app.post("/v1/admin/identity-link-proposals/:proposalId/approve", async (request, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = await relationshipStateService.approveIdentityLinkProposal({
      proposalId,
      reviewedBy: cleanString(body.reviewed_by) ?? "admin",
    });
    return reply.send(result);
  });

  app.post("/v1/admin/identity-link-proposals/:proposalId/reject", async (request, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const proposal = await relationshipStateService.rejectIdentityLinkProposal({
      proposalId,
      reviewedBy: cleanString(body.reviewed_by) ?? "admin",
    });
    return reply.send({ proposal });
  });

  app.post("/v1/admin/database/clear", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const expectedPassword = env.ADMIN_DATABASE_CLEAR_PASSWORD.trim();
    if (!expectedPassword) {
      throw routeError("ADMIN_DATABASE_CLEAR_PASSWORD is not configured", 503);
    }

    if (cleanString(body.confirmText) !== "清空数据库") {
      throw routeError("confirmText must be 清空数据库", 400);
    }

    if (cleanString(body.password) !== expectedPassword) {
      throw routeError("Clear database password is incorrect", 403);
    }

    const result = await clearDatabaseData();
    return reply.send({
      ok: true,
      ...result,
      message: "数据库业务数据已清空。.env、persona、project-handbook 和 migration 记录未修改。",
    });
  });

  app.get("/v1/admin/config/env", async (_request, reply) => {
    return reply.send(await readEditableEnvConfig());
  });

  app.patch("/v1/admin/config/env", async (request, reply) => {
    const body = request.body as {
      values?: Record<string, unknown>;
      deleteKeys?: string[];
      deleteSecretValueIndexes?: Record<string, number[]>;
    };
    if (
      (!body.values || typeof body.values !== "object") &&
      (!Array.isArray(body.deleteKeys) || body.deleteKeys.length === 0) &&
      (!body.deleteSecretValueIndexes ||
        Object.keys(body.deleteSecretValueIndexes).length === 0)
    ) {
      throw routeError("values, deleteKeys, or deleteSecretValueIndexes is required", 400);
    }

    const updates = new Map<string, string>();
    for (const [key, value] of Object.entries(body.values ?? {})) {
      const descriptor = editableEnvConfigByKey.get(key);
      if (!descriptor) {
        throw routeError(`Unsupported config key: ${key}`, 400);
      }
      const normalized = normalizeConfigValue(descriptor, value);
      if (normalized !== null) updates.set(key, normalized);
    }

    const deletes = new Set<string>();
    for (const key of body.deleteKeys ?? []) {
      if (!editableEnvConfigByKey.has(key)) {
        throw routeError(`Unsupported config key: ${key}`, 400);
      }
      if (!updates.has(key)) deletes.add(key);
    }

    const secretValueDeletes = new Map<string, Set<number>>();
    for (const [key, indexes] of Object.entries(body.deleteSecretValueIndexes ?? {})) {
      const descriptor = editableEnvConfigByKey.get(key);
      if (!descriptor) {
        throw routeError(`Unsupported config key: ${key}`, 400);
      }
      if (descriptor.type !== "secret") {
        throw routeError(`${key} is not a secret config`, 400);
      }
      if (!Array.isArray(indexes)) {
        throw routeError(`${key} delete indexes must be an array`, 400);
      }
      const normalizedIndexes = indexes.map((index) => {
        const parsed = Number(index);
        if (!Number.isInteger(parsed) || parsed < 0) {
          throw routeError(`${key} delete indexes must be non-negative integers`, 400);
        }
        return parsed;
      });
      if (normalizedIndexes.length > 0 && !updates.has(key) && !deletes.has(key)) {
        secretValueDeletes.set(key, new Set(normalizedIndexes));
      }
    }

    if (updates.size > 0 || deletes.size > 0 || secretValueDeletes.size > 0) {
      let current = "";
      try {
        current = await readFile(envFilePath(), "utf8");
      } catch {
        current = "";
      }

      if (secretValueDeletes.size > 0) {
        const fileValues = parseEnvFile(current);
        for (const [key, indexes] of secretValueDeletes) {
          const nextValue = deleteSecretValueIndexes(fileValues.get(key) ?? "", indexes);
          if (nextValue) {
            updates.set(key, nextValue);
          } else {
            deletes.add(key);
          }
        }
      }

      await writeFile(envFilePath(), writeEnvContent(current, updates, deletes), "utf8");
    }

    return reply.send({
      ...(await readEditableEnvConfig()),
      updatedKeys: Array.from(updates.keys()),
      deletedKeys: Array.from(deletes),
      deletedSecretValueIndexes: Object.fromEntries(
        Array.from(secretValueDeletes.entries()).map(([key, indexes]) => [
          key,
          Array.from(indexes),
        ])
      ),
      message: "Config saved to .env. Restart the backend service to apply changes.",
    });
  });

  app.get("/v1/admin/memories", async (request, reply) => {
    const query = request.query as MemoryListQuery;

    const memories = await prisma.memory.findMany({
      where: await buildMemoryWhere(query),
      include: {
        user: {
          select: {
            id: true,
            externalId: true,
            displayName: true,
          },
        },
      },
      orderBy: memoryOrderBy(query.sort),
      take: clampLimit(query.limit),
    });

    return reply.send({ memories });
  });

  app.get("/v1/admin/memories/activity", async (request, reply) => {
    const query = request.query as MemoryListQuery & {
      metric?: string;
    };
    const field = memoryDateField(query.date_field, "createdAt");
    const rows = await prisma.memory.findMany({
      where: await buildMemoryWhere(query, {
        defaultDateField: field,
        defaultFrom: daysAgoStart(364),
        defaultTo: endOfToday(),
      }),
      select: {
        createdAt: true,
        updatedAt: true,
        lastAccessedAt: true,
        importance: true,
      },
    });

    const days = new Map<string, { count: number; importance: number }>();
    for (const row of rows) {
      const date = row[field];
      if (!date) continue;
      const key = dateKey(date);
      const current = days.get(key) ?? { count: 0, importance: 0 };
      current.count += 1;
      current.importance += row.importance;
      days.set(key, current);
    }

    const activity = Array.from(days.entries())
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return reply.send({
      days: activity,
      totalCount: rows.length,
      peakCount: activity.reduce((peak, day) => Math.max(peak, day.count), 0),
      peakImportance: activity.reduce(
        (peak, day) => Math.max(peak, day.importance),
        0
      ),
      metric: cleanString(query.metric) ?? "count",
      dateField: field,
    });
  });

  app.post("/v1/admin/memories", async (request, reply) => {
    const body = request.body as {
      user_id?: string | null;
      type?: string;
      scope?: string;
      content?: string;
      summary?: string | null;
      importance?: number;
      confidence?: number;
      status?: string;
      source?: string | null;
      tags?: unknown;
      entities?: unknown;
      channel?: string | null;
      conversation_id?: string | null;
      metadata?: unknown;
    };

    const type = cleanString(body.type);
    const content = cleanString(body.content);
    const scope = memoryScope(body.scope);
    if (!type) throw routeError("type is required", 400);
    if (!content) throw routeError("content is required", 400);

    const memory = await prisma.memory.create({
      data: {
        userId: await resolveMemoryOwnerId(body.user_id, scope),
        type,
        scope,
        content,
        summary: cleanNullableString(body.summary) ?? null,
        importance: boundedNumber(body.importance, 5, 1, 10),
        confidence: boundedNumber(body.confidence, 0.8, 0, 1),
        status: cleanString(body.status) ?? "active",
        source: cleanNullableString(body.source) ?? "admin_manual",
        tags: jsonInput(body.tags),
        entities: jsonInput(body.entities),
        channel: cleanNullableString(body.channel) ?? null,
        conversationId: cleanNullableString(body.conversation_id) ?? null,
        metadata: jsonInput(body.metadata),
      },
      include: {
        user: { select: { id: true, externalId: true, displayName: true } },
      },
    });

    if (memory.status === "active" && env.MEMORY_RETRIEVAL_ENABLED) {
      memoryService.generateAndStoreEmbedding(memory).catch((err) =>
        console.warn("Admin memory embedding failed:", err)
      );
    }

    return reply.send({ memory });
  });

  app.patch("/v1/admin/memories/:memoryId", async (request, reply) => {
    const { memoryId } = request.params as { memoryId: string };
    const body = request.body as {
      user_id?: string | null;
      type?: string;
      scope?: string;
      content?: string;
      summary?: string | null;
      importance?: number;
      confidence?: number;
      status?: string;
      source?: string | null;
      tags?: unknown;
      entities?: unknown;
      channel?: string | null;
      conversation_id?: string | null;
      metadata?: unknown;
    };

    const existing = await prisma.memory.findUniqueOrThrow({
      where: { id: memoryId },
    });
    const nextScope = memoryScope(body.scope, existing.scope);
    const data: Prisma.MemoryUpdateInput = {};

    if (body.user_id !== undefined || body.scope !== undefined) {
      data.user = {
        disconnect: true,
      };
      const ownerId = await resolveMemoryOwnerId(body.user_id ?? existing.userId, nextScope);
      if (ownerId) data.user = { connect: { id: ownerId } };
    }
    if (body.type !== undefined) data.type = cleanString(body.type) ?? existing.type;
    if (body.scope !== undefined) data.scope = nextScope;
    if (body.content !== undefined) data.content = cleanString(body.content) ?? existing.content;
    if (body.summary !== undefined) data.summary = cleanNullableString(body.summary);
    if (body.importance !== undefined) {
      data.importance = boundedNumber(body.importance, existing.importance, 1, 10);
    }
    if (body.confidence !== undefined) {
      data.confidence = boundedNumber(body.confidence, existing.confidence, 0, 1);
    }
    if (body.status !== undefined) data.status = cleanString(body.status) ?? existing.status;
    if (body.source !== undefined) data.source = cleanNullableString(body.source);
    if (body.tags !== undefined) data.tags = jsonInput(body.tags);
    if (body.entities !== undefined) data.entities = jsonInput(body.entities);
    if (body.channel !== undefined) data.channel = cleanNullableString(body.channel);
    if (body.conversation_id !== undefined) {
      data.conversationId = cleanNullableString(body.conversation_id);
    }
    if (body.metadata !== undefined) data.metadata = jsonInput(body.metadata);

    const memory = await prisma.memory.update({
      where: { id: memoryId },
      data,
      include: {
        user: { select: { id: true, externalId: true, displayName: true } },
      },
    });

    if (
      memory.status === "active" &&
      env.MEMORY_RETRIEVAL_ENABLED &&
      shouldRegenerateEmbedding(data)
    ) {
      memoryService.generateAndStoreEmbedding(memory).catch((err) =>
        console.warn("Admin memory embedding update failed:", err)
      );
    }

    return reply.send({ memory });
  });

  app.delete("/v1/admin/memories/:memoryId", async (request, reply) => {
    const { memoryId } = request.params as { memoryId: string };
    const existing = await prisma.memory.findUniqueOrThrow({
      where: { id: memoryId },
      select: { metadata: true },
    });
    const memory = await prisma.memory.update({
      where: { id: memoryId },
      data: {
        status: "archived",
        metadata: {
          ...metadataObject(existing.metadata),
          archivedBy: "admin",
          archivedAt: new Date().toISOString(),
        },
      },
      include: {
        user: { select: { id: true, externalId: true, displayName: true } },
      },
    });

    return reply.send({ memory });
  });
}
