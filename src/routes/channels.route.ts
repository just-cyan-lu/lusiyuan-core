import type { FastifyInstance } from "fastify";
import { env } from "../utils/env.js";

export async function channelsRoute(app: FastifyInstance): Promise<void> {
  app.get("/v1/channels/status", async (_request, reply) => {
    return reply.send({
      telegram: {
        enabled: env.TELEGRAM_ENABLED,
        mode: env.TELEGRAM_ENABLED ? env.TELEGRAM_MODE : null,
      },
      weixin: {
        enabled: env.WEIXIN_ENABLED,
        mode: env.WEIXIN_ENABLED ? "openclaw_bridge" : null,
      },
    });
  });
}
