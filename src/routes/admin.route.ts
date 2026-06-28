import type { FastifyInstance } from "fastify";
import { env } from "../utils/env.js";
import { runtimeConfig, runtimeSettingsService } from "../config/runtime-settings.service.js";
import { requireAdminAuth } from "./admin-auth.js";
import { prisma } from "../db/prisma.js";
import { memoryService } from "../core/memory.service.js";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
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
import { listSkills } from "../skills/skill-registry.js";
import { isOwnerExternalId } from "../core/owner-identity.js";
import {
  loadXiaohongshuReplyConfig,
  resetXiaohongshuReplyConfig,
  saveXiaohongshuReplyConfig,
} from "../skills/xiaohongshu-reply/xiaohongshu-reply.config.js";
import {
  generateXiaohongshuReplyDraft,
  generateXiaohongshuReplyDraftForComment,
  isXiaohongshuReplySkillEnabled,
} from "../skills/xiaohongshu-reply/xiaohongshu-reply.skill.js";
import {
  normalizeXiaohongshuPostType,
  listXiaohongshuAccountMirror,
  recordXiaohongshuFinalDecision,
  syncXiaohongshuAccountMirror,
  xiaohongshuPostTypeLabels,
} from "../platforms/xiaohongshu/xiaohongshu-account.service.js";
import { importXiaohongshuUrl } from "../platforms/xiaohongshu/xiaohongshu-url-import.service.js";
import { chromeDevtoolsMcpService } from "../mcp/chrome-devtools-mcp.service.js";
import {
  generateExpressionLearningDraft,
  generateExpressionLearningPracticeQuestion,
  learnExpression,
  reanalyzeExpressionLearningExample,
  reindexExpressionLearningExample,
} from "../expression-learning/expression-learning.service.js";
import {
  completeExpressionLearningTrainingRecord,
  createExpressionLearningTrainingRecord,
  exportExpressionLearningTrainingRecords,
  listExpressionLearningTrainingRecords,
  updateExpressionLearningTrainingRecord,
} from "../expression-learning/expression-learning-training-records.js";
import type {
  ExpressionLearningOwnerAction,
  ExpressionLearningOutcome,
  ExpressionLearningStatus,
} from "../expression-learning/expression-learning.types.js";

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

function cleanRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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
  ...[
    ["OPENAI", "OpenAI"],
    ["ANTHROPIC", "Anthropic"],
    ["GLM", "GLM"],
    ["QWEN", "Qwen"],
    ["DEEPSEEK", "DeepSeek"],
    ["MINIMAX", "MiniMax"],
    ["KIMI", "Kimi"],
    ["SILICONFLOW", "SiliconFlow"],
  ].flatMap(([prefix, label]) => [
    { key: `${prefix}_BASE_URL`, group: `模型连接 / ${label}`, label: `${label} Base URL`, type: "string" as const },
    { key: `${prefix}_API_KEY`, group: `模型连接 / ${label}`, label: `${label} API Key`, type: "secret" as const, description: "秘密保存在 .env；留空表示不修改。" },
    { key: `${prefix}_MODEL`, group: `模型连接 / ${label}`, label: `${label} Model`, type: "string" as const },
  ]),
  { key: "TELEGRAM_BOT_TOKEN", group: "渠道连接", label: "Telegram Bot Token", type: "secret", description: "秘密保存在 .env；留空表示不修改。" },
  { key: "TELEGRAM_MODE", group: "渠道连接", label: "Telegram Mode", type: "select", defaultValue: "polling", options: ["polling"], description: "目前代码只支持 polling；webhook 还没有真实接线。" },
  { key: "TELEGRAM_PROXY", group: "渠道连接", label: "Telegram Proxy", type: "string", description: "Telegram API 访问代理；文件下载会优先使用 EXTERNAL_HTTP_PROXY，未配置时回退到这里。" },
  { key: "WEIXIN_BRIDGE_SECRET", group: "渠道连接", label: "Weixin Bridge Secret", type: "secret", description: "秘密保存在 .env；留空表示不修改。" },
  { key: "WEB_ORIGIN", group: "服务启动", label: "Web Origin", type: "string", defaultValue: "http://localhost:64111" },
  { key: "EMBEDDING_BASE_URL", group: "Embedding 连接", label: "Embedding Base URL", type: "string" },
  { key: "EMBEDDING_API_KEY", group: "Embedding 连接", label: "Embedding API Key", type: "secret", description: "秘密保存在 .env；留空表示不修改。" },
  { key: "EMBEDDING_MODEL", group: "Embedding 连接", label: "Embedding Model", type: "string" },
  { key: "EMBEDDING_DIMENSIONS", group: "Embedding 连接", label: "Embedding Dimensions", type: "integer", min: 1 },
  { key: "TAVILY_API_KEY", group: "网页连接", label: "Tavily API Key", type: "secret", description: "秘密保存在 .env；留空表示不修改。" },
  { key: "TAVILY_API_KEYS", group: "网页连接", label: "Tavily API Keys", type: "secret", description: "多个 key 用英文逗号分隔。" },
  { key: "JINA_API_KEY", group: "网页连接", label: "Jina API Key", type: "secret", description: "秘密保存在 .env；留空表示不修改。" },
  { key: "EXTERNAL_HTTP_PROXY", group: "网络连接", label: "External HTTP Proxy", type: "string" },
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
  if (hasOwn(body, "currentGoal")) patch.currentGoal = cleanNullableString(body.currentGoal) ?? null;
  if (hasOwn(body, "currentFocus")) patch.currentFocus = cleanNullableString(body.currentFocus) ?? null;
  if (hasOwn(body, "currentActivity")) {
    patch.currentActivity = cleanNullableString(body.currentActivity) ?? null;
  }
  if (hasOwn(body, "recentEventSummary")) {
    patch.recentEventSummary = cleanNullableString(body.recentEventSummary) ?? null;
  }
  if (hasOwn(body, "statusNote")) patch.statusNote = cleanNullableString(body.statusNote) ?? null;
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

