import "./init.js"; // Initialize app (register tools, etc.)
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { healthRoute } from "./routes/health.route.js";
import { chatRoute } from "./routes/chat.route.js";
import { channelsRoute } from "./routes/channels.route.js";
import { weixinRoute } from "./channels/weixin/weixin.route.js";
import { toolsRoute } from "./routes/tools.route.js";
import { dreamRoute } from "./routes/dream.route.js";
import { adminRoute } from "./routes/admin.route.js";
import { webSearchRoute } from "./routes/web-search.route.js";
import { pageReaderRoute } from "./routes/page-reader.route.js";
import { env } from "./utils/env.js";
import { runtimeSettingsService } from "./config/runtime-settings.service.js";
import type { RuntimeSettingKey } from "./config/runtime-settings.registry.js";
import { telegramRuntime } from "./channels/telegram/telegram-runtime.js";
import { reconfigureDreamScheduler, startDreamScheduler, stopDreamScheduler } from "./dream/dream-scheduler.js";
import {
  reconfigureRuntimeAutonomyScheduler,
  startRuntimeAutonomyScheduler,
  stopRuntimeAutonomyScheduler,
} from "./runtime/runtime-autonomy-scheduler.js";
import { chromeDevtoolsMcpService } from "./mcp/chrome-devtools-mcp.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    origin: true, // env.WEB_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
  void app.register(dreamRoute);
  void app.register(adminRoute);
  void app.register(webSearchRoute);
  void app.register(pageReaderRoute);

  // Serve web frontend (production build)
  const webDistPath = path.join(__dirname, "../web/dist");
  void app.register(fastifyStatic, {
    root: webDistPath,
    prefix: "/",
  });

  // Fallback to index.html for SPA routing
  app.setNotFoundHandler((_request, reply) => {
    void reply.sendFile("index.html");
  });

  void telegramRuntime.reconfigure(app.log);

  // Start Dream Cycle scheduler if enabled
  startDreamScheduler(app.log);

  // Start runtime autonomy scheduler if enabled
  startRuntimeAutonomyScheduler(app.log);

  const dreamKeys = new Set<RuntimeSettingKey>([
    "DREAM_ENABLED", "DREAM_CRON",
  ]);
  const autonomyKeys = new Set<RuntimeSettingKey>([
    "RUNTIME_AUTONOMY_AUTO_RUN", "RUNTIME_AUTONOMY_CRON",
  ]);
  const mcpKeys = new Set<RuntimeSettingKey>([
    "MCP_ENABLED", "CHROME_DEVTOOLS_MCP_ENABLED", "CHROME_DEVTOOLS_MCP_CONNECTION_MODE",
    "CHROME_DEVTOOLS_MCP_BROWSER_URL",
  ]);
  const unsubscribe = runtimeSettingsService.subscribe(async (keys) => {
    if (keys.some((key) => dreamKeys.has(key))) reconfigureDreamScheduler(app.log);
    if (keys.some((key) => autonomyKeys.has(key))) reconfigureRuntimeAutonomyScheduler(app.log);
    if (keys.includes("TELEGRAM_ENABLED")) await telegramRuntime.reconfigure(app.log);
    if (keys.some((key) => mcpKeys.has(key))) await chromeDevtoolsMcpService.resetConnection();
  });

  app.addHook("onClose", async () => {
    unsubscribe();
    stopDreamScheduler();
    stopRuntimeAutonomyScheduler();
    await telegramRuntime.stop();
    await chromeDevtoolsMcpService.resetConnection();
  });

  return app;
}
