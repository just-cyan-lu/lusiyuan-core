import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  // Process bootstrap. These values must exist before the database settings can load.
  DATABASE_URL: requireEnv("DATABASE_URL"),
  PORT: parseInt(process.env.PORT ?? "64100", 10),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:64111",

  // Admin and identity security. Never store these in the application database.
  ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN ?? "",
  ADMIN_DATABASE_CLEAR_PASSWORD: process.env.ADMIN_DATABASE_CLEAR_PASSWORD ?? "",
  OWNER_USER_IDS: (process.env.OWNER_USER_IDS ?? "").split(",").filter(Boolean),

  // Legacy single-provider connection.
  MODEL_BASE_URL: process.env.MODEL_BASE_URL ?? "",
  MODEL_API_KEY: process.env.MODEL_API_KEY ?? "",
  MODEL_NAME: process.env.MODEL_NAME ?? "",

  // Model connection profiles. The active profile is selected by live settings.
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "",
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "",
  GLM_BASE_URL: process.env.GLM_BASE_URL ?? "",
  GLM_API_KEY: process.env.GLM_API_KEY ?? "",
  GLM_MODEL: process.env.GLM_MODEL ?? "",
  QWEN_BASE_URL: process.env.QWEN_BASE_URL ?? "",
  QWEN_API_KEY: process.env.QWEN_API_KEY ?? "",
  QWEN_MODEL: process.env.QWEN_MODEL ?? "",
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL ?? "",
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? "",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL ?? "",
  MINIMAX_BASE_URL: process.env.MINIMAX_BASE_URL ?? "",
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY ?? "",
  MINIMAX_MODEL: process.env.MINIMAX_MODEL ?? "",
  KIMI_BASE_URL:
    process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1",
  KIMI_API_KEY: process.env.KIMI_API_KEY ?? "",
  KIMI_MODEL: process.env.KIMI_MODEL ?? "",
  SILICONFLOW_BASE_URL:
    process.env.SILICONFLOW_BASE_URL ?? "https://api.siliconflow.cn/v1",
  SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY ?? "",
  SILICONFLOW_MODEL: process.env.SILICONFLOW_MODEL ?? "",

  // Embedding connection and index shape.
  EMBEDDING_BASE_URL:
    process.env.EMBEDDING_BASE_URL ?? "https://api.siliconflow.cn/v1",
  EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY ?? "",
  EMBEDDING_MODEL:
    process.env.EMBEDDING_MODEL ?? "Qwen/Qwen3-Embedding-4B",
  EMBEDDING_DIMENSIONS: parseInt(process.env.EMBEDDING_DIMENSIONS ?? "1024", 10),

  // Channel credentials and network connections.
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_MODE: process.env.TELEGRAM_MODE ?? "polling",
  TELEGRAM_PROXY: process.env.TELEGRAM_PROXY ?? "",
  WEIXIN_BRIDGE_SECRET: process.env.WEIXIN_BRIDGE_SECRET ?? "",
  EXTERNAL_HTTP_PROXY:
    process.env.EXTERNAL_HTTP_PROXY ?? process.env.TELEGRAM_PROXY ?? "",

  // Search/reader credentials. Enable switches and limits are live settings.
  TAVILY_API_KEYS: (process.env.TAVILY_API_KEYS ?? process.env.TAVILY_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean),
  JINA_API_KEY: process.env.JINA_API_KEY ?? "",
} as const;
