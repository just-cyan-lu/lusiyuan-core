import type { FastifyInstance } from "fastify";
import { chat } from "../core/chat.service.js";
import { prisma } from "../db/prisma.js";
import { memoryService } from "../core/memory.service.js";
import { requireAdminAuth } from "./admin-auth.js";
import { env } from "../utils/env.js";
import type { ChatOutput, ChatReplyPart } from "../types/chat.js";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function publicChatOutput(output: ChatOutput) {
  return {
    reply: output.reply,
    replies: output.replies,
    reply_parts: output.reply_parts,
    conversation_id: output.conversation_id,
    memory_written: output.memory_written,
    turn_id: output.turn_id,
    duplicated: output.duplicated,
  };
}

function ssePayload(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

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

  app.post(
    "/v1/chat/stream",
    { schema: { body: chatBodySchema } },
    async (request, reply) => {
      const input = request.body as {
        user_id: string;
        channel: string;
        conversation_id: string;
        message: string;
      };

      reply.hijack();
      const response = reply.raw;
      let closed = false;

      request.raw.on("aborted", () => {
        closed = true;
      });
      response.on("close", () => {
        closed = true;
      });

      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": env.WEB_ORIGIN,
        Vary: "Origin",
      });
      response.write(ssePayload("ready", { ok: true }));

      const writeEvent = (event: string, data: unknown) => {
        if (closed || response.destroyed) return;
        response.write(ssePayload(event, data));
      };

      const sendPart = async (part: ChatReplyPart) => {
        if (part.kind !== "progress" && part.delay_ms > 0) {
          await sleep(part.delay_ms);
        }
        writeEvent(part.kind === "progress" ? "progress" : "message", part);
      };

      try {
        const output = await chat({
          ...input,
          channel: "web",
          onReplyPart: sendPart,
        });

        if (!output.duplicated) {
          for (const part of output.reply_parts.filter((item) => item.kind === "final")) {
            await sendPart(part);
          }
        }

        writeEvent("done", publicChatOutput(output));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        writeEvent("error", { error: message });
      } finally {
        if (!closed && !response.destroyed) response.end();
      }
    }
  );

  app.get("/v1/users/:userId/memories", async (request, reply) => {
    requireAdminAuth(request);
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
      requireAdminAuth(request);
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

  // Conversation history — used by Web frontend to restore messages on refresh
  app.get("/v1/conversations/:conversationId/messages", async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };

    const conversation = await prisma.conversation.findFirst({
      where: { externalConversationId: conversationId },
    });

    if (!conversation) {
      return reply.send({ messages: [] });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, createdAt: true },
    });

    return reply.send({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });
}