function expressionLearningOutcome(value: unknown): ExpressionLearningOutcome {
  const outcome = cleanString(value) ?? "sent";
  if (outcome === "sent" || outcome === "skipped") return outcome;
  throw routeError("outcome must be sent or skipped", 400);
}

function expressionLearningOwnerAction(
  value: unknown,
  fallback: ExpressionLearningOwnerAction
): ExpressionLearningOwnerAction {
  const action = cleanString(value) ?? fallback;
  const allowed = new Set<ExpressionLearningOwnerAction>([
    "owner_written",
    "edited_draft",
    "accepted_draft",
    "skipped",
    "owner_taught",
  ]);
  if (allowed.has(action as ExpressionLearningOwnerAction)) {
    return action as ExpressionLearningOwnerAction;
  }
  throw routeError("invalid expression-learning ownerAction", 400);
}

function expressionLearningStatus(
  value: unknown,
  fallback: ExpressionLearningStatus
): ExpressionLearningStatus {
  const status = cleanString(value) ?? fallback;
  if (status === "pending" || status === "active" || status === "disabled") return status;
  throw routeError("status must be pending, active, or disabled", 400);
}

function expressionLearningScope(value: unknown, fallback = "scene") {
  const scope = cleanString(value) ?? fallback;
  if (scope === "global" || scope === "platform" || scope === "scene" || scope === "private") {
    return scope;
  }
  throw routeError("invalid expression-learning scope", 400);
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
  "memory_risk_flags",
  "growth_log_proposals",
  "dream_daily_notes",
  "dream_signals",
  "dream_diary_entries",
  "dream_consolidation_reports",
  "dream_locks",
  "dream_jobs",
  "expression_learning_embeddings",
  "expression_learning_examples",
  "xiaohongshu_reply_drafts",
  "xiaohongshu_comments",
  "xiaohongshu_posts",
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

function messagePreview(content: string, max = 96): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function latestConversationMessage(conversation: {
  messages: Array<{ role: string; content: string; createdAt: Date }>;
}) {
  return conversation.messages[0] ?? null;
}

const webChatConversationIdPattern =
  /^web:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSelectableWebChatConversationId(value: string): boolean {
  return webChatConversationIdPattern.test(value);
}

async function listWebChatConversations(limit: number) {
  const queryLimit = Math.max(clampLimit(limit, 80) * 4, 220);
  const conversations = await prisma.conversation.findMany({
    where: {
      channel: "web",
      externalConversationId: { startsWith: "web:" },
    },
    orderBy: { createdAt: "desc" },
    take: queryLimit,
    select: {
      id: true,
      userId: true,
      channel: true,
      externalConversationId: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          externalId: true,
          displayName: true,
        },
      },
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  const summaries = conversations
    .filter((conversation) =>
      isSelectableWebChatConversationId(conversation.externalConversationId)
    )
    .map((conversation) => {
      const latest = latestConversationMessage(conversation);
      return {
        id: conversation.id,
        userId: conversation.userId,
        channel: conversation.channel,
        externalConversationId: conversation.externalConversationId,
        metadata: conversation.metadata,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        user: conversation.user,
        messageCount: conversation._count.messages,
        lastMessageAt: latest?.createdAt ?? null,
        lastMessageRole: latest?.role ?? null,
        lastMessagePreview: latest ? messagePreview(latest.content) : null,
      };
    });

  summaries.sort((a, b) => {
    const aTime = a.lastMessageAt?.getTime() ?? a.createdAt.getTime();
    const bTime = b.lastMessageAt?.getTime() ?? b.createdAt.getTime();
    return bTime - aTime;
  });

  return summaries.slice(0, clampLimit(limit, 80));
}

async function listConversationPeople(input: { query?: string; limit?: number }) {
  const q = cleanString(input.query);
  const people = await prisma.personIdentity.findMany({
    where: q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { label: { contains: q, mode: "insensitive" } },
            { note: { contains: q, mode: "insensitive" } },
            {
              relationshipState: {
                is: {
                  OR: [
                    { relationshipLabel: { contains: q, mode: "insensitive" } },
                    { summary: { contains: q, mode: "insensitive" } },
                    { recentSignal: { contains: q, mode: "insensitive" } },
                    { statusNote: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              identityLinks: {
                some: {
                  user: {
                    OR: [
                      { id: { contains: q, mode: "insensitive" } },
                      { externalId: { contains: q, mode: "insensitive" } },
                      { displayName: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {},
    include: {
      relationshipState: true,
      identityLinks: {
        include: {
          user: {
            select: {
              id: true,
              externalId: true,
              displayName: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    take: 220,
  });

  const userIds = people.flatMap((person) =>
    person.identityLinks.map((link) => link.userId)
  );
  const conversations = userIds.length
    ? await prisma.conversation.findMany({
        where: { userId: { in: userIds } },
        select: {
          id: true,
          userId: true,
          channel: true,
          externalConversationId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { role: true, content: true, createdAt: true },
          },
        },
      })
    : [];

  const conversationsByUser = new Map<string, typeof conversations>();
  for (const conversation of conversations) {
    const list = conversationsByUser.get(conversation.userId) ?? [];
    list.push(conversation);
    conversationsByUser.set(conversation.userId, list);
  }

  const summaries = people.map((person) => {
    const identityLinks = person.identityLinks.map((link) => {
      const userConversations = conversationsByUser.get(link.userId) ?? [];
      const latest =
        userConversations
          .map(latestConversationMessage)
          .filter(
            (message): message is NonNullable<ReturnType<typeof latestConversationMessage>> =>
              Boolean(message)
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
      return {
        id: link.id,
        personId: link.personId,
        userId: link.userId,
        source: link.source,
        verifiedBy: link.verifiedBy,
        createdAt: link.createdAt,
        user: link.user,
        conversationCount: userConversations.length,
        messageCount: userConversations.reduce(
          (sum, conversation) => sum + conversation._count.messages,
          0
        ),
        lastMessageAt: latest?.createdAt ?? null,
      };
    });
    const lastMessageAt =
      identityLinks
        .map((link) => link.lastMessageAt)
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const isOwner = identityLinks.some((link) =>
      isOwnerExternalId(link.user.externalId)
    );
    return {
      person: {
        id: person.id,
        label: person.label,
        note: person.note,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
      },
      relationship: person.relationshipState,
      identityLinks,
      isOwner,
      lastMessageAt,
      conversationCount: identityLinks.reduce(
        (sum, link) => sum + link.conversationCount,
        0
      ),
      messageCount: identityLinks.reduce((sum, link) => sum + link.messageCount, 0),
    };
  });

  summaries.sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    const aTime =
      a.lastMessageAt?.getTime() ??
      a.relationship?.lastInteractionAt?.getTime() ??
      a.person.updatedAt.getTime();
    const bTime =
      b.lastMessageAt?.getTime() ??
      b.relationship?.lastInteractionAt?.getTime() ??
      b.person.updatedAt.getTime();
    return bTime - aTime;
  });

  return summaries.slice(0, clampLimit(input.limit, 80));
}

async function getConversationPersonDetail(personId: string, conversationLimit: number) {
  const person = await prisma.personIdentity.findUniqueOrThrow({
    where: { id: personId },
    include: {
      relationshipState: true,
      identityLinks: {
        include: {
          user: {
            select: {
              id: true,
              externalId: true,
              displayName: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const userIds = person.identityLinks.map((link) => link.userId);
  const conversations = userIds.length
    ? await prisma.conversation.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: "desc" },
        take: clampLimit(conversationLimit, 80),
        select: {
          id: true,
          userId: true,
          channel: true,
          externalConversationId: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { role: true, content: true, createdAt: true },
          },
        },
      })
    : [];

  const conversationsByUser = new Map<string, typeof conversations>();
  for (const conversation of conversations) {
    const list = conversationsByUser.get(conversation.userId) ?? [];
    list.push(conversation);
    conversationsByUser.set(conversation.userId, list);
  }

  const users = person.identityLinks.map((link) => {
    const userConversations = conversationsByUser.get(link.userId) ?? [];
    userConversations.sort((a, b) => {
      const aLatest = latestConversationMessage(a)?.createdAt ?? a.createdAt;
      const bLatest = latestConversationMessage(b)?.createdAt ?? b.createdAt;
      return bLatest.getTime() - aLatest.getTime();
    });
    return {
      link: {
        id: link.id,
        personId: link.personId,
        userId: link.userId,
        source: link.source,
        verifiedBy: link.verifiedBy,
        createdAt: link.createdAt,
      },
      user: link.user,
      isOwner: isOwnerExternalId(link.user.externalId),
      conversations: userConversations.map((conversation) => {
        const latest = latestConversationMessage(conversation);
        return {
          id: conversation.id,
          userId: conversation.userId,
          channel: conversation.channel,
          externalConversationId: conversation.externalConversationId,
          metadata: conversation.metadata,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messageCount: conversation._count.messages,
          lastMessageAt: latest?.createdAt ?? null,
          lastMessageRole: latest?.role ?? null,
          lastMessagePreview: latest ? messagePreview(latest.content) : null,
        };
      }),
    };
  });

  users.sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    return a.user.externalId.localeCompare(b.user.externalId);
  });

  const lastMessageAt =
    users
      .flatMap((user) => user.conversations.map((conversation) => conversation.lastMessageAt))
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    person: {
      id: person.id,
      label: person.label,
      note: person.note,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    },
    relationship: person.relationshipState,
    isOwner: users.some((user) => user.isOwner),
    lastMessageAt,
    users,
  };
}

async function getConversationMessages(conversationId: string, limit: number) {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      user: {
        select: { id: true, externalId: true, displayName: true },
      },
    },
  });
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: clampLimit(limit, 120),
  });
  return {
    conversation,
    messages: messages.reverse(),
  };
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
        active: runtimeConfig.ACTIVE_MODEL_PROVIDER === "openai",
        baseUrlConfigured: configured(env.OPENAI_BASE_URL),
        apiKeyConfigured: configured(env.OPENAI_API_KEY),
        model: env.OPENAI_MODEL || null,
      },
      {
        name: "anthropic",
        label: "Anthropic",
        active: runtimeConfig.ACTIVE_MODEL_PROVIDER === "anthropic",
        baseUrlConfigured: configured(env.ANTHROPIC_BASE_URL),
        apiKeyConfigured: configured(env.ANTHROPIC_API_KEY),
        model: env.ANTHROPIC_MODEL || null,
      },
      {
        name: "glm",
        label: "GLM",
        active: runtimeConfig.ACTIVE_MODEL_PROVIDER === "glm",
        baseUrlConfigured: configured(env.GLM_BASE_URL),
        apiKeyConfigured: configured(env.GLM_API_KEY),
        model: env.GLM_MODEL || null,
      },
      {
        name: "qwen",
        label: "Qwen",
        active: runtimeConfig.ACTIVE_MODEL_PROVIDER === "qwen",
        baseUrlConfigured: configured(env.QWEN_BASE_URL),
        apiKeyConfigured: configured(env.QWEN_API_KEY),
        model: env.QWEN_MODEL || null,
      },
      {
        name: "deepseek",
        label: "DeepSeek",
        active: runtimeConfig.ACTIVE_MODEL_PROVIDER === "deepseek",
        baseUrlConfigured: configured(env.DEEPSEEK_BASE_URL),
        apiKeyConfigured: configured(env.DEEPSEEK_API_KEY),
        model: env.DEEPSEEK_MODEL || null,
      },
      {
        name: "minimax",
        label: "MiniMax",
        active: runtimeConfig.ACTIVE_MODEL_PROVIDER === "minimax",
        baseUrlConfigured: configured(env.MINIMAX_BASE_URL),
        apiKeyConfigured: configured(env.MINIMAX_API_KEY),
        model: env.MINIMAX_MODEL || null,
      },
      {
        name: "kimi",
        label: "Kimi",
        active: runtimeConfig.ACTIVE_MODEL_PROVIDER === "kimi",
        baseUrlConfigured: configured(env.KIMI_BASE_URL),
        apiKeyConfigured: configured(env.KIMI_API_KEY),
        model: env.KIMI_MODEL || null,
      },
      {
        name: "siliconflow",
        label: "SiliconFlow",
        active: runtimeConfig.ACTIVE_MODEL_PROVIDER === "siliconflow",
        baseUrlConfigured: configured(env.SILICONFLOW_BASE_URL),
        apiKeyConfigured: configured(env.SILICONFLOW_API_KEY),
        model: env.SILICONFLOW_MODEL || null,
      },
    ];

    return reply.send({
      activeModelProvider: runtimeConfig.ACTIVE_MODEL_PROVIDER,
      providers,
      channels: {
        telegram: {
          enabled: runtimeConfig.TELEGRAM_ENABLED,
          mode: runtimeConfig.TELEGRAM_ENABLED ? env.TELEGRAM_MODE : null,
          tokenConfigured: configured(env.TELEGRAM_BOT_TOKEN),
          proxyConfigured: configured(env.TELEGRAM_PROXY || env.EXTERNAL_HTTP_PROXY),
        },
        weixin: {
          enabled: runtimeConfig.WEIXIN_ENABLED,
          mode: runtimeConfig.WEIXIN_ENABLED ? "openclaw_bridge" : null,
          secretConfigured: configured(env.WEIXIN_BRIDGE_SECRET),
        },
      },
      features: {
        memoryRetrieval: runtimeConfig.MEMORY_RETRIEVAL_ENABLED,
        tools: runtimeConfig.TOOLS_ENABLED,
        dream: runtimeConfig.DREAM_ENABLED,
        runtimeStateAutoUpdate: runtimeConfig.RUNTIME_STATE_AUTO_UPDATE_ENABLED,
        runtimeAutonomy: runtimeConfig.RUNTIME_AUTONOMY_AUTO_RUN,
        webSearch: runtimeConfig.TAVILY_ENABLED,
        pageReader: runtimeConfig.JINA_ENABLED || runtimeConfig.PLAYWRIGHT_ENABLED ||
          (runtimeConfig.MCP_ENABLED && runtimeConfig.CHROME_DEVTOOLS_MCP_ENABLED),
        mcp: runtimeConfig.MCP_ENABLED,
      },
      safety: {
        toolsAllowMediumRisk: runtimeConfig.TOOLS_ALLOW_MEDIUM_RISK,
        toolsAllowHighRisk: runtimeConfig.TOOLS_ALLOW_HIGH_RISK,
      },
      limits: {
        maxMessageLength: runtimeConfig.MAX_MESSAGE_LENGTH,
        toolMaxCallsPerMessage: runtimeConfig.TOOL_MAX_CALLS_PER_MESSAGE,
      },
    });
  });

  app.get("/v1/admin/settings", async (_request, reply) => {
    const storedRows = await prisma.systemSetting.findMany({ select: { key: true, updatedAt: true, updatedBy: true } });
    const stored = new Map(storedRows.map((row) => [row.key, row]));
    return reply.send({
      immediate: true,
      fields: runtimeSettingsService.list().map((field) => ({
        ...field,
        stored: stored.has(field.key),
        updatedAt: stored.get(field.key)?.updatedAt ?? null,
        updatedBy: stored.get(field.key)?.updatedBy ?? null,
      })),
    });
  });

  app.patch("/v1/admin/settings", async (request, reply) => {
    const body = (request.body ?? {}) as { values?: Record<string, unknown> };
    if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) {
      throw routeError("values is required", 400);
    }
    if (body.values.TELEGRAM_ENABLED === true && !configured(env.TELEGRAM_BOT_TOKEN)) {
      throw routeError("请先在连接配置中填写 TELEGRAM_BOT_TOKEN 并重启，再开启 Telegram。", 400);
    }
    if (body.values.WEIXIN_ENABLED === true && !configured(env.WEIXIN_BRIDGE_SECRET)) {
      throw routeError("请先在连接配置中填写 WEIXIN_BRIDGE_SECRET 并重启，再开启微信桥接。", 400);
    }
    if (typeof body.values.ACTIVE_MODEL_PROVIDER === "string") {
      const providerConnections: Record<string, [string, string, string]> = {
        openai: [env.OPENAI_BASE_URL, env.OPENAI_API_KEY, env.OPENAI_MODEL],
        anthropic: [env.ANTHROPIC_BASE_URL, env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL],
        glm: [env.GLM_BASE_URL, env.GLM_API_KEY, env.GLM_MODEL],
        qwen: [env.QWEN_BASE_URL, env.QWEN_API_KEY, env.QWEN_MODEL],
        deepseek: [env.DEEPSEEK_BASE_URL, env.DEEPSEEK_API_KEY, env.DEEPSEEK_MODEL],
        minimax: [env.MINIMAX_BASE_URL, env.MINIMAX_API_KEY, env.MINIMAX_MODEL],
        kimi: [env.KIMI_BASE_URL, env.KIMI_API_KEY, env.KIMI_MODEL],
        siliconflow: [env.SILICONFLOW_BASE_URL, env.SILICONFLOW_API_KEY, env.SILICONFLOW_MODEL],
      };
      const connection = providerConnections[body.values.ACTIVE_MODEL_PROVIDER];
      if (!connection?.every(configured)) {
        throw routeError("所选模型渠道的 Base URL、API Key 或 Model 尚未配置完整。", 400);
      }
    }
    try {
      const result = await runtimeSettingsService.updateMany(body.values, {
        changedBy: "admin",
        source: "admin",
      });
      return reply.send({
        ...result,
        immediate: true,
        fields: runtimeSettingsService.list(),
        message: result.applyErrors.length > 0
          ? `配置已保存，但有 ${result.applyErrors.length} 个运行组件重载失败：${result.applyErrors.join("；")}`
          : result.changedKeys.length > 0
          ? `已即时应用 ${result.changedKeys.length} 项运行配置。`
          : "没有需要保存的改动。",
      });
    } catch (error) {
      throw routeError(error instanceof Error ? error.message : String(error), 400);
    }
  });

  app.get("/v1/admin/settings/events", async (request, reply) => {
    const query = request.query as { limit?: string };
    return reply.send({
      events: await prisma.systemSettingEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: clampLimit(query.limit, 80),
      }),
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

  app.get("/v1/admin/conversation-people", async (request, reply) => {
    const query = request.query as { limit?: string; q?: string };
    const people = await listConversationPeople({
      query: query.q,
      limit: clampLimit(query.limit, 80),
    });
    return reply.send({ people });
  });

  app.get("/v1/admin/conversation-people/:personId", async (request, reply) => {
    const { personId } = request.params as { personId: string };
    const query = request.query as { conversationLimit?: string };
    const detail = await getConversationPersonDetail(
      personId,
      clampLimit(query.conversationLimit, 80)
    );
    return reply.send(detail);
  });

  app.get("/v1/admin/conversations/:conversationId/messages", async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const query = request.query as { limit?: string };
    const detail = await getConversationMessages(
      conversationId,
      clampLimit(query.limit, 120)
    );
    return reply.send(detail);
  });

  app.get("/v1/admin/web-chat/conversations", async (request, reply) => {
    const query = request.query as { limit?: string };
    const conversations = await listWebChatConversations(clampLimit(query.limit, 80));
    return reply.send({ conversations });
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

  app.get("/v1/admin/skills", async (_request, reply) => {
    return reply.send({ skills: await listSkills() });
  });

  app.post("/v1/admin/expression-learning/examples", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const sourceType = cleanString(body.sourceType) ?? "manual_teaching";
    const trainingRecordId = cleanNullableString(body.trainingRecordId) ?? null;
    const outcome = expressionLearningOutcome(body.outcome);
    const defaultOwnerAction = outcome === "skipped" ? "skipped" : "owner_taught";
    const ownerAction = expressionLearningOwnerAction(
      body.ownerAction,
      defaultOwnerAction
    );
    const status = expressionLearningStatus(body.status, "active");
    const metadata = cleanRecord(body.metadata) ?? {};
    const contextText = cleanString(body.contextText) ?? "";
    const draftText = cleanNullableString(body.draftText) ?? null;
    const finalText = outcome === "skipped"
      ? null
      : cleanNullableString(body.finalText) ?? null;
    const ownerNote = cleanNullableString(body.ownerNote) ?? null;
    const example = await learnExpression({
      sourceRef: cleanString(body.sourceRef) ?? (
        trainingRecordId ? `training:${trainingRecordId}` : `${sourceType}:${randomUUID()}`
      ),
      sourceType,
      sourceId: cleanNullableString(body.sourceId) ?? null,
      platform: cleanString(body.platform) ?? "general",
      scene: cleanString(body.scene) ?? "general",
      scope: expressionLearningScope(body.scope),
      contextText,
      draftText,
      finalText,
      outcome,
      ownerAction,
      ownerNote,
      status,
      metadata: {
        ...metadata,
        createdFrom: "admin_expression_learning",
        trainingRecordId,
      },
    });
    const trainingRecord = await completeExpressionLearningTrainingRecord({
      trainingRecordId,
      sourceType,
      platform: example.platform,
      scene: example.scene,
      scope: example.scope,
      status: "completed",
      contextText,
      draftText,
      finalText,
      outcome,
      ownerAction,
      ownerNote,
      reasonText: outcome === "skipped" ? ownerNote ?? finalText : ownerNote,
      rawPayload: body,
      example,
    });
    return reply.status(201).send({ example, trainingRecord });
  });

  app.post("/v1/admin/expression-learning/practice-question", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const input = {
      platform: cleanString(body.platform) ?? "general",
      scene: cleanString(body.scene) ?? "general",
      focus: cleanNullableString(body.focus) ?? null,
    };
    const question = await generateExpressionLearningPracticeQuestion(input);
    const trainingRecord = await createExpressionLearningTrainingRecord({
      sourceType: "practice_question",
      platform: question.platform,
      scene: question.scene,
      scope: "scene",
      status: "question_generated",
      contextText: question.contextText,
      draftText: question.draftText,
      generatedQuestion: question,
      rawPayload: {
        request: input,
      },
    });
    return reply.send({ question, trainingRecord });
  });

  app.post("/v1/admin/expression-learning/draft", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const input = {
      platform: cleanString(body.platform) ?? "general",
      scene: cleanString(body.scene) ?? "general",
      contextText: cleanString(body.contextText) ?? "",
    };
    const draft = await generateExpressionLearningDraft(input);
    const trainingRecord = await createExpressionLearningTrainingRecord({
      sourceType: "manual_draft",
      platform: input.platform,
      scene: input.scene,
      scope: "scene",
      status: "draft_generated",
      contextText: input.contextText,
      draftText: draft.draftText,
      generatedDraft: {
        ...draft,
        request: input,
      },
      rawPayload: {
        request: input,
      },
    });
    return reply.send({ ...draft, trainingRecord });
  });

  app.get("/v1/admin/expression-learning/training-records/export", async (request, reply) => {
    const query = request.query as { format?: string };
    const format = cleanString(query.format) === "jsonl" ? "jsonl" : "json";
    const exported = await exportExpressionLearningTrainingRecords(format);
    const suffix = format === "jsonl" ? "jsonl" : "json";
    reply.header(
      "Content-Disposition",
      `attachment; filename="lusiyuan-expression-training-${new Date().toISOString().slice(0, 10)}.${suffix}"`
    );
    if (format === "jsonl") {
      return reply.type("application/x-ndjson; charset=utf-8").send(exported);
    }
    return reply.type("application/json; charset=utf-8").send(exported);
  });

  app.get("/v1/admin/expression-learning/training-records", async (request, reply) => {
    const query = request.query as {
      sourceType?: string;
      status?: string;
      limit?: string;
    };
    const result = await listExpressionLearningTrainingRecords({
      sourceType: cleanString(query.sourceType) ?? "practice_question",
      status: cleanString(query.status) ?? "all",
      limit: clampLimit(query.limit, 100),
    });
    return reply.send(result);
  });

  app.patch("/v1/admin/expression-learning/training-records/:recordId", async (request, reply) => {
    const { recordId } = request.params as { recordId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const nextStatus = cleanNullableString(body.status) ?? undefined;
    if (
      nextStatus &&
      !["question_generated", "answered_archived", "completed", "dismissed"].includes(nextStatus)
    ) {
      throw routeError("invalid expression-learning training record status", 400);
    }
    const record = await updateExpressionLearningTrainingRecord(recordId, {
      status: hasOwn(body, "status") ? nextStatus : undefined,
      finalText: hasOwn(body, "finalText") ? cleanNullableString(body.finalText) ?? null : undefined,
      outcome: hasOwn(body, "outcome") ? cleanNullableString(body.outcome) ?? null : undefined,
      ownerAction: hasOwn(body, "ownerAction")
        ? cleanNullableString(body.ownerAction) ?? null
        : undefined,
      ownerNote: hasOwn(body, "ownerNote") ? cleanNullableString(body.ownerNote) ?? null : undefined,
      reasonText: hasOwn(body, "reasonText")
        ? cleanNullableString(body.reasonText) ?? null
        : undefined,
      rawPayload: body,
    });
    return reply.send({ record });
  });

  app.get("/v1/admin/expression-learning/examples", async (request, reply) => {
    const query = request.query as {
      platform?: string;
      scene?: string;
      status?: string;
      outcome?: string;
      q?: string;
      limit?: string;
    };
    const clauses: Prisma.ExpressionLearningExampleWhereInput[] = [];
    const platform = cleanString(query.platform);
    const scene = cleanString(query.scene);
    const status = cleanString(query.status);
    const outcome = cleanString(query.outcome);
    const search = cleanString(query.q);
    if (platform && platform !== "all") clauses.push({ platform });
    if (scene && scene !== "all") clauses.push({ scene });
    if (status && status !== "all") clauses.push({ status });
    if (outcome && outcome !== "all") clauses.push({ outcome });
    if (search) {
      clauses.push({
        OR: [
          { contextText: { contains: search, mode: "insensitive" } },
          { finalText: { contains: search, mode: "insensitive" } },
          { lesson: { contains: search, mode: "insensitive" } },
          { reasoning: { contains: search, mode: "insensitive" } },
          { ownerNote: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.ExpressionLearningExampleWhereInput = clauses.length > 0
      ? { AND: clauses }
      : {};
    const [examples, total, active, pending, skipped, platforms] = await Promise.all([
      prisma.expressionLearningExample.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: clampLimit(query.limit, 100),
      }),
      prisma.expressionLearningExample.count(),
      prisma.expressionLearningExample.count({ where: { status: "active" } }),
      prisma.expressionLearningExample.count({ where: { status: "pending" } }),
      prisma.expressionLearningExample.count({ where: { outcome: "skipped" } }),
      prisma.expressionLearningExample.findMany({
        distinct: ["platform"],
        select: { platform: true },
        orderBy: { platform: "asc" },
      }),
    ]);
    return reply.send({
      examples,
      summary: { total, active, pending, skipped },
      platforms: platforms.map((item) => item.platform),
    });
  });

  app.patch("/v1/admin/expression-learning/examples/:exampleId", async (request, reply) => {
    const { exampleId } = request.params as { exampleId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const data: Prisma.ExpressionLearningExampleUpdateInput = {};
    if (body.lesson !== undefined) data.lesson = cleanString(body.lesson) ?? "";
    if (body.reasoning !== undefined) data.reasoning = cleanNullableString(body.reasoning);
    if (body.strategy !== undefined) data.strategy = cleanNullableString(body.strategy);
    if (body.tone !== undefined) data.tone = cleanNullableString(body.tone);
    if (body.ownerNote !== undefined) data.ownerNote = cleanNullableString(body.ownerNote);
    if (body.status !== undefined) {
      const next = cleanString(body.status);
      if (!next || !["pending", "active", "disabled"].includes(next)) {
        throw routeError("status must be pending, active, or disabled", 400);
      }
      data.status = next;
    }
    if (body.scope !== undefined) {
      const next = cleanString(body.scope);
      if (!next || !["global", "platform", "scene", "private"].includes(next)) {
        throw routeError("invalid expression-learning scope", 400);
      }
      data.scope = next;
    }
    if (body.tags !== undefined) data.tags = body.tags as Prisma.InputJsonValue;
    if (body.avoidances !== undefined) data.avoidances = body.avoidances as Prisma.InputJsonValue;
    let example = await prisma.expressionLearningExample.update({
      where: { id: exampleId },
      data,
    });
    const embeddingFields = ["lesson", "strategy", "tone", "tags", "avoidances"];
    if (embeddingFields.some((field) => body[field] !== undefined)) {
      example = await reindexExpressionLearningExample(exampleId);
    }
    return reply.send({ example });
  });

  app.post("/v1/admin/expression-learning/examples/:exampleId/reanalyze", async (request, reply) => {
    const { exampleId } = request.params as { exampleId: string };
    const example = await reanalyzeExpressionLearningExample(exampleId);
    return reply.send({ example });
  });

  app.get("/v1/admin/skills/xiaohongshu-reply/config", async (_request, reply) => {
    return reply.send({ config: await loadXiaohongshuReplyConfig() });
  });

  app.patch("/v1/admin/skills/xiaohongshu-reply/config", async (request, reply) => {
    const body = (request.body ?? {}) as { config?: unknown };
    if (!body.config || typeof body.config !== "object") {
      throw routeError("config is required", 400);
    }
    const config = await saveXiaohongshuReplyConfig(body.config);
    return reply.send({ config, message: "小红书回复 Skill 配置已保存。" });
  });

  app.post("/v1/admin/skills/xiaohongshu-reply/config/reset", async (_request, reply) => {
    const config = await resetXiaohongshuReplyConfig();
    return reply.send({ config, message: "小红书回复 Skill 配置已恢复默认。" });
  });

  app.post("/v1/admin/skills/xiaohongshu-reply/draft", async (request, reply) => {
    if (!(await isXiaohongshuReplySkillEnabled())) {
      throw routeError("小红书回复 Skill 已关闭，请先在 Skills 页面开启。", 409);
    }
    const body = (request.body ?? {}) as {
      postTitle?: string;
      postCaption?: string | null;
      postType?: string;
      comment?: string;
      threadContext?: string | null;
    };
    const postTitle = cleanString(body.postTitle);
    const comment = cleanString(body.comment);
    if (!postTitle) throw routeError("postTitle is required", 400);
    if (!comment) throw routeError("comment is required", 400);
    const result = await generateXiaohongshuReplyDraft({
      postTitle,
      postCaption: cleanNullableString(body.postCaption) ?? "",
      postType: normalizeXiaohongshuPostType(body.postType),
      comment,
      threadContext: cleanNullableString(body.threadContext) ?? "",
    });
    return reply.send(result);
  });

  app.get("/v1/admin/xiaohongshu/posts", async (_request, reply) => {
    return reply.send({
      posts: await listXiaohongshuAccountMirror(),
      postTypes: xiaohongshuPostTypeLabels,
    });
  });

  app.get("/v1/admin/xiaohongshu/import-status", async (_request, reply) => {
    return reply.send({
      mcpEnabled: runtimeConfig.MCP_ENABLED,
      chromeDevtoolsMcpEnabled: runtimeConfig.CHROME_DEVTOOLS_MCP_ENABLED,
      browserAvailable: await chromeDevtoolsMcpService.isAvailable(),
      connectionMode: runtimeConfig.CHROME_DEVTOOLS_MCP_CONNECTION_MODE,
      browserUrl: runtimeConfig.CHROME_DEVTOOLS_MCP_CONNECTION_MODE === "browser_url"
        ? runtimeConfig.CHROME_DEVTOOLS_MCP_BROWSER_URL
        : null,
      pageBehavior: {
        reusesExistingPage: true,
        leavesPageOpen: true,
        automaticScrolling: false,
        automaticExpansion: true,
        minimumOpenIntervalMs: Math.max(runtimeConfig.CHROME_DEVTOOLS_MCP_MIN_OPEN_INTERVAL_MS, 5000),
      },
    });
  });

  app.post("/v1/admin/xiaohongshu/import-url", async (request, reply) => {
    const body = (request.body ?? {}) as { url?: string };
    const url = cleanString(body.url);
    if (!url) throw routeError("url is required", 400);
    return reply.send(await importXiaohongshuUrl(url));
  });

  app.patch("/v1/admin/xiaohongshu/posts/:postId", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const data: Prisma.XiaohongshuPostUpdateInput = {};
    if (body.title !== undefined) {
      const title = cleanString(body.title);
      if (!title) throw routeError("title cannot be empty", 400);
      data.title = title;
    }
    if (body.caption !== undefined) data.caption = cleanNullableString(body.caption);
    if (body.authorName !== undefined) data.authorName = cleanNullableString(body.authorName);
    if (body.postType !== undefined) data.postType = normalizeXiaohongshuPostType(body.postType);
    let targetImageCount: number | undefined;
    if (body.imageCount !== undefined) {
      const parsed = typeof body.imageCount === "number"
        ? body.imageCount
        : Number.parseInt(String(body.imageCount), 10);
      if (!Number.isFinite(parsed)) throw routeError("imageCount must be a number", 400);
      targetImageCount = Math.trunc(parsed);
      if (targetImageCount < 0 || targetImageCount > 30) {
        throw routeError("imageCount must be between 0 and 30", 400);
      }
      data.imageCount = targetImageCount;
    }
    if (body.imageAlts !== undefined) {
      if (!Array.isArray(body.imageAlts)) throw routeError("imageAlts must be an array", 400);
      const rawImageAlts = body.imageAlts;
      const post = targetImageCount === undefined
        ? await prisma.xiaohongshuPost.findUniqueOrThrow({ where: { id: postId } })
        : null;
      const imageCount = targetImageCount ?? post?.imageCount ?? 0;
      data.imageAlts = Array.from({ length: imageCount }, (_, index) => {
        const item = rawImageAlts[index];
        return typeof item === "string" ? item.trim().slice(0, 1000) : "";
      });
    }
    await prisma.xiaohongshuPost.update({ where: { id: postId }, data });
    return reply.send({ posts: await listXiaohongshuAccountMirror() });
  });

  app.patch("/v1/admin/xiaohongshu/comments/:commentId", async (request, reply) => {
    const { commentId } = request.params as { commentId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const content = body.content === undefined ? undefined : cleanString(body.content);
    if (body.content !== undefined && !content) throw routeError("comment content cannot be empty", 400);
    await prisma.xiaohongshuComment.update({
      where: { id: commentId },
      data: {
        ...(content !== undefined ? { content } : {}),
        ...(body.authorName !== undefined ? { authorName: cleanNullableString(body.authorName) } : {}),
      },
    });
    return reply.send({ posts: await listXiaohongshuAccountMirror() });
  });

  app.post("/v1/admin/xiaohongshu/comments/:commentId/generate-reply", async (request, reply) => {
    if (!(await isXiaohongshuReplySkillEnabled())) {
      throw routeError("小红书回复 Skill 已关闭，请先在 Skills 页面开启。", 409);
    }
    const { commentId } = request.params as { commentId: string };
    const result = await generateXiaohongshuReplyDraftForComment(commentId);
    return reply.send(result);
  });

  app.patch("/v1/admin/xiaohongshu/reply-drafts/:draftId", async (request, reply) => {
    const { draftId } = request.params as { draftId: string };
    const body = (request.body ?? {}) as { content?: string; status?: string };
    const data: Prisma.XiaohongshuReplyDraftUpdateInput = {};
    if (body.content !== undefined) data.content = cleanString(body.content) ?? "";
    if (body.status !== undefined) data.status = cleanString(body.status) ?? "draft";
    const draft = await prisma.xiaohongshuReplyDraft.update({
      where: { id: draftId },
      data,
    });
    return reply.send({ draft });
  });

  app.post("/v1/admin/xiaohongshu/comments/:commentId/final-decision", async (request, reply) => {
    const { commentId } = request.params as { commentId: string };
    const body = (request.body ?? {}) as {
      draftId?: string | null;
      content?: string | null;
      outcome?: string;
      ownerNote?: string | null;
    };
    const outcome = cleanString(body.outcome);
    if (outcome !== "sent" && outcome !== "skipped") {
      throw routeError("outcome must be sent or skipped", 400);
    }
    const result = await recordXiaohongshuFinalDecision({
      commentId,
      draftId: cleanNullableString(body.draftId) ?? null,
      content: cleanNullableString(body.content) ?? null,
      outcome,
      ownerNote: cleanNullableString(body.ownerNote) ?? null,
    });
    return reply.send(result);
  });

  app.post("/v1/admin/xiaohongshu/sync", async (request, reply) => {
    const body = (request.body ?? {}) as { posts?: unknown };
    if (!Array.isArray(body.posts)) throw routeError("posts array is required", 400);
    const result = await syncXiaohongshuAccountMirror(body.posts as Parameters<typeof syncXiaohongshuAccountMirror>[0]);
    return reply.send(result);
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

    if (memory.status === "active" && runtimeConfig.MEMORY_RETRIEVAL_ENABLED) {
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
      runtimeConfig.MEMORY_RETRIEVAL_ENABLED &&
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
