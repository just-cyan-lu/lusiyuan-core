import type { FastifyInstance } from "fastify";
import { toolRegistry } from "../tools/tool-registry.js";
import { toolExecutor } from "../tools/tool-executor.js";
import { prisma } from "../db/prisma.js";
import { requireAdminAuth } from "./admin-auth.js";
import type { ToolExecutionContext } from "../tools/tool.types.js";

export async function toolsRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  app.get("/v1/tools", async (_request, reply) => {
    const tools = toolRegistry.listAll().map((t) => ({
      name: t.name,
      description: t.description,
      riskLevel: t.riskLevel,
      enabled: t.enabled,
      ownerOnly: t.ownerOnly ?? false,
    }));
    return reply.send({ tools });
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
    const query = request.query as { userId?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10), 100);

    let internalUserId: string | undefined;
    if (query.userId) {
      const user = await prisma.user.findUnique({
        where: { externalId: query.userId },
      });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      internalUserId = user.id;
    }

    const logs = await prisma.toolCallLog.findMany({
      where: internalUserId ? { userId: internalUserId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        toolName: true,
        riskLevel: true,
        status: true,
        blocked: true,
        blockReason: true,
        durationMs: true,
        createdAt: true,
      },
    });

    return reply.send({ logs });
  });
}
