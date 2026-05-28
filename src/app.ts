import "./init.js"; // Initialize app (register tools, etc.)
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health.route.js";
import { chatRoute } from "./routes/chat.route.js";
import { channelsRoute } from "./routes/channels.route.js";
import { weixinRoute } from "./channels/weixin/weixin.route.js";
import { toolsRoute } from "./routes/tools.route.js";
import { draftsRoute } from "./routes/drafts.route.js";
import { reflectionRoute } from "./routes/reflection.route.js";
import { dreamRoute } from "./routes/dream.route.js";
import { webSearchRoute } from "./routes/web-search.route.js";
import { pageReaderRoute } from "./routes/page-reader.route.js";
import { externalInboxRoute } from "./routes/external-inbox.route.js";
import { env } from "./utils/env.js";
import { createTelegramBot } from "./channels/telegram/telegram.bot.js";
import { startDreamScheduler } from "./dream/dream-scheduler.js";

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
  void app.register(toolsRoute);
  void app.register(draftsRoute);
  void app.register(reflectionRoute);
  void app.register(dreamRoute);
  void app.register(webSearchRoute);
  void app.register(pageReaderRoute);
  void app.register(externalInboxRoute);

  // Start Telegram bot if enabled
  if (env.TELEGRAM_ENABLED) {
    if (!env.TELEGRAM_BOT_TOKEN) {
      app.log.error("TELEGRAM_ENABLED is true but TELEGRAM_BOT_TOKEN is not set");
    } else {
      app.log.info("Starting Telegram bot...");
      const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);

      bot.catch((err) => {
        app.log.error("Telegram bot error:", err);
      });

      bot
        .start({
          onStart: (info) => {
            app.log.info(`Telegram bot @${info.username} started (long polling)`);
          },
        })
        .catch((err) => {
          app.log.error("Failed to start Telegram bot:", err);
        });
    }
  }

  // Start Dream Cycle scheduler if enabled
  startDreamScheduler(app.log);

  return app;
}
