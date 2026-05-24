import "./utils/env.js";
import { buildApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import { env } from "./utils/env.js";

const app = buildApp();

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

process.on("SIGTERM", async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

void start();
