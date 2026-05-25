import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  PORT: parseInt(process.env.PORT ?? "64100", 10),
  MODEL_BASE_URL: requireEnv("MODEL_BASE_URL"),
  MODEL_API_KEY: requireEnv("MODEL_API_KEY"),
  MODEL_NAME: requireEnv("MODEL_NAME"),
  MEMORY_EXTRACTION_MODEL_NAME:
    process.env.MEMORY_EXTRACTION_MODEL_NAME ??
    process.env.MODEL_NAME ??
    "gpt-4.1-mini",

  TELEGRAM_ENABLED: process.env.TELEGRAM_ENABLED === "true",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_MODE: process.env.TELEGRAM_MODE ?? "polling",
  TELEGRAM_PROXY: process.env.TELEGRAM_PROXY ?? "",

  WEIXIN_ENABLED: process.env.WEIXIN_ENABLED === "true",
  WEIXIN_BRIDGE_SECRET: process.env.WEIXIN_BRIDGE_SECRET ?? "",

  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:64111",

  OWNER_USER_IDS: (process.env.OWNER_USER_IDS ?? "").split(",").filter(Boolean),
  MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH ?? "4000", 10),
} as const;
