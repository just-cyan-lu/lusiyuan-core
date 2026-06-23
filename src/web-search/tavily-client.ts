import { env } from "../utils/env.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import type { SearchResponse } from "./web-search.types.js";
import { ProxyAgent, fetch as undiciFetch } from "undici";

interface TavilySearchRequest {
  query: string;
  api_key: string;
  search_depth?: "basic" | "advanced";
  max_results?: number;
  include_answer?: boolean;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
}

async function doSearch(apiKey: string, query: string) {
  const body: TavilySearchRequest = {
    query,
    api_key: apiKey,
    search_depth: runtimeConfig.TAVILY_SEARCH_DEPTH as "basic" | "advanced",
    max_results: runtimeConfig.TAVILY_MAX_RESULTS,
    include_answer: true,
  };

  const dispatcher = env.EXTERNAL_HTTP_PROXY
    ? new ProxyAgent(env.EXTERNAL_HTTP_PROXY)
    : undefined;

  return undiciFetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    dispatcher,
  });
}

export async function tavilySearch(query: string): Promise<SearchResponse> {
  const keys = env.TAVILY_API_KEYS;
  if (keys.length === 0) throw new Error("No Tavily API keys configured");

  // Try keys in random order; on 401/429 fall through to the next one.
  const shuffled = [...keys].sort(() => Math.random() - 0.5);

  let lastError: Error | undefined;

  for (const key of shuffled) {
    const res = await doSearch(key, query);

    if (res.ok) {
      const data = (await res.json()) as TavilyResponse;
      return {
        query: data.query,
        answer: data.answer,
        results: data.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          score: r.score,
        })),
      };
    }

    // Quota exhausted or invalid key — try next
    if (res.status === 401 || res.status === 429) {
      lastError = new Error(`Tavily key failed: ${res.status} ${res.statusText}`);
      continue;
    }

    // Other errors (4xx/5xx) are not key-related, fail immediately
    throw new Error(`Tavily search failed: ${res.status} ${res.statusText}`);
  }

  throw lastError ?? new Error("All Tavily API keys exhausted");
}
