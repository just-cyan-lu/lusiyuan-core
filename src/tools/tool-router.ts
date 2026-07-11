import { actionPolicy } from "./policy/action-policy.js";
import type { ToolDefinition, ToolExecutionContext } from "./tool.types.js";

export type ChatToolIntent = "memory" | "web_search" | "read_page" | "home_automation";

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/iu;

const memoryPatterns = [
  /记得/u,
  /记不记得/u,
  /还记得/u,
  /之前(?:说|聊|提|讲)过/u,
  /以前(?:说|聊|提|讲)过/u,
  /上次(?:说|聊|提|讲|到)/u,
  /我们(?:之前|以前|上次).*?(?:说|聊|提|讲)/u,
  /聊到哪/u,
  /说过什么/u,
  /我的记忆/u,
  /你的记忆/u,
];

const searchPatterns = [
  /搜(?:一下|下|索)?/u,
  /查(?:一下|下|找)?/u,
  /搜索/u,
  /检索/u,
  /网上/u,
  /网页上/u,
  /资料/u,
  /新闻/u,
  /最新/u,
  /现在.*?(?:价格|版本|消息|情况)/u,
  /\bgoogle\b/iu,
  /\bbaidu\b/iu,
  /\bsearch\b/iu,
];

const readPagePatterns = [
  /链接/u,
  /网址/u,
  /网页/u,
  /页面/u,
  /文章/u,
  /文档/u,
  /帖子/u,
  /评论/u,
  /小红书/u,
  /\bxhs\b/iu,
  /read\s+page/iu,
  /open\s+.*?url/iu,
];

const homeAutomationPatterns = [
  /智能家居/u,
  /家里(?:的)?(?:灯|空调|窗帘|电视|设备|家电)/u,
  /(?:开|关|打开|关闭|调|设置).{0,12}(?:灯|空调|窗帘|电视|设备|家电)/u,
  /(?:客厅|卧室|书房|厨房|卫生间).{0,12}(?:灯|空调|窗帘|电视|温度)/u,
  /(?:场景|睡眠模式|离家模式)/u,
];

function includesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

export function detectChatToolIntents(message: string): ChatToolIntent[] {
  const text = message.trim();
  if (!text) return [];

  const intents: ChatToolIntent[] = [];
  const hasUrl = URL_PATTERN.test(text);

  if (includesAny(text, memoryPatterns)) {
    intents.push("memory");
  }
  if (hasUrl || includesAny(text, readPagePatterns)) {
    intents.push("read_page");
  }
  if (includesAny(text, searchPatterns)) {
    intents.push("web_search");
  }
  if (includesAny(text, homeAutomationPatterns)) {
    intents.push("home_automation");
  }

  return [...new Set(intents)];
}

function toolNamesForIntents(intents: ChatToolIntent[]): Set<string> {
  const names = new Set<string>();
  for (const intent of intents) {
    if (intent === "memory") names.add("search_memories");
    if (intent === "web_search") names.add("web_search");
    if (intent === "read_page") names.add("read_page");
    if (intent === "home_automation") {
      names.add("query_home_state");
      names.add("control_home");
    }
  }
  return names;
}

export function selectToolsForChat(input: {
  message: string;
  tools: ToolDefinition[];
  context: ToolExecutionContext;
}): ToolDefinition[] {
  const intents = detectChatToolIntents(input.message);
  if (intents.length === 0) return [];

  const wanted = toolNamesForIntents(intents);
  return input.tools.filter((tool) => {
    if (!wanted.has(tool.name)) return false;
    return actionPolicy.canExecute(tool, input.context).allowed;
  });
}

export function toolProgressContent(toolNames: string[]): string {
  const names = new Set(toolNames);
  if (names.size === 0) return "typing";
  if (names.has("read_page")) return "tool:read_page";
  if (names.has("web_search")) return "tool:web_search";
  if (names.has("search_memories")) return "tool:search_memories";
  return "tool:generic";
}
