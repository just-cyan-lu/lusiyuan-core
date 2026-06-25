export type RuntimeSettingType = "boolean" | "integer" | "number" | "string" | "select";

export interface RuntimeSettingDefinition<T extends boolean | number | string = boolean | number | string> {
  group: string;
  label: string;
  type: RuntimeSettingType;
  defaultValue: T;
  options?: readonly string[];
  min?: number;
  max?: number;
  description?: string;
}

export const runtimeSettingDefinitions = {
  ACTIVE_MODEL_PROVIDER: { group: "模型运行", label: "当前模型渠道", type: "select", defaultValue: "openai", options: ["openai", "anthropic", "glm", "qwen", "deepseek", "minimax", "kimi", "siliconflow"], description: "从 .env 已配置的模型渠道中选择，保存后下一次模型调用立即使用。" },
  MINIMAX_THINKING_TYPE: { group: "模型运行", label: "MiniMax Thinking Type", type: "select", defaultValue: "adaptive", options: ["adaptive", "disabled"] },
  MINIMAX_REASONING_SPLIT: { group: "模型运行", label: "MiniMax Reasoning Split", type: "boolean", defaultValue: false },
  MINIMAX_MAX_COMPLETION_TOKENS: { group: "模型运行", label: "MiniMax 最大生成 Token", type: "integer", defaultValue: 0, min: 0, description: "0 表示不额外限制。" },

  MAX_MESSAGE_LENGTH: { group: "聊天限制", label: "单条消息最大长度", type: "integer", defaultValue: 4000, min: 1, max: 100000 },
  REPLY_DELIVERY_MODE: { group: "回复投递", label: "回复投递模式", type: "select", defaultValue: "hybrid", options: ["single", "final_blocks", "hybrid"], description: "single=最终一条；final_blocks=最终自然分条；hybrid=工具即时反应 + 最终自然分条。" },
  REPLY_PROGRESS_DRAFT_ENABLED: { group: "回复投递", label: "正在输入状态", type: "boolean", defaultValue: true, description: "Web SSE 聊天中发送 progress 事件，用来维持正在输入状态；不写入长期对话记录。" },
  REPLY_SEGMENTATION_LLM_ENABLED: { group: "回复投递", label: "LLM 自然分条", type: "boolean", defaultValue: true, description: "开启后会额外调用一次模型决定聊天气泡边界；失败时自动回退到规则分条。" },
  REPLY_SEGMENT_MIN_CHARS: { group: "回复投递", label: "分条最小字符", type: "integer", defaultValue: 36, min: 1, max: 1000 },
  REPLY_SEGMENT_MAX_CHARS: { group: "回复投递", label: "分条最大字符", type: "integer", defaultValue: 180, min: 20, max: 4000 },
  REPLY_SEGMENT_MAX_COUNT: { group: "回复投递", label: "单次最多分条", type: "integer", defaultValue: 4, min: 1, max: 12 },
  REPLY_HUMAN_DELAY_MIN_MS: { group: "回复投递", label: "分条最短停顿", type: "integer", defaultValue: 600, min: 0, max: 30000 },
  REPLY_HUMAN_DELAY_MAX_MS: { group: "回复投递", label: "分条最长停顿", type: "integer", defaultValue: 1600, min: 0, max: 30000 },
  MEMORY_RETRIEVAL_ENABLED: { group: "记忆检索", label: "记忆检索启用", type: "boolean", defaultValue: false },
  MEMORY_SEMANTIC_TOP_K: { group: "记忆检索", label: "语义检索候选数", type: "integer", defaultValue: 30, min: 1, max: 200 },
  MEMORY_FINAL_TOP_K: { group: "记忆检索", label: "最终记忆数量", type: "integer", defaultValue: 8, min: 1, max: 50 },
  MEMORY_MAX_TOTAL_CHARS: { group: "记忆检索", label: "记忆最大总字符", type: "integer", defaultValue: 1200, min: 100, max: 30000 },
  RELATIONSHIP_UPDATE_MODE: { group: "关系状态", label: "关系更新模式", type: "select", defaultValue: "review", options: ["review", "immediate"] },
  RELATIONSHIP_REVIEW_MIN_SIGNALS: { group: "关系状态", label: "关系复盘最少信号", type: "integer", defaultValue: 4, min: 1, max: 100 },

  TOOLS_ENABLED: { group: "工具", label: "工具调用启用", type: "boolean", defaultValue: false },
  TOOLS_AUTO_EXECUTE_LOW_RISK: { group: "工具", label: "低风险工具自动执行", type: "boolean", defaultValue: true },
  TOOLS_ALLOW_MEDIUM_RISK: { group: "工具", label: "允许中风险工具", type: "boolean", defaultValue: false },
  TOOLS_ALLOW_HIGH_RISK: { group: "工具", label: "允许高风险工具", type: "boolean", defaultValue: false },
  TOOL_MAX_CALLS_PER_MESSAGE: { group: "工具", label: "单条消息最大工具调用", type: "integer", defaultValue: 3, min: 1, max: 20 },
  TOOL_TIMEOUT_MS: { group: "工具", label: "工具超时毫秒", type: "integer", defaultValue: 10000, min: 100, max: 300000 },
  TOOL_LOG_INPUT_OUTPUT: { group: "工具", label: "记录工具入参出参", type: "boolean", defaultValue: true },
  TOOL_SEARCH_MEMORIES_MODE: { group: "工具访问", label: "search_memories", type: "select", defaultValue: "on", options: ["off", "owner_only", "on"] },
  TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE: { group: "工具访问", label: "summarize_recent_conversation", type: "select", defaultValue: "on", options: ["off", "owner_only", "on"] },
  TOOL_WEB_SEARCH_MODE: { group: "工具访问", label: "web_search", type: "select", defaultValue: "owner_only", options: ["off", "owner_only", "on"] },
  TOOL_READ_PAGE_MODE: { group: "工具访问", label: "read_page", type: "select", defaultValue: "owner_only", options: ["off", "owner_only", "on"] },
  TOOL_SEND_INTERMEDIATE_MESSAGE_MODE: { group: "工具访问", label: "send_intermediate_message", type: "select", defaultValue: "on", options: ["off", "owner_only", "on"] },

  REFLECTION_ENABLED: { group: "Reflection", label: "Reflection 启用", type: "boolean", defaultValue: true },
  REFLECTION_OWNER_ONLY: { group: "Reflection", label: "仅 Owner 可触发", type: "boolean", defaultValue: true },
  REFLECTION_DEFAULT_MESSAGE_LIMIT: { group: "Reflection", label: "默认消息数", type: "integer", defaultValue: 80, min: 1, max: 1000 },
  REFLECTION_MAX_MESSAGE_LIMIT: { group: "Reflection", label: "最大消息数", type: "integer", defaultValue: 200, min: 1, max: 2000 },
  REFLECTION_MIN_MESSAGES: { group: "Reflection", label: "最少消息数", type: "integer", defaultValue: 10, min: 1, max: 500 },
  REFLECTION_INCLUDE_MEMORIES: { group: "Reflection", label: "包含已有记忆", type: "boolean", defaultValue: true },
  REFLECTION_AUTO_APPLY: { group: "Reflection", label: "自动应用提案", type: "boolean", defaultValue: false },
  REFLECTION_PROPOSAL_MIN_CONFIDENCE: { group: "Reflection", label: "提案最低置信度", type: "number", defaultValue: 0.7, min: 0, max: 1 },
  REFLECTION_PROPOSAL_MAX_PER_RUN: { group: "Reflection", label: "单次最大提案", type: "integer", defaultValue: 20, min: 1, max: 100 },
  REFLECTION_ENABLE_GROWTH_LOG: { group: "Reflection", label: "生成成长记录", type: "boolean", defaultValue: true },

  DREAM_ENABLED: { group: "Dream", label: "Dream 启用", type: "boolean", defaultValue: true },
  DREAM_AUTO_RUN: { group: "Dream", label: "Dream 自动运行", type: "boolean", defaultValue: false },
  DREAM_CRON: { group: "Dream", label: "Dream 运行时间", type: "string", defaultValue: "30 3 * * *", description: "Cron 表达式，保存后立即重排定时任务。" },
  DREAM_TIMEZONE: { group: "Dream", label: "Dream 时区", type: "string", defaultValue: "Asia/Shanghai" },
  DREAM_DEFAULT_LOOKBACK_HOURS: { group: "Dream", label: "默认回看小时", type: "integer", defaultValue: 24, min: 1, max: 720 },
  DREAM_MAX_LOOKBACK_DAYS: { group: "Dream", label: "最大回看天数", type: "integer", defaultValue: 7, min: 1, max: 365 },
  DREAM_MIN_SOURCE_EVENTS: { group: "Dream", label: "最少来源事件", type: "integer", defaultValue: 5, min: 1, max: 1000 },
  DREAM_MAX_MESSAGES: { group: "Dream", label: "最大消息数", type: "integer", defaultValue: 120, min: 1, max: 2000 },
  DREAM_MAX_TOOL_CALLS: { group: "Dream", label: "最大工具调用数", type: "integer", defaultValue: 50, min: 0, max: 1000 },
  DREAM_MAX_REFLECTION_REPORTS: { group: "Dream", label: "最大复盘报告数", type: "integer", defaultValue: 10, min: 0, max: 200 },
  DREAM_MAX_MEMORY_PROPOSALS: { group: "Dream", label: "最大记忆提案数", type: "integer", defaultValue: 30, min: 0, max: 500 },
  DREAM_LIGHT_ENABLED: { group: "Dream", label: "Light 阶段", type: "boolean", defaultValue: true },
  DREAM_REM_ENABLED: { group: "Dream", label: "REM 阶段", type: "boolean", defaultValue: true },
  DREAM_DEEP_ENABLED: { group: "Dream", label: "Deep 阶段", type: "boolean", defaultValue: true },
  DREAM_DIARY_ENABLED: { group: "Dream", label: "Dream Diary", type: "boolean", defaultValue: true },
  DREAM_MORNING_BRIEF_ENABLED: { group: "Dream", label: "Morning Brief", type: "boolean", defaultValue: true },
  DREAM_AUTO_APPLY: { group: "Dream", label: "自动应用提案", type: "boolean", defaultValue: false },
  DREAM_ALLOW_MEMORY_PROPOSALS: { group: "Dream", label: "允许记忆提案", type: "boolean", defaultValue: true },
  DREAM_ALLOW_GROWTH_LOG_PROPOSALS: { group: "Dream", label: "允许成长记录提案", type: "boolean", defaultValue: true },
  DREAM_MIN_SIGNAL_SCORE: { group: "Dream", label: "最低信号分数", type: "number", defaultValue: 0.72, min: 0, max: 1 },
  DREAM_MIN_CONFIDENCE: { group: "Dream", label: "最低置信度", type: "number", defaultValue: 0.7, min: 0, max: 1 },
  DREAM_MIN_EVIDENCE_COUNT: { group: "Dream", label: "最少证据数", type: "integer", defaultValue: 2, min: 1, max: 100 },
  DREAM_MAX_PROPOSALS_PER_RUN: { group: "Dream", label: "单次最大提案", type: "integer", defaultValue: 10, min: 1, max: 100 },
  DREAM_DIARY_MAX_CHARS: { group: "Dream", label: "日记最大字符", type: "integer", defaultValue: 1200, min: 100, max: 30000 },
  DREAM_DIARY_VISIBILITY: { group: "Dream", label: "日记可见范围", type: "select", defaultValue: "owner_only", options: ["owner_only", "private", "internal"] },
  DREAM_REDACT_PRIVATE_DATA: { group: "Dream", label: "隐私脱敏", type: "boolean", defaultValue: true },
  DREAM_LOCK_TTL_MINUTES: { group: "Dream", label: "任务锁分钟", type: "integer", defaultValue: 60, min: 1, max: 1440 },

  RUNTIME_AUTONOMY_AUTO_RUN: { group: "运行态自启动", label: "自动运行", type: "boolean", defaultValue: false },
  RUNTIME_AUTONOMY_CRON: { group: "运行态自启动", label: "运行频率", type: "string", defaultValue: "*/30 * * * *", description: "Cron 表达式，保存后立即重排定时任务。" },
  RUNTIME_AUTONOMY_TIMEZONE: { group: "运行态自启动", label: "时区", type: "string", defaultValue: "Asia/Shanghai" },

  TAVILY_ENABLED: { group: "网页能力", label: "Tavily 搜索启用", type: "boolean", defaultValue: false },
  TAVILY_MAX_RESULTS: { group: "网页能力", label: "Tavily 最大结果", type: "integer", defaultValue: 5, min: 1, max: 20 },
  TAVILY_SEARCH_DEPTH: { group: "网页能力", label: "Tavily 搜索深度", type: "select", defaultValue: "basic", options: ["basic", "advanced"] },
  JINA_ENABLED: { group: "网页能力", label: "Jina Reader", type: "boolean", defaultValue: true },
  PLAYWRIGHT_ENABLED: { group: "网页能力", label: "Playwright Reader", type: "boolean", defaultValue: false },
  PLAYWRIGHT_MAX_PAGE_TEXT_CHARS: { group: "网页能力", label: "网页最大文本字符", type: "integer", defaultValue: 12000, min: 1000, max: 200000 },
  PLAYWRIGHT_SCREENSHOT_ENABLED: { group: "网页能力", label: "Playwright 截图", type: "boolean", defaultValue: false },
  MCP_ENABLED: { group: "Chrome MCP", label: "MCP 总开关", type: "boolean", defaultValue: false },
  CHROME_DEVTOOLS_MCP_ENABLED: { group: "Chrome MCP", label: "Chrome DevTools MCP", type: "boolean", defaultValue: false },
  CHROME_DEVTOOLS_MCP_CONNECTION_MODE: { group: "Chrome MCP", label: "连接方式", type: "select", defaultValue: "auto", options: ["auto", "browser_url"] },
  CHROME_DEVTOOLS_MCP_BROWSER_URL: { group: "Chrome MCP", label: "本地调试地址", type: "string", defaultValue: "http://127.0.0.1:9222" },
  CHROME_DEVTOOLS_MCP_MIN_OPEN_INTERVAL_MS: { group: "Chrome MCP", label: "新开页面最短间隔", type: "integer", defaultValue: 15000, min: 5000, max: 600000 },
  CHROME_DEVTOOLS_MCP_SETTLE_MIN_MS: { group: "Chrome MCP", label: "稳定等待最短时间", type: "integer", defaultValue: 3000, min: 300, max: 60000 },
  CHROME_DEVTOOLS_MCP_SETTLE_MAX_MS: { group: "Chrome MCP", label: "稳定等待最长时间", type: "integer", defaultValue: 5000, min: 300, max: 60000 },
  CHROME_DEVTOOLS_MCP_MAX_COMMENTS: { group: "Chrome MCP", label: "单帖最多评论", type: "integer", defaultValue: 120, min: 1, max: 300 },

  TELEGRAM_ENABLED: { group: "渠道", label: "Telegram 启用", type: "boolean", defaultValue: false, description: "保存后立即启动或停止长轮询。" },
  TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS: { group: "渠道", label: "Telegram 下载超时", type: "integer", defaultValue: 30000, min: 1000, max: 300000 },
  TELEGRAM_FILE_DOWNLOAD_RETRIES: { group: "渠道", label: "Telegram 下载重试", type: "integer", defaultValue: 2, min: 0, max: 20 },
  TELEGRAM_MAX_IMAGE_FILE_BYTES: { group: "渠道", label: "Telegram 图片最大字节", type: "integer", defaultValue: 10485760, min: 1, max: 104857600 },
  WEIXIN_ENABLED: { group: "渠道", label: "微信桥接启用", type: "boolean", defaultValue: false },
} as const satisfies Record<string, RuntimeSettingDefinition>;

export type RuntimeSettingKey = keyof typeof runtimeSettingDefinitions;

type ValueForDefinition<D> =
  D extends { type: "boolean" } ? boolean :
  D extends { type: "integer" | "number" } ? number :
  D extends { options: readonly (infer O)[] } ? O :
  string;
export type RuntimeSettingValues = {
  [K in RuntimeSettingKey]: ValueForDefinition<(typeof runtimeSettingDefinitions)[K]>;
};

export function isRuntimeSettingKey(value: string): value is RuntimeSettingKey {
  return Object.prototype.hasOwnProperty.call(runtimeSettingDefinitions, value);
}
