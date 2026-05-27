import { tavilySearch } from "./tavily-client.js";
import type { SearchResponse } from "./web-search.types.js";
import { env } from "../utils/env.js";

class WebSearchService {
  async search(query: string): Promise<SearchResponse> {
    if (!env.TAVILY_ENABLED) {
      throw new Error("Web search is disabled");
    }

    if (env.TAVILY_API_KEYS.length === 0) {
      throw new Error("No Tavily API keys configured (TAVILY_API_KEYS or TAVILY_API_KEY)");
    }

    return tavilySearch(query);
  }
}

export const webSearchService = new WebSearchService();
