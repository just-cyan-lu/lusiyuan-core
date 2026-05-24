import type { FastifyInstance } from "fastify";
import { chat } from "../core/chat.service.js";
import { prisma } from "../db/prisma.js";
import { memoryService } from "../core/memory.service.js";
import type { MemoryType } from "../types/memory.js";

const chatBodySchema = {
  type: "object",
  required: ["user_id", "channel", "conversation_id", "message"],
  properties: {
    user_id: { type: "string", minLength: 1 },
    channel: { type: "string", minLength: 1 },
    conversation_id: { type: "string", minLength: 1 },
    message: { type: "string", minLength: 1 },
  },
} as const;

const addMemoryBodySchema = {
  type: "object",
  required: ["type", "content"],
  properties: {
    type: { type: "string", minLength: 1 },
    content: { type: "string", minLength: 1 },
    importance: { type: "number", minimum: 1, maximum: 10 },
  },
} as const;

export async function chatRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/chat",
    { schema: { body: chatBodySchema } },
    async (request, reply) => {
      const input = request.body as {
        user_id: string;
        channel: string;
        conversation_id: string;
        message: string;
      };

      try {
        const output = await chat(input);
        return reply.send(output);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        return reply.status(400).send({ error: message });
      }
    }
  );

  app.get("/v1/users/:userId/memories", async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await prisma.user.findUnique({ where: { externalId: userId } });
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const memories = await memoryService.listUserMemories(user.id);
    return reply.send({ memories });
  });

  app.post(
    "/v1/users/:userId/memories",
    { schema: { body: addMemoryBodySchema } },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = request.body as {
        type: string;
        content: string;
        importance?: number;
      };

      const user = await prisma.user.findUnique({ where: { externalId: userId } });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      await memoryService.createMemories(user.id, [
        {
          type: body.type as MemoryType,
          content: body.content,
          importance: body.importance ?? 5,
          source: "manual",
        },
      ]);

      return reply.send({ ok: true });
    }
  );
}
