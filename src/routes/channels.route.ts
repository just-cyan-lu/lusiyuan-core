import type { FastifyInstance } from "fastify";
import { env } from "../utils/env.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";

export async function channelsRoute(app: FastifyInstance): Promise<void> {
  app.get("/v1/channels/status", async (_request, reply) => {
    return reply.send({
      telegram: {
        enabled: runtimeConfig.TELEGRAM_ENABLED,
        mode: runtimeConfig.TELEGRAM_ENABLED ? env.TELEGRAM_MODE : null,
      },
      weixin: {
        enabled: runtimeConfig.WEIXIN_ENABLED,
        mode: runtimeConfig.WEIXIN_ENABLED ? "openclaw_bridge" : null,
      },
    });
  });
}
