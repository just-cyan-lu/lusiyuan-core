import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health.route.js";
import { chatRoute } from "./routes/chat.route.js";
import { channelsRoute } from "./routes/channels.route.js";
import { weixinRoute } from "./channels/weixin/weixin.route.js";
import { env } from "./utils/env.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty" }
          : undefined,
    },
  });

  void app.register(cors, {
    origin: env.WEB_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    app.log.error(error);
    void reply.status(error.statusCode ?? 500).send({
      error: error.message,
    });
  });

  void app.register(healthRoute);
  void app.register(chatRoute);
  void app.register(channelsRoute);
  void app.register(weixinRoute);

  return app;
}
