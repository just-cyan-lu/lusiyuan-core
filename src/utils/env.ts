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

  // Embedding
  EMBEDDING_BASE_URL:
    process.env.EMBEDDING_BASE_URL ?? "https://api.siliconflow.cn/v1",
  EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY ?? "",
  EMBEDDING_MODEL:
    process.env.EMBEDDING_MODEL ?? "Qwen/Qwen3-Embedding-4B",
  EMBEDDING_DIMENSIONS: parseInt(
    process.env.EMBEDDING_DIMENSIONS ?? "1024",
    10
  ),

  // Memory retrieval
  MEMORY_RETRIEVAL_ENABLED:
    process.env.MEMORY_RETRIEVAL_ENABLED === "true",
  MEMORY_SEMANTIC_TOP_K: parseInt(
    process.env.MEMORY_SEMANTIC_TOP_K ?? "30",
    10
  ),
  MEMORY_FINAL_TOP_K: parseInt(process.env.MEMORY_FINAL_TOP_K ?? "8", 10),
  MEMORY_MAX_TOTAL_CHARS: parseInt(
    process.env.MEMORY_MAX_TOTAL_CHARS ?? "1200",
    10
  ),
  MEMORY_VECTOR_INDEX_PROVIDER:
    process.env.MEMORY_VECTOR_INDEX_PROVIDER ?? "pgvector",

  // Tools
  TOOLS_ENABLED: process.env.TOOLS_ENABLED === "true",
  TOOLS_AUTO_EXECUTE_LOW_RISK:
    process.env.TOOLS_AUTO_EXECUTE_LOW_RISK !== "false",
  TOOLS_ALLOW_MEDIUM_RISK: process.env.TOOLS_ALLOW_MEDIUM_RISK === "true",
  TOOLS_ALLOW_HIGH_RISK: process.env.TOOLS_ALLOW_HIGH_RISK === "true",
  DRAFTS_ENABLED: process.env.DRAFTS_ENABLED !== "false",
  TOOL_MAX_CALLS_PER_MESSAGE: parseInt(
    process.env.TOOL_MAX_CALLS_PER_MESSAGE ?? "3",
    10
  ),
  TOOL_TIMEOUT_MS: parseInt(process.env.TOOL_TIMEOUT_MS ?? "10000", 10),
  TOOL_LOG_INPUT_OUTPUT: process.env.TOOL_LOG_INPUT_OUTPUT !== "false",
  MCP_ENABLED: process.env.MCP_ENABLED === "true",

  // Reflection Agent (v0.7)
  REFLECTION_ENABLED: process.env.REFLECTION_ENABLED !== "false",
  REFLECTION_OWNER_ONLY: process.env.REFLECTION_OWNER_ONLY !== "false",
  REFLECTION_DEFAULT_MESSAGE_LIMIT: parseInt(
    process.env.REFLECTION_DEFAULT_MESSAGE_LIMIT ?? "80",
    10
  ),
  REFLECTION_MAX_MESSAGE_LIMIT: parseInt(
    process.env.REFLECTION_MAX_MESSAGE_LIMIT ?? "200",
    10
  ),
  REFLECTION_MIN_MESSAGES: parseInt(
    process.env.REFLECTION_MIN_MESSAGES ?? "10",
    10
  ),
  REFLECTION_INCLUDE_MEMORIES: process.env.REFLECTION_INCLUDE_MEMORIES !== "false",
  REFLECTION_AUTO_APPLY: process.env.REFLECTION_AUTO_APPLY === "true",
  REFLECTION_ALLOW_MEMORY_CREATE_PROPOSALS:
    process.env.REFLECTION_ALLOW_MEMORY_CREATE_PROPOSALS !== "false",
  REFLECTION_ALLOW_MEMORY_UPDATE_PROPOSALS:
    process.env.REFLECTION_ALLOW_MEMORY_UPDATE_PROPOSALS !== "false",
  REFLECTION_ALLOW_MEMORY_SUPERSEDE_PROPOSALS:
    process.env.REFLECTION_ALLOW_MEMORY_SUPERSEDE_PROPOSALS !== "false",
  REFLECTION_PROPOSAL_MIN_CONFIDENCE: parseFloat(
    process.env.REFLECTION_PROPOSAL_MIN_CONFIDENCE ?? "0.7"
  ),
  REFLECTION_PROPOSAL_MAX_PER_RUN: parseInt(
    process.env.REFLECTION_PROPOSAL_MAX_PER_RUN ?? "20",
    10
  ),
  REFLECTION_ENABLE_GROWTH_LOG:
    process.env.REFLECTION_ENABLE_GROWTH_LOG !== "false",
} as const;
