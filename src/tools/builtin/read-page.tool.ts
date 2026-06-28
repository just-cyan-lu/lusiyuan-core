import { pageReaderService } from "../../page-reader/page-reader.service.js";
import { chromeDevtoolsMcpService } from "../../mcp/chrome-devtools-mcp.service.js";
import { runtimeConfig } from "../../config/runtime-settings.service.js";
import { throwIfTaskCancelled } from "../../runtime/running-task-registry.js";
import { toolAccessState } from "../tool-access.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface ReadPageInput {
  url: string;
  tool?: "jina" | "playwright" | "chrome-devtools-mcp";
  wait_ms?: number;
  screenshot?: boolean;
}

interface ReadPageOutput {
  url: string;
  title?: string;
  content: string;
  tool: string;
  screenshotBase64?: string;  // base64 encoded PNG screenshot
}

type ReadPageBackend = NonNullable<ReadPageInput["tool"]>;

const loginBrowserHosts = [
  "xiaohongshu.com",
  "xhslink.com",
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
];

const publicDocumentHosts = [
  "developer.mozilla.org",
  "docs.github.com",
  "github.com",
  "github.io",
  "readthedocs.io",
  "wikipedia.org",
  "npmjs.com",
  "pypi.org",
  "medium.com",
  "dev.to",
];

const publicDocumentPathParts = [
  "/docs",
  "/documentation",
  "/guide",
  "/guides",
  "/learn",
  "/blog",
  "/article",
  "/news",
  "/wiki",
  "/manual",
  "/reference",
  "/api",
];

function parsedUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hostMatches(hostname: string, domains: string[]): boolean {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isLikelyLoginBrowserUrl(url: string): boolean {
  const parsed = parsedUrl(url);
  if (!parsed) return false;
  return hostMatches(parsed.hostname.toLowerCase(), loginBrowserHosts);
}

function isLikelyPublicDocumentUrl(url: string): boolean {
  const parsed = parsedUrl(url);
  if (!parsed) return false;
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  if (hostMatches(hostname, publicDocumentHosts)) return true;
  if (hostname.startsWith("docs.") || hostname.startsWith("developer.") || hostname.startsWith("learn.") || hostname.startsWith("help.")) {
    return true;
  }
  if (pathname.match(/\.(md|markdown|txt|pdf)$/)) return true;
  return publicDocumentPathParts.some((part) => pathname === part || pathname.startsWith(`${part}/`));
}

function chromeMcpAvailable(): boolean {
  return runtimeConfig.MCP_ENABLED && runtimeConfig.CHROME_DEVTOOLS_MCP_ENABLED;
}

function firstEnabled(
  candidates: ReadPageBackend[],
  context: ToolExecutionContext,
  options: { requireScreenshot?: boolean } = {}
): ReadPageBackend {
  for (const candidate of candidates) {
    if (options.requireScreenshot && candidate === "jina") continue;
    if (candidate === "jina" && runtimeConfig.JINA_ENABLED) return candidate;
    if (candidate === "playwright" && runtimeConfig.PLAYWRIGHT_ENABLED) return candidate;
    if (candidate === "chrome-devtools-mcp" && context.isOwner && chromeMcpAvailable()) return candidate;
  }
  if (options.requireScreenshot) {
    throw new Error("没有可用的可截图网页读取器，请开启 Playwright，或在 Owner 对话中启用 Chrome DevTools MCP。");
  }
  throw new Error("没有可用的网页读取器，请检查 Jina、Playwright 或 Chrome MCP 配置。");
}

export function selectReadPageBackend(
  input: ReadPageInput,
  context: ToolExecutionContext
): ReadPageBackend {
  if (input.tool) {
    if (input.screenshot && input.tool === "jina") {
      throw new Error("Jina Reader 不支持截图，请使用 Playwright 或 Chrome DevTools MCP。");
    }
    if (input.tool === "chrome-devtools-mcp" && !context.isOwner) {
      throw new Error("Chrome DevTools MCP 只能在 Owner 对话中使用。");
    }
    return input.tool;
  }

  const requireScreenshot = input.screenshot === true;
  if (isLikelyLoginBrowserUrl(input.url)) {
    return firstEnabled(["chrome-devtools-mcp", "playwright", "jina"], context, { requireScreenshot });
  }
  if (isLikelyPublicDocumentUrl(input.url)) {
    return firstEnabled(["jina", "playwright", "chrome-devtools-mcp"], context, { requireScreenshot });
  }
  return firstEnabled(["playwright", "jina", "chrome-devtools-mcp"], context, { requireScreenshot });
}

async function handler(
  input: ReadPageInput,
  context: ToolExecutionContext
): Promise<ReadPageOutput> {
  throwIfTaskCancelled(context.signal);
  const backend = selectReadPageBackend(input, context);
  if (backend === "chrome-devtools-mcp") {
    const result = await chromeDevtoolsMcpService.read(input.url, input.wait_ms, input.screenshot, context.signal);
    throwIfTaskCancelled(context.signal);
    return {
      url: result.url,
      title: result.title,
      content: result.content,
      tool: result.tool,
      screenshotBase64: result.screenshotBase64,
    };
  }

  const result = await pageReaderService.read({
    url: input.url,
    screenshot: input.screenshot,
    preferTool: backend,
    signal: context.signal,
  });

  throwIfTaskCancelled(context.signal);
  return {
    url: result.url,
    title: result.title,
    content: result.content,
    tool: result.tool,
    screenshotBase64: result.screenshotBase64,
  };
}

export const readPageTool: ToolDefinition<ReadPageInput, ReadPageOutput> = {
  name: "read_page",
  description:
    "读取网页内容并转换为纯文本。支持三种工具：\n" +
    "- jina：优先用于公开文档、文章、博客、新闻等静态内容\n" +
    "- playwright：用于公开但依赖 JS 渲染的页面；被选中时可同时截图\n" +
    "- chrome-devtools-mcp：仅 Owner 可用；用于需要登录态的真实 Chrome 页面，被选中时可同时截图，页面会保留\n" +
  "参数 wait_ms：等待页面 JS 渲染完成的毫秒数。对于动态加载的页面（如社交媒体、SPA 应用）建议传 2000-5000，静态页面不需要传。",
  riskLevel: "low",
  enabled: true,
  runtimeAccess: () => toolAccessState(
      runtimeConfig.TOOL_READ_PAGE_MODE,
      runtimeConfig.JINA_ENABLED || runtimeConfig.PLAYWRIGHT_ENABLED ||
        (runtimeConfig.MCP_ENABLED && runtimeConfig.CHROME_DEVTOOLS_MCP_ENABLED)
    ),
  handler,
};
