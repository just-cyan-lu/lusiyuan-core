import "dotenv/config";
import { normalizeToolAccessMode } from "../tools/tool-access.js";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalPositiveInt(key: string): number | undefined {
  const val = process.env[key];
  if (!val) return undefined;

  const parsed = parseInt(val, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer environment variable: ${key}`);
  }
  return parsed;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  PORT: parseInt(process.env.PORT ?? "64100", 10),

  // Multi-provider LLM configuration
  // ACTIVE_MODEL_PROVIDER 指定当前使用的提供商，值为配置前缀（如 openai, anthropic, glm, qwen, deepseek, minimax）
  // 例如：ACTIVE_MODEL_PROVIDER=openai 会读取 OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL
  ACTIVE_MODEL_PROVIDER: process.env.ACTIVE_MODEL_PROVIDER ?? "openai",

  // Legacy single-provider config (fallback if ACTIVE_MODEL_PROVIDER not set)
  MODEL_BASE_URL: process.env.MODEL_BASE_URL ?? "",
  MODEL_API_KEY: process.env.MODEL_API_KEY ?? "",
  MODEL_NAME: process.env.MODEL_NAME ?? "",

  // OpenAI
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "",

  // Anthropic (Claude)
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "",

  // GLM (智谱)
  GLM_BASE_URL: process.env.GLM_BASE_URL ?? "",
  GLM_API_KEY: process.env.GLM_API_KEY ?? "",
  GLM_MODEL: process.env.GLM_MODEL ?? "",

  // Qwen (通义千问)
  QWEN_BASE_URL: process.env.QWEN_BASE_URL ?? "",
  QWEN_API_KEY: process.env.QWEN_API_KEY ?? "",
  QWEN_MODEL: process.env.QWEN_MODEL ?? "",

  // DeepSeek
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL ?? "",
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? "",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL ?? "",

  // MiniMax
  MINIMAX_BASE_URL: process.env.MINIMAX_BASE_URL ?? "",
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY ?? "",
  MINIMAX_MODEL: process.env.MINIMAX_MODEL ?? "",
  MINIMAX_THINKING_TYPE: process.env.MINIMAX_THINKING_TYPE ?? "adaptive",
  MINIMAX_REASONING_SPLIT: process.env.MINIMAX_REASONING_SPLIT === "true",
  MINIMAX_MAX_COMPLETION_TOKENS:
    optionalPositiveInt("MINIMAX_MAX_COMPLETION_TOKENS"),

  // SiliconFlow (硅基流动) — unified endpoint for GLM, Qwen, DeepSeek, etc.
  SILICONFLOW_BASE_URL: process.env.SILICONFLOW_BASE_URL ?? "https://api.siliconflow.cn/v1",
  SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY ?? "",
  SILICONFLOW_MODEL: process.env.SILICONFLOW_MODEL ?? "",

  TELEGRAM_ENABLED: process.env.TELEGRAM_ENABLED === "true",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_MODE: process.env.TELEGRAM_MODE ?? "polling",
  TELEGRAM_PROXY: process.env.TELEGRAM_PROXY ?? "",
  TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS: parseInt(
    process.env.TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS ?? "30000",
    10
  ),
  TELEGRAM_FILE_DOWNLOAD_RETRIES: parseInt(
    process.env.TELEGRAM_FILE_DOWNLOAD_RETRIES ?? "2",
    10
  ),
  TELEGRAM_MAX_IMAGE_FILE_BYTES: parseInt(
    process.env.TELEGRAM_MAX_IMAGE_FILE_BYTES ?? String(10 * 1024 * 1024),
    10
  ),

  WEIXIN_ENABLED: process.env.WEIXIN_ENABLED === "true",
  WEIXIN_BRIDGE_SECRET: process.env.WEIXIN_BRIDGE_SECRET ?? "",

  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:64111",

  ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN ?? "",
  ADMIN_DATABASE_CLEAR_PASSWORD: process.env.ADMIN_DATABASE_CLEAR_PASSWORD ?? "",
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
  TOOL_MAX_CALLS_PER_MESSAGE: parseInt(
    process.env.TOOL_MAX_CALLS_PER_MESSAGE ?? "3",
    10
  ),
  TOOL_TIMEOUT_MS: parseInt(process.env.TOOL_TIMEOUT_MS ?? "10000", 10),
  TOOL_LOG_INPUT_OUTPUT: process.env.TOOL_LOG_INPUT_OUTPUT !== "false",
  TOOL_SEARCH_MEMORIES_MODE: normalizeToolAccessMode(
    process.env.TOOL_SEARCH_MEMORIES_MODE,
    "on",
    "TOOL_SEARCH_MEMORIES_MODE"
  ),
  TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE: normalizeToolAccessMode(
    process.env.TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE,
    "on",
    "TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE"
  ),
  TOOL_WEB_SEARCH_MODE: normalizeToolAccessMode(
    process.env.TOOL_WEB_SEARCH_MODE,
    "owner_only",
    "TOOL_WEB_SEARCH_MODE"
  ),
  TOOL_READ_PAGE_MODE: normalizeToolAccessMode(
    process.env.TOOL_READ_PAGE_MODE,
    "owner_only",
    "TOOL_READ_PAGE_MODE"
  ),
  TOOL_SEND_INTERMEDIATE_MESSAGE_MODE: normalizeToolAccessMode(
    process.env.TOOL_SEND_INTERMEDIATE_MESSAGE_MODE,
    "on",
    "TOOL_SEND_INTERMEDIATE_MESSAGE_MODE"
  ),
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
  REFLECTION_PROPOSAL_MIN_CONFIDENCE: parseFloat(
    process.env.REFLECTION_PROPOSAL_MIN_CONFIDENCE ?? "0.7"
  ),
  REFLECTION_PROPOSAL_MAX_PER_RUN: parseInt(
    process.env.REFLECTION_PROPOSAL_MAX_PER_RUN ?? "20",
    10
  ),
  REFLECTION_ENABLE_GROWTH_LOG:
    process.env.REFLECTION_ENABLE_GROWTH_LOG !== "false",

  // Dream Cycle (v0.75)
  DREAM_ENABLED: process.env.DREAM_ENABLED !== "false",
  DREAM_AUTO_RUN: process.env.DREAM_AUTO_RUN === "true",
  DREAM_CRON: process.env.DREAM_CRON ?? "30 3 * * *",
  DREAM_TIMEZONE: process.env.DREAM_TIMEZONE ?? "Asia/Taipei",

  DREAM_DEFAULT_LOOKBACK_HOURS: parseInt(
    process.env.DREAM_DEFAULT_LOOKBACK_HOURS ?? "24",
    10
  ),
  DREAM_MAX_LOOKBACK_DAYS: parseInt(
    process.env.DREAM_MAX_LOOKBACK_DAYS ?? "7",
    10
  ),
  DREAM_MIN_SOURCE_EVENTS: parseInt(
    process.env.DREAM_MIN_SOURCE_EVENTS ?? "5",
    10
  ),

  // Context limits
  DREAM_MAX_MESSAGES: parseInt(process.env.DREAM_MAX_MESSAGES ?? "120", 10),
  DREAM_MAX_TOOL_CALLS: parseInt(process.env.DREAM_MAX_TOOL_CALLS ?? "50", 10),
  DREAM_MAX_REFLECTION_REPORTS: parseInt(
    process.env.DREAM_MAX_REFLECTION_REPORTS ?? "10",
    10
  ),
  DREAM_MAX_MEMORY_PROPOSALS: parseInt(
    process.env.DREAM_MAX_MEMORY_PROPOSALS ?? "30",
    10
  ),

  // Phase toggles
  DREAM_LIGHT_ENABLED: process.env.DREAM_LIGHT_ENABLED !== "false",
  DREAM_REM_ENABLED: process.env.DREAM_REM_ENABLED !== "false",
  DREAM_DEEP_ENABLED: process.env.DREAM_DEEP_ENABLED !== "false",
  DREAM_DIARY_ENABLED: process.env.DREAM_DIARY_ENABLED !== "false",
  DREAM_MORNING_BRIEF_ENABLED:
    process.env.DREAM_MORNING_BRIEF_ENABLED !== "false",

  // Safety
  DREAM_AUTO_APPLY: process.env.DREAM_AUTO_APPLY === "true",
  DREAM_ALLOW_MEMORY_PROPOSALS:
    process.env.DREAM_ALLOW_MEMORY_PROPOSALS !== "false",
  DREAM_ALLOW_GROWTH_LOG_PROPOSALS:
    process.env.DREAM_ALLOW_GROWTH_LOG_PROPOSALS !== "false",

  // Scoring thresholds
  DREAM_MIN_SIGNAL_SCORE: parseFloat(
    process.env.DREAM_MIN_SIGNAL_SCORE ?? "0.72"
  ),
  DREAM_MIN_CONFIDENCE: parseFloat(
    process.env.DREAM_MIN_CONFIDENCE ?? "0.70"
  ),
  DREAM_MIN_EVIDENCE_COUNT: parseInt(
    process.env.DREAM_MIN_EVIDENCE_COUNT ?? "2",
    10
  ),
  DREAM_MAX_PROPOSALS_PER_RUN: parseInt(
    process.env.DREAM_MAX_PROPOSALS_PER_RUN ?? "10",
    10
  ),

  // Diary
  DREAM_DIARY_MAX_CHARS: parseInt(
    process.env.DREAM_DIARY_MAX_CHARS ?? "1200",
    10
  ),
  DREAM_DIARY_VISIBILITY:
    process.env.DREAM_DIARY_VISIBILITY ?? "owner_only",

  // Privacy
  DREAM_REDACT_PRIVATE_DATA:
    process.env.DREAM_REDACT_PRIVATE_DATA !== "false",

  // Lock
  DREAM_LOCK_TTL_MINUTES: parseInt(
    process.env.DREAM_LOCK_TTL_MINUTES ?? "60",
    10
  ),

  // Runtime autonomy
  RUNTIME_AUTONOMY_AUTO_RUN:
    process.env.RUNTIME_AUTONOMY_AUTO_RUN === "true",
  RUNTIME_AUTONOMY_CRON:
    process.env.RUNTIME_AUTONOMY_CRON ?? "*/30 * * * *",
  RUNTIME_AUTONOMY_TIMEZONE:
    process.env.RUNTIME_AUTONOMY_TIMEZONE ?? "Asia/Shanghai",

  // Tavily web search (v0.8.1)
  TAVILY_ENABLED: process.env.TAVILY_ENABLED === "true",
  // Comma-separated list of keys, e.g. "key1,key2,key3"
  TAVILY_API_KEYS: (process.env.TAVILY_API_KEYS ?? process.env.TAVILY_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean),
  TAVILY_MAX_RESULTS: parseInt(process.env.TAVILY_MAX_RESULTS ?? "5", 10),
  TAVILY_SEARCH_DEPTH: process.env.TAVILY_SEARCH_DEPTH ?? "basic",

  // Jina AI Reader (v0.8.1)
  JINA_ENABLED: process.env.JINA_ENABLED !== "false",
  JINA_API_KEY: process.env.JINA_API_KEY ?? "",

  // HTTP proxy for external requests (v0.8.1)
  // Falls back to TELEGRAM_PROXY if not set separately
  EXTERNAL_HTTP_PROXY:
    process.env.EXTERNAL_HTTP_PROXY ??
    process.env.TELEGRAM_PROXY ??
    "",

  // Playwright headless browser (v0.8.1)
  PLAYWRIGHT_ENABLED: process.env.PLAYWRIGHT_ENABLED === "true",
  PLAYWRIGHT_MAX_PAGE_TEXT_CHARS: parseInt(
    process.env.PLAYWRIGHT_MAX_PAGE_TEXT_CHARS ?? "12000",
    10
  ),
  PLAYWRIGHT_SCREENSHOT_ENABLED:
    process.env.PLAYWRIGHT_SCREENSHOT_ENABLED === "true",

  // CDP Browser — connect to user's Chrome (v0.8.1)
  CDP_BROWSER_ENABLED: process.env.CDP_BROWSER_ENABLED === "true",
  CDP_BROWSER_PORT: parseInt(process.env.CDP_BROWSER_PORT ?? "9222", 10),
} as const;
