import type { FastifyInstance } from "fastify";
import { runChatTask } from "../../core/chat.service.js";
import { isTaskCancellationError } from "../../runtime/running-task-registry.js";
import { env } from "../../utils/env.js";
import { runtimeConfig } from "../../config/runtime-settings.service.js";
import type { WeixinIncomingBody } from "./weixin.types.js";

const weixinBodySchema = {
  type: "object",
  required: ["text"],
  properties: {
    external_user_id: { type: "string", minLength: 1 },
    external_conversation_id: { type: "string", minLength: 1 },
    external_message_id: { type: "string" },
    client_message_id: { type: "string" },
    sender_name: { type: "string" },
    conversation_name: { type: "string" },
    display_name: { type: "string" },
    captured_at: { type: "string" },
    text: { type: "string", minLength: 1 },
    raw: {},
  },
} as const;

function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : undefined;
}

function nameExternalId(name: string): string {
  return `name:${name}`;
}

function rawEventFromBody(body: WeixinIncomingBody): Record<string, unknown> {
  const raw = body.raw && typeof body.raw === "object" && !Array.isArray(body.raw)
    ? body.raw as Record<string, unknown>
    : {};
  return {
    ...raw,
    sender_name: cleanName(body.sender_name) ?? null,
    conversation_name: cleanName(body.conversation_name) ?? null,
    captured_at: cleanName(body.captured_at) ?? null,
    client_message_id: cleanName(body.client_message_id) ?? null,
  };
}

export function normalizeWeixinIncomingBody(body: WeixinIncomingBody) {
  const senderName = cleanName(body.sender_name);
  const conversationName = cleanName(body.conversation_name) ?? senderName;
  const externalUserId = cleanName(body.external_user_id) ?? (senderName ? nameExternalId(senderName) : undefined);
  if (!externalUserId) {
    throw new Error("external_user_id or sender_name is required");
  }

  const externalConversationId =
    cleanName(body.external_conversation_id) ??
    (conversationName ? nameExternalId(conversationName) : externalUserId);
  const externalMessageId = cleanName(body.external_message_id) ?? cleanName(body.client_message_id);
  const displayName = cleanName(body.display_name) ?? senderName ?? cleanName(body.external_user_id);

  return {
    user_id: `weixin:${externalUserId}`,
    channel: "weixin" as const,
    conversation_id: `weixin:${externalConversationId}`,
    message: body.text,
    external_message_id: externalMessageId,
    display_name: displayName,
    raw_event: rawEventFromBody(body),
  };
}

export async function weixinRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/channels/weixin/incoming",
    { schema: { body: weixinBodySchema } },
    async (request, reply) => {
      if (!runtimeConfig.WEIXIN_ENABLED) {
        return reply.status(503).send({ error: "Weixin channel is disabled" });
      }
      const secret = request.headers["x-lusiyuan-channel-secret"];

      if (!env.WEIXIN_BRIDGE_SECRET || secret !== env.WEIXIN_BRIDGE_SECRET) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = request.body as WeixinIncomingBody;

      try {
        const result = await runChatTask(normalizeWeixinIncomingBody(body));

        if (result.duplicated) {
          return reply.send({ reply: "", duplicated: true });
        }

        return reply.send({
          reply: result.reply,
          replies: result.replies,
          reply_parts: result.reply_parts,
          turn_id: result.turn_id,
        });
      } catch (err) {
        if (isTaskCancellationError(err)) {
          return reply.send({ reply: "", cancelled: true });
        }
        const message = err instanceof Error ? err.message : "Internal error";
        return reply.status(400).send({ error: message });
      }
    }
  );
}
