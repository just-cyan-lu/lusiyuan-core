import type { FastifyInstance } from "fastify";
import { runChatTask } from "../../core/chat.service.js";
import { isTaskCancellationError } from "../../runtime/running-task-registry.js";
import { env } from "../../utils/env.js";
import { runtimeConfig } from "../../config/runtime-settings.service.js";
import type { WeixinIncomingBody } from "./weixin.types.js";

const weixinBodySchema = {
  type: "object",
  required: ["external_user_id", "external_conversation_id", "text"],
  properties: {
    external_user_id: { type: "string", minLength: 1 },
    external_conversation_id: { type: "string", minLength: 1 },
    external_message_id: { type: "string" },
    display_name: { type: "string" },
    text: { type: "string", minLength: 1 },
    raw: {},
  },
} as const;

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
        const result = await runChatTask({
          user_id: `weixin:${body.external_user_id}`,
          channel: "weixin",
          conversation_id: `weixin:${body.external_conversation_id}`,
          message: body.text,
          external_message_id: body.external_message_id,
          display_name: body.display_name,
          raw_event: body.raw,
        });

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
