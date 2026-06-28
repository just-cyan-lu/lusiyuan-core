import type { FastifyInstance } from "fastify";
import { toolRegistry } from "../tools/tool-registry.js";
import { toolExecutor } from "../tools/tool-executor.js";
import { prisma } from "../db/prisma.js";
import { requireAdminAuth } from "./admin-auth.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { Prisma } from "@prisma/client";
import type { ToolExecutionContext } from "../tools/tool.types.js";

function clampLimit(value: unknown, fallback = 50): number {
  const parsed = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 200);
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function effectiveToolState(tool: {
  enabled: boolean;
}): { effectiveEnabled: boolean; disabledReason: string | null } {
  if (!tool.enabled) {
    return { effectiveEnabled: false, disabledReason: "Tool is disabled" };
  }
  return { effectiveEnabled: true, disabledReason: null };
}

export async function toolsRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  app.get("/v1/tools", async (_request, reply) => {
    const tools = toolRegistry.listAll().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? null,
      riskLevel: t.riskLevel,
      enabled: t.enabled,
      accessMode: t.accessMode ?? (t.enabled ? (t.ownerOnly ? "owner_only" : "on") : "off"),
      ...effectiveToolState(t),
      ownerOnly: t.ownerOnly ?? false,
    }));
    return reply.send({
      tools,
      policy: {
        callLogEnabled: runtimeConfig.TOOL_CALL_LOG_ENABLED,
      },
    });
  });

  app.post("/v1/tools/:toolName/execute", async (request, reply) => {
    const { toolName } = request.params as { toolName: string };
    const body = request.body as {
      userId: string;
      channel?: string;
      conversationId?: string;
      input?: Record<string, unknown>;
    };

    if (!body.userId) {
      return reply.status(400).send({ error: "userId required" });
    }

    const user = await prisma.user.findUnique({
      where: { externalId: body.userId },
    });
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const context: ToolExecutionContext = {
      userId: user.id,
      channel: body.channel ?? "api",
      conversationId: body.conversationId,
      isOwner: true,
    };

    const result = await toolExecutor.execute({
      toolName,
      input: body.input ?? {},
      context,
    });

    return reply.send(result);
  });

  app.get("/v1/tool-logs", async (request, reply) => {
    const query = request.query as {
      userId?: string;
      toolName?: string;
      status?: string;
      riskLevel?: string;
      blocked?: string;
      channel?: string;
      conversationId?: string;
      from?: string;
      to?: string;
      q?: string;
      limit?: string;
    };
    const limit = clampLimit(query.limit, 50);

    let internalUserId: string | undefined;
    if (query.userId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: query.userId }, { externalId: query.userId }],
        },
      });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      internalUserId = user.id;
    }

    const where: Prisma.ToolCallLogWhereInput = {};
    if (internalUserId) where.userId = internalUserId;
    if (cleanString(query.toolName)) where.toolName = query.toolName;
    if (cleanString(query.status)) where.status = query.status;
    if (cleanString(query.riskLevel)) where.riskLevel = query.riskLevel;
    if (cleanString(query.channel)) where.channel = query.channel;
    if (cleanString(query.conversationId)) where.conversationId = query.conversationId;
    if (query.blocked === "true") where.blocked = true;
    if (query.blocked === "false") where.blocked = false;

    const from = cleanDate(query.from);
    const to = cleanDate(query.to);
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const search = cleanString(query.q);
    if (search) {
      where.OR = [
        { toolName: { contains: search, mode: "insensitive" } },
        { status: { contains: search, mode: "insensitive" } },
        { error: { contains: search, mode: "insensitive" } },
        { blockReason: { contains: search, mode: "insensitive" } },
        { channel: { contains: search, mode: "insensitive" } },
        { conversationId: { contains: search, mode: "insensitive" } },
        { messageId: { contains: search, mode: "insensitive" } },
      ];
    }

    const logs = await prisma.toolCallLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        toolName: true,
        riskLevel: true,
        status: true,
        blocked: true,
        blockReason: true,
        userId: true,
        conversationId: true,
        messageId: true,
        channel: true,
        input: true,
        output: true,
        error: true,
        durationMs: true,
        createdAt: true,
      },
    });

    return reply.send({ logs });
  });
}
