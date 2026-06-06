import type { FastifyInstance } from "fastify";
import { env } from "../utils/env.js";
import { requireAdminAuth } from "./admin-auth.js";

function configured(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

export async function adminRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  app.get("/v1/admin/runtime", async (_request, reply) => {
    const providers = [
      {
        name: "openai",
        label: "OpenAI",
        active: env.ACTIVE_MODEL_PROVIDER === "openai",
        baseUrlConfigured: configured(env.OPENAI_BASE_URL),
        apiKeyConfigured: configured(env.OPENAI_API_KEY),
        model: env.OPENAI_MODEL || null,
      },
      {
        name: "anthropic",
        label: "Anthropic",
        active: env.ACTIVE_MODEL_PROVIDER === "anthropic",
        baseUrlConfigured: configured(env.ANTHROPIC_BASE_URL),
        apiKeyConfigured: configured(env.ANTHROPIC_API_KEY),
        model: env.ANTHROPIC_MODEL || null,
      },
      {
        name: "glm",
        label: "GLM",
        active: env.ACTIVE_MODEL_PROVIDER === "glm",
        baseUrlConfigured: configured(env.GLM_BASE_URL),
        apiKeyConfigured: configured(env.GLM_API_KEY),
        model: env.GLM_MODEL || null,
      },
      {
        name: "qwen",
        label: "Qwen",
        active: env.ACTIVE_MODEL_PROVIDER === "qwen",
        baseUrlConfigured: configured(env.QWEN_BASE_URL),
        apiKeyConfigured: configured(env.QWEN_API_KEY),
        model: env.QWEN_MODEL || null,
      },
      {
        name: "deepseek",
        label: "DeepSeek",
        active: env.ACTIVE_MODEL_PROVIDER === "deepseek",
        baseUrlConfigured: configured(env.DEEPSEEK_BASE_URL),
        apiKeyConfigured: configured(env.DEEPSEEK_API_KEY),
        model: env.DEEPSEEK_MODEL || null,
      },
      {
        name: "minimax",
        label: "MiniMax",
        active: env.ACTIVE_MODEL_PROVIDER === "minimax",
        baseUrlConfigured: configured(env.MINIMAX_BASE_URL),
        apiKeyConfigured: configured(env.MINIMAX_API_KEY),
        model: env.MINIMAX_MODEL || null,
      },
      {
        name: "siliconflow",
        label: "SiliconFlow",
        active: env.ACTIVE_MODEL_PROVIDER === "siliconflow",
        baseUrlConfigured: configured(env.SILICONFLOW_BASE_URL),
        apiKeyConfigured: configured(env.SILICONFLOW_API_KEY),
        model: env.SILICONFLOW_MODEL || null,
      },
    ];

    return reply.send({
      activeModelProvider: env.ACTIVE_MODEL_PROVIDER,
      providers,
      channels: {
        telegram: {
          enabled: env.TELEGRAM_ENABLED,
          mode: env.TELEGRAM_ENABLED ? env.TELEGRAM_MODE : null,
          tokenConfigured: configured(env.TELEGRAM_BOT_TOKEN),
          proxyConfigured: configured(env.TELEGRAM_PROXY || env.EXTERNAL_HTTP_PROXY),
        },
        weixin: {
          enabled: env.WEIXIN_ENABLED,
          mode: env.WEIXIN_ENABLED ? "openclaw_bridge" : null,
          secretConfigured: configured(env.WEIXIN_BRIDGE_SECRET),
        },
      },
      features: {
        memoryRetrieval: env.MEMORY_RETRIEVAL_ENABLED,
        tools: env.TOOLS_ENABLED,
        drafts: env.DRAFTS_ENABLED,
        reflection: env.REFLECTION_ENABLED,
        dream: env.DREAM_ENABLED,
        dreamAutoRun: env.DREAM_AUTO_RUN,
        externalInbox: env.EXTERNAL_INBOX_ENABLED,
        webSearch: env.TAVILY_ENABLED,
        pageReader: env.JINA_ENABLED || env.PLAYWRIGHT_ENABLED || env.CDP_BROWSER_ENABLED,
        mcp: env.MCP_ENABLED,
      },
      safety: {
        reflectionAutoApply: env.REFLECTION_AUTO_APPLY,
        dreamAutoApply: env.DREAM_AUTO_APPLY,
        toolsAllowMediumRisk: env.TOOLS_ALLOW_MEDIUM_RISK,
        toolsAllowHighRisk: env.TOOLS_ALLOW_HIGH_RISK,
      },
      limits: {
        maxMessageLength: env.MAX_MESSAGE_LENGTH,
        toolMaxCallsPerMessage: env.TOOL_MAX_CALLS_PER_MESSAGE,
        reflectionDefaultMessageLimit: env.REFLECTION_DEFAULT_MESSAGE_LIMIT,
        reflectionMaxMessageLimit: env.REFLECTION_MAX_MESSAGE_LIMIT,
        dreamDefaultLookbackHours: env.DREAM_DEFAULT_LOOKBACK_HOURS,
        dreamMaxLookbackDays: env.DREAM_MAX_LOOKBACK_DAYS,
      },
    });
  });
}
