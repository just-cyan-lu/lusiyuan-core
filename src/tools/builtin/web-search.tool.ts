import { webSearchService } from "../../web-search/web-search.service.js";
import { runtimeConfig } from "../../config/runtime-settings.service.js";
import { toolAccessState } from "../tool-access.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface WebSearchInput {
  query: string;
  searchDepth?: "basic" | "advanced";
}

interface WebSearchOutput {
  query: string;
  answer?: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    score?: number;
  }>;
}

async function handler(
  input: WebSearchInput,
  context: ToolExecutionContext
): Promise<WebSearchOutput> {
  const searchDepth = input.searchDepth === "advanced" ? "advanced" : "basic";
  return webSearchService.search(input.query, { searchDepth, signal: context.signal });
}

export const webSearchTool: ToolDefinition<WebSearchInput, WebSearchOutput> = {
  name: "web_search",
  description:
    "使用 Tavily 搜索引擎搜索网页。返回搜索结果列表（标题、URL、摘要）和可能的答案摘要。适用于查找最新信息、新闻、技术文档等。",
  riskLevel: "low",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索关键词" },
      searchDepth: {
        type: "string",
        enum: ["basic", "advanced"],
        description: "搜索深度。basic 适合简单搜一下；advanced 适合用户要求详细搜、深入查、资料不好找或需要更全面结果时。",
      },
    },
    required: ["query"],
  },
  enabled: true,
  runtimeAccess: () => toolAccessState(runtimeConfig.TOOL_WEB_SEARCH_MODE, runtimeConfig.TAVILY_ENABLED),
  handler,
};
