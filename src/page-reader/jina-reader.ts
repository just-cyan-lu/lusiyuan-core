import { env } from "../utils/env.js";
import type { PageContent } from "./page-reader.types.js";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const JINA_BASE = "https://r.jina.ai";

export async function jinaRead(url: string): Promise<PageContent> {
  const headers: Record<string, string> = {
    Accept: "text/markdown",
  };

  if (env.JINA_API_KEY) {
    headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
  }

  const dispatcher = env.EXTERNAL_HTTP_PROXY
    ? new ProxyAgent(env.EXTERNAL_HTTP_PROXY)
    : undefined;

  const res = await undiciFetch(`${JINA_BASE}/${url}`, {
    headers,
    dispatcher,
  });

  if (!res.ok) {
    throw new Error(`Jina Reader failed: ${res.status} ${res.statusText}`);
  }

  const content = await res.text();
  return { url, content, tool: "jina" };
}
