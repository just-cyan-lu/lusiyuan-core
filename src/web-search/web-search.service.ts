import { tavilySearch } from "./tavily-client.js";
import type { SearchResponse } from "./web-search.types.js";
import { env } from "../utils/env.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";

class WebSearchService {
  async search(
    query: string,
    options: { searchDepth?: "basic" | "advanced"; includeDomains?: string[]; signal?: AbortSignal } = {}
  ): Promise<SearchResponse> {
    if (!runtimeConfig.TAVILY_ENABLED) {
      throw new Error("Web search is disabled");
    }

    if (env.TAVILY_API_KEYS.length === 0) {
      throw new Error("No Tavily API keys configured (TAVILY_API_KEYS)");
    }

    return tavilySearch(query, options);
  }
}

export const webSearchService = new WebSearchService();
