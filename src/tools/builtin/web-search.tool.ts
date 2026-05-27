import { webSearchService } from "../../web-search/web-search.service.js";
import { env } from "../../utils/env.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface WebSearchInput {
  query: string;
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
  _context: ToolExecutionContext
): Promise<WebSearchOutput> {
  return webSearchService.search(input.query);
}

export const webSearchTool: ToolDefinition<WebSearchInput, WebSearchOutput> = {
  name: "web_search",
  description:
    "使用 Tavily 搜索引擎搜索网页。返回搜索结果列表（标题、URL、摘要）和可能的答案摘要。适用于查找最新信息、新闻、技术文档等。",
  riskLevel: "low",
  ownerOnly: true,
  enabled: env.TAVILY_ENABLED,
  handler,
};
