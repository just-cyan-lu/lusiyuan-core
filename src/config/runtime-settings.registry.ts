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
  DEFAULT_MODEL_PROVIDER: { group: "模型路由", label: "通用模型渠道", type: "select", defaultValue: "openai", options: ["openai", "anthropic", "glm", "qwen", "deepseek", "minimax", "kimi", "siliconflow", "custom"], description: "没有专属分配的内部能力（例如工具技能、摘要和自主任务）使用这个模型渠道。" },
  CHAT_MODEL_PROVIDER: { group: "模型路由", label: "聊天模型渠道", type: "select", defaultValue: "openai", options: ["openai", "anthropic", "glm", "qwen", "deepseek", "minimax", "kimi", "siliconflow", "custom"], description: "用户聊天和聊天工具调用使用这个模型渠道；切换后下一轮聊天立即生效。" },
  DREAM_MODEL_PROVIDER: { group: "模型路由", label: "Dream 模型渠道", type: "select", defaultValue: "openai", options: ["openai", "anthropic", "glm", "qwen", "deepseek", "minimax", "kimi", "siliconflow", "custom"], description: "Daily Note、信号提取、梦境日记、记忆整理和关系复盘使用这个模型渠道。" },
  EXPRESSION_LEARNING_MODEL_PROVIDER: { group: "模型路由", label: "表达学习模型渠道", type: "select", defaultValue: "openai", options: ["openai", "anthropic", "glm", "qwen", "deepseek", "minimax", "kimi", "siliconflow", "custom"], description: "表达学习的分析、规则提炼、练习出题和草稿生成使用这个模型渠道。" },
  MINIMAX_THINKING_TYPE: { group: "模型运行", label: "MiniMax Thinking Type", type: "select", defaultValue: "adaptive", options: ["adaptive", "disabled"], description: "MiniMax-M3 专用：adaptive=按需思考，disabled=关闭思考。" },
  MINIMAX_MAX_COMPLETION_TOKENS: { group: "模型运行", label: "MiniMax 最大生成 Token", type: "integer", defaultValue: 0, min: 0, description: "0 表示不额外限制。" },

  CHAT_CONTEXT_MAX_CHARS: { group: "聊天上下文", label: "聊天上下文总字符", type: "integer", defaultValue: 200000, min: 1000, max: 1000000, description: "普通聊天可放入的历史上下文总预算；包含最近原文、旧摘要和召回原文。最大可设 1000000。" },
  CHAT_CONTEXT_RECENT_MAX_CHARS: { group: "聊天上下文", label: "最近原文热区字符", type: "integer", defaultValue: 24000, min: 1000, max: 1000000, description: "每次聊天直接保留最近原文的字符预算；越大越能延续细节，也越容易带入噪声。" },
  CHAT_CONTEXT_SUMMARY_MAX_CHARS: { group: "聊天上下文", label: "旧对话摘要字符", type: "integer", defaultValue: 12000, min: 0, max: 200000, description: "较早对话 compact 摘要最多放入多少字符；0 表示不放摘要。" },
  CHAT_CONTEXT_COMPACT_ENABLED: { group: "聊天上下文", label: "旧对话自动压缩", type: "boolean", defaultValue: true, description: "回复完成后后台把热区之外的旧聊天压缩成可审计摘要，供后续上下文使用。" },
  CHAT_CONTEXT_RECALL_ENABLED: { group: "聊天上下文", label: "旧原文向量召回", type: "boolean", defaultValue: false, description: "按当前问题从历史消息 embedding 中召回相关原文窗口；需要 Embedding 连接可用。" },
  CHAT_CONTEXT_RECALL_MAX_CHARS: { group: "聊天上下文", label: "召回原文窗口字符", type: "integer", defaultValue: 12000, min: 0, max: 200000, description: "向量召回的旧对话原文最多放入多少字符；0 表示不放召回窗口。" },
  REPLY_DELIVERY_MODE: { group: "回复投递", label: "回复投递模式", type: "select", defaultValue: "hybrid", options: ["single", "final_blocks", "hybrid"], description: "single=最终一条；final_blocks=只把最终回复自然分条；hybrid=final_blocks+使用工具等待提示" },
  REPLY_SEGMENTATION_LLM_ENABLED: { group: "回复投递", label: "LLM 自然分条", type: "boolean", defaultValue: true, description: "只影响 final_blocks/hybrid 的最终回复分条；开启会多一次模型判断，失败时回退到规则分条。" },
  REPLY_HUMAN_DELAY_MIN_MS: { group: "回复投递", label: "分条最短停顿", type: "integer", defaultValue: 600, min: 0, max: 30000, description: "多条气泡之间的最短等待时间，单位毫秒。" },
  REPLY_HUMAN_DELAY_MAX_MS: { group: "回复投递", label: "分条最长停顿", type: "integer", defaultValue: 1600, min: 0, max: 30000, description: "多条气泡之间的最长等待时间，单位毫秒。" },

  VOICE_TTS_ENABLED: { group: "语音", label: "TTS 启用", type: "boolean", defaultValue: true, description: "开启后 Web Chat 可以为思源文字回复生成和播放 MiniMax 语音。" },
  VOICE_TTS_PROVIDER: { group: "语音", label: "TTS Provider", type: "select", defaultValue: "minimax", options: ["minimax"], description: "当前只支持 MiniMax。" },
  VOICE_TTS_WS_ENDPOINT: { group: "语音", label: "MiniMax TTS WebSocket", type: "string", defaultValue: "wss://api.minimaxi.com/ws/v1/t2a_v2", description: "MiniMax T2A WebSocket endpoint。应和 MINIMAX_BASE_URL 使用同一域名体系。" },
  VOICE_TTS_MODEL: { group: "语音", label: "TTS 模型", type: "select", defaultValue: "speech-2.8-turbo", options: ["speech-2.8-turbo", "speech-2.8-hd", "speech-2.6-turbo", "speech-2.6-hd", "speech-02-turbo", "speech-02-hd", "speech-01-turbo", "speech-01-hd"], description: "聊天语音优先使用 turbo；更追求质感时可改 hd。" },
  VOICE_TTS_VOICE_ID: { group: "语音", label: "思源音色 ID", type: "string", defaultValue: "male-qn-qingse", description: "MiniMax voice_id。之后选定正式思源音色后在这里替换。" },
  VOICE_TTS_LANGUAGE_BOOST: { group: "语音", label: "TTS 语言增强", type: "select", defaultValue: "Chinese", options: ["auto", "Chinese", "Chinese,Yue", "English", "Japanese", "Korean"], description: "语音合成语言提示。普通中文聊天用 Chinese。" },
  VOICE_TTS_SPEED: { group: "语音", label: "TTS 语速", type: "number", defaultValue: 1, min: 0.5, max: 2, description: "MiniMax voice_setting.speed。" },
  VOICE_TTS_VOL: { group: "语音", label: "TTS 音量", type: "number", defaultValue: 1, min: 0.1, max: 2, description: "MiniMax voice_setting.vol。" },
  VOICE_TTS_PITCH: { group: "语音", label: "TTS 音高", type: "integer", defaultValue: 0, min: -12, max: 12, description: "MiniMax voice_setting.pitch。" },
  VOICE_TTS_SAMPLE_RATE: { group: "语音", label: "TTS 采样率", type: "integer", defaultValue: 32000, min: 8000, max: 48000, description: "MiniMax audio_setting.sample_rate。" },
  VOICE_TTS_BITRATE: { group: "语音", label: "TTS 比特率", type: "integer", defaultValue: 128000, min: 32000, max: 320000, description: "MiniMax audio_setting.bitrate。" },
  VOICE_TTS_FORMAT: { group: "语音", label: "TTS 格式", type: "select", defaultValue: "mp3", options: ["mp3"], description: "Web 流式播放先固定 mp3。" },
  VOICE_CACHE_RETENTION_DAYS: { group: "语音", label: "语音缓存保留天数", type: "integer", defaultValue: 7, min: 1, max: 90, description: "按 lastPlayedAt 保留。超过天数未播放会删除音频文件和缓存记录。" },
  VOICE_AUTOPLAY_FINAL_ONLY: { group: "语音", label: "只自动播放最终回复", type: "boolean", defaultValue: true, description: "开启后只朗读最终回复；等待态和进度气泡不朗读。" },
  VOICE_ASR_ENABLED: { group: "语音", label: "ASR 启用", type: "boolean", defaultValue: true, description: "开启 Web Chat 语音电话的浏览器语音识别。" },
  VOICE_ASR_PROVIDER: { group: "语音", label: "ASR Provider", type: "select", defaultValue: "browser", options: ["browser"], description: "当前使用浏览器 Web Speech API，不上传录音到后端。" },
  VOICE_ASR_LANGUAGE: { group: "语音", label: "ASR 语言", type: "string", defaultValue: "zh-CN", description: "传给浏览器 SpeechRecognition.lang 的语言提示。" },
  VOICE_ASR_MAX_DURATION_SECONDS: { group: "语音", label: "ASR 单段最长秒数", type: "integer", defaultValue: 60, min: 3, max: 600, description: "前端语音电话单次收音达到该时长后自动结束并发送。" },
  VOICE_ASR_AUTO_SILENCE_MS: { group: "语音", label: "自动通话停顿阈值", type: "integer", defaultValue: 1200, min: 300, max: 5000, description: "自动语音通话中，识别到停顿后等待多久自动发送当前这句话，单位毫秒。" },

  MEMORY_RETRIEVAL_ENABLED: { group: "记忆检索", label: "记忆检索启用", type: "boolean", defaultValue: false, description: "开启后，聊天会按当前内容检索相关记忆；身份档案不走这里。" },
  MEMORY_FINAL_TOP_K: { group: "记忆检索", label: "最终记忆数量", type: "integer", defaultValue: 12, min: 1, max: 50, description: "最终最多放进上下文的相关记忆条数；候选召回和上下文预算由系统内部处理。" },
  TOOL_CALL_LOG_ENABLED: { group: "工具", label: "记录工具调用轨迹", type: "boolean", defaultValue: true, description: "开启后只记录工具是否被调用、状态、耗时、用户/会话、错误或阻断原因，不保存工具入参和出参；适合调试和还原工具轨迹。关闭后不写 tool_call_logs。" },
  TOOL_SEARCH_MEMORIES_MODE: { group: "工具访问", label: "search_memories", type: "select", defaultValue: "on", options: ["off", "owner_only", "on"], description: "控制模型能否主动检索长期记忆；on=所有用户可用，owner_only=仅 Owner，可用于减少普通用户触发记忆检索。" },
  TOOL_WEB_SEARCH_MODE: { group: "工具访问", label: "web_search", type: "select", defaultValue: "owner_only", options: ["off", "owner_only", "on"], description: "控制模型能否用 Tavily 搜索网页；还需要 TAVILY_ENABLED 和 API Key 可用。" },
  TOOL_READ_PAGE_MODE: { group: "工具访问", label: "read_page", type: "select", defaultValue: "owner_only", options: ["off", "owner_only", "on"], description: "控制模型能否读取指定网页正文；还需要 Jina、Playwright 或 Chrome MCP 至少一个读取器启用。" },
  HOME_ASSISTANT_ENABLED: { group: "智能家居", label: "Home Assistant 启用", type: "boolean", defaultValue: false, description: "开启后 Owner 可以通过聊天查询和控制 Home Assistant；还需要在环境变量中配置地址和 Token。" },
  HOME_ASSISTANT_ALLOWED_DOMAINS: { group: "智能家居", label: "允许控制的 HA domain", type: "string", defaultValue: "light,switch,climate,cover,media_player,scene,script", description: "逗号分隔的 Home Assistant domain；填写 * 表示不限制。" },
  HOME_ASSISTANT_MAX_CALLS_PER_TURN: { group: "智能家居", label: "单条消息 HA 调用上限", type: "integer", defaultValue: 3, min: 1, max: 20, description: "只限制智能家居工具；超过后不再向 Home Assistant 发请求。" },
  HOME_ASSISTANT_MAX_MUTATIONS_PER_TURN: { group: "智能家居", label: "单条消息 HA 变更上限", type: "integer", defaultValue: 2, min: 1, max: 20, description: "只限制智能家居状态变更；不改变全局工具循环。" },

  EXPRESSION_LEARNING_AUTO_PRACTICE_ENABLED: { group: "表达学习", label: "自动出题启用", type: "boolean", defaultValue: false, description: "开启后按 cron 自动生成表达学习习题，生成后进入习题库待处理。" },
  EXPRESSION_LEARNING_AUTO_PRACTICE_CRON: { group: "表达学习", label: "自动出题时间", type: "string", defaultValue: "0 9 * * *", description: "Cron 表达式，使用服务器本地时间。" },
  EXPRESSION_LEARNING_AUTO_PRACTICE_COUNT: { group: "表达学习", label: "每次出题数量", type: "integer", defaultValue: 3, min: 1, max: 20, description: "每次自动任务生成多少道题。" },
  EXPRESSION_LEARNING_AUTO_PRACTICE_SCENE: { group: "表达学习", label: "自动出题场景", type: "select", defaultValue: "general", options: ["general", "chat", "reply"], description: "自动出题使用的场景：general=通用，chat=私聊，reply=公开评论回复。" },
  EXPRESSION_LEARNING_AUTO_PRACTICE_FOCUS: { group: "表达学习", label: "自动出题方向", type: "string", defaultValue: "", description: "可选，例如：拒绝、安抚、评论区回复、边界感。留空则让系统自由出题。" },

  DREAM_ENABLED: { group: "Dream", label: "Dream 启用", type: "boolean", defaultValue: true, description: "Dream 总开关；开启后按 DREAM_CRON 自动整理，关闭后手动和定时 Dream 都不运行。" },
  DREAM_CRON: { group: "Dream", label: "Dream 运行时间", type: "string", defaultValue: "30 3 * * *", description: "Cron 表达式，使用服务器本地时间；保存后立即重排定时任务。" },

  RUNTIME_STATE_AUTO_UPDATE_ENABLED: { group: "运行态", label: "自动校准总开关", type: "boolean", defaultValue: true, description: "控制 Dream 和自启动是否能自动写入心力/最近状态；Owner 聊天只记录事件，不直接改运行态。" },
  RUNTIME_AUTONOMY_AUTO_RUN: { group: "运行态", label: "自启动定时运行", type: "boolean", defaultValue: false, description: "开启后按运行频率做空闲检查；聊天少时可推进一个自主任务，聊天多时只调整心力并暂停闲时任务。" },
  RUNTIME_AUTONOMY_CRON: { group: "运行态", label: "自启动运行频率", type: "string", defaultValue: "*/30 * * * *", description: "Cron 表达式，使用服务器本地时间；保存后立即重排定时任务。" },
  RUNTIME_AUTONOMY_LOW_CHAT_COUNT: { group: "运行态", label: "自启动低聊天阈值", type: "integer", defaultValue: 20, min: 0, max: 10000, description: "最近 2 小时聊天轮数小于等于这个值时，心力缓慢恢复。" },
  RUNTIME_AUTONOMY_HIGH_CHAT_COUNT: { group: "运行态", label: "自启动高聊天阈值", type: "integer", defaultValue: 80, min: 1, max: 10000, description: "最近 2 小时聊天轮数达到这个值时，判断为高强度聊天，心力下降。" },

  TAVILY_ENABLED: { group: "网页能力", label: "Tavily 搜索启用", type: "boolean", defaultValue: false, description: "启用 web_search 搜索引擎；适合找链接、查新闻和外部资料，不负责读取完整网页。" },
  TAVILY_MAX_RESULTS: { group: "网页能力", label: "Tavily 最大结果", type: "integer", defaultValue: 5, min: 1, max: 20, description: "一次搜索最多返回多少条结果；越大信息越多，也越容易带入噪声。" },
  EXTERNAL_IDENTITY_RESEARCH_ENABLED: { group: "网页能力", label: "外部身份候选检索", type: "boolean", defaultValue: false, description: "当用户自称或显示名出现时，在后台检索公开身份候选；不会阻塞聊天，且必须经本人确认才写入正式关系资料。需要 Tavily 搜索可用。" },
  JINA_ENABLED: { group: "网页能力", label: "Jina Reader", type: "boolean", defaultValue: true, description: "第三方网页读取服务，适合公开文档、文章、博客、新闻等静态内容；不使用本地登录态。" },
  PLAYWRIGHT_ENABLED: { group: "网页能力", label: "Playwright Reader", type: "boolean", defaultValue: false, description: "本地无头浏览器读取，适合公开但依赖 JS 渲染的页面；被 read_page 选中时也可以返回截图。" },
  MCP_ENABLED: { group: "Chrome MCP", label: "MCP 总开关", type: "boolean", defaultValue: false, description: "MCP 能力总开关；关闭后 Chrome DevTools MCP 不会被启动或调用。" },
  CHROME_DEVTOOLS_MCP_ENABLED: { group: "Chrome MCP", label: "Chrome DevTools MCP", type: "boolean", defaultValue: false, description: "仅 Owner 可通过 read_page 使用；连接已登录的本地 Chrome，适合小红书和需要登录态的真实浏览器页面；被选中时也可以返回截图。" },
  CHROME_DEVTOOLS_MCP_CONNECTION_MODE: { group: "Chrome MCP", label: "连接方式", type: "select", defaultValue: "auto", options: ["auto", "browser_url"], description: "auto 让 MCP 自动连接本地 Chrome；browser_url 使用下面配置的本地调试地址。" },
  CHROME_DEVTOOLS_MCP_BROWSER_URL: { group: "Chrome MCP", label: "本地调试地址", type: "string", defaultValue: "http://127.0.0.1:9222", description: "connection mode 为 browser_url 时使用；只能指向本机 Chrome 调试地址。" },
  CHROME_DEVTOOLS_MCP_MIN_OPEN_INTERVAL_MS: { group: "Chrome MCP", label: "新开页面最短间隔", type: "integer", defaultValue: 15000, min: 5000, max: 600000, description: "限制连续新开页面的频率，避免平台页面被短时间大量打开。" },
  CHROME_DEVTOOLS_MCP_SETTLE_MIN_MS: { group: "Chrome MCP", label: "稳定等待最短时间", type: "integer", defaultValue: 3000, min: 300, max: 60000, description: "打开或切换页面后至少等待多久再读取，让页面 JS 和评论有时间加载。" },
  CHROME_DEVTOOLS_MCP_SETTLE_MAX_MS: { group: "Chrome MCP", label: "稳定等待最长时间", type: "integer", defaultValue: 5000, min: 300, max: 60000, description: "没有指定等待时间时的随机等待上限；必须大于等于最短等待。" },

  XIAOHONGSHU_COMMENT_PUBLISHER_ENABLED: { group: "小红书发布", label: "评论自动发布", type: "boolean", defaultValue: false, description: "默认关闭。开启后仍只允许从已读取的真实帖子发布一条已保存草稿，每次都要在后台明确确认；会核验评论、提交结果并记录审计，验证码、登录失效或页面不匹配时会停止。" },

  TELEGRAM_ENABLED: { group: "渠道", label: "Telegram 启用", type: "boolean", defaultValue: false, description: "保存后立即启动或停止 Telegram 长轮询；需要先在渠道连接里配置 Bot Token 并重启。" },
  TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS: { group: "渠道", label: "Telegram 下载超时", type: "integer", defaultValue: 30000, min: 1000, max: 300000, description: "Telegram 图片/文件下载的单次等待时间，单位毫秒；网络慢或走代理时可以调大。" },
  TELEGRAM_FILE_DOWNLOAD_RETRIES: { group: "渠道", label: "Telegram 下载重试", type: "integer", defaultValue: 2, min: 0, max: 20, description: "Telegram 图片/文件下载失败后的重试次数；0 表示不重试。" },
  TELEGRAM_MAX_IMAGE_FILE_MB: { group: "渠道", label: "Telegram 图片最大大小", type: "number", defaultValue: 10, min: 0.1, max: 100, description: "Telegram 图片输入的最大大小，单位 MB；支持小数，比如 2.5 表示 2.5 MB。" },
  WEIXIN_ENABLED: { group: "渠道", label: "微信桥接启用", type: "boolean", defaultValue: false, description: "开启后接收 OpenClaw/微信桥接推送；需要先在渠道连接里配置 Weixin Bridge Secret 并重启。" },
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
