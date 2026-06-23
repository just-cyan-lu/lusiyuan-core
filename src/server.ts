import "./utils/env.js";
import { buildApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import { env } from "./utils/env.js";
import { runtimeSettingsService } from "./config/runtime-settings.service.js";

let app: ReturnType<typeof buildApp> | null = null;

const start = async () => {
  try {
    await runtimeSettingsService.initialize();
    app = buildApp();
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app?.log.error(err);
    if (!app) console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

process.on("SIGTERM", async () => {
  await app?.close();
  await prisma.$disconnect();
  process.exit(0);
});

void start();
