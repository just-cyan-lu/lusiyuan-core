import type { FastifyInstance } from "fastify";
import { env } from "../utils/env.js";
import { requireAdminAuth } from "./admin-auth.js";
import { prisma } from "../db/prisma.js";
import { memoryService } from "../core/memory.service.js";
import { Prisma } from "@prisma/client";

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
        drafts: env.DRAFTS_ENABLED,
        reflection: env.REFLECTION_ENABLED,
        dream: env.DREAM_ENABLED,
        dreamAutoRun: env.DREAM_AUTO_RUN,
        externalInbox: env.EXTERNAL_INBOX_ENABLED,
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

  app.get("/v1/admin/memories", async (request, reply) => {
    const query = request.query as {
      user_id?: string;
      status?: string;
      scope?: string;
      type?: string;
      q?: string;
      limit?: string;
    };

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
        { content: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { source: { contains: search, mode: "insensitive" } },
      ];
    }

    const memories = await prisma.memory.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            externalId: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { importance: "desc" }],
      take: clampLimit(query.limit),
    });

    return reply.send({ memories });
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
