import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { StdioMcpClient, mcpText, type McpToolResult } from "./mcp-client.js";

export interface ChromeMcpPage {
  id: number;
  url: string;
  title?: string;
  selected?: boolean;
}

interface EnsurePageOptions {
  aliases?: string[];
  settleMs?: number;
}

const allowedTools = new Set([
  "list_pages",
  "select_page",
  "new_page",
  "wait_for",
  "take_snapshot",
  "evaluate_script",
]);

function routeError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function randomBetween(min: number, max: number): number {
  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(low, max);
  return Math.round(low + Math.random() * (high - low));
}

function parseJsonCodeBlock<T>(text: string): T {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/i)?.[1] ?? "";
  if (!candidate) throw new Error("Chrome DevTools MCP did not return JSON");
  return JSON.parse(candidate) as T;
}

function pagesFromResult(result: McpToolResult): ChromeMcpPage[] {
  const structured = result.structuredContent?.pages;
  if (Array.isArray(structured)) {
    return structured.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const id = Number(record.id ?? record.pageId);
      const url = typeof record.url === "string" ? record.url : "";
      if (!Number.isFinite(id) || !url) return [];
      return [{
        id,
        url,
        title: typeof record.title === "string" ? record.title : undefined,
        selected: Boolean(record.selected),
      }];
    });
  }

  const pages: ChromeMcpPage[] = [];
  for (const line of mcpText(result).split("\n")) {
    const match = line.match(/^(\d+):\s+(.*?)(?:\s+\[selected\])?$/);
    if (!match) continue;
    const label = match[2].replace(/\s+\[selected\]$/, "");
    const urlMatch = label.match(/\((https?:\/\/[^)]+)\)$/);
    const url = urlMatch?.[1] ?? (label.startsWith("http") ? label : "");
    if (!url) continue;
    pages.push({
      id: Number(match[1]),
      url,
      title: urlMatch ? label.slice(0, urlMatch.index).trim() : undefined,
      selected: line.includes("[selected]"),
    });
  }
  return pages;
}

class ChromeDevtoolsMcpService {
  private client: StdioMcpClient | null = null;
  private operationRunning = false;
  private lastNewPageAt = 0;

  private configured(): boolean {
    return runtimeConfig.MCP_ENABLED && runtimeConfig.CHROME_DEVTOOLS_MCP_ENABLED;
  }

  private getClient(): StdioMcpClient {
    if (this.client) return this.client;
    const connectionArgs: string[] = [];
    if (runtimeConfig.CHROME_DEVTOOLS_MCP_CONNECTION_MODE === "auto") {
      connectionArgs.push("--auto-connect");
    } else {
      const browserUrl = new URL(runtimeConfig.CHROME_DEVTOOLS_MCP_BROWSER_URL);
      if (!["127.0.0.1", "localhost", "::1"].includes(browserUrl.hostname)) {
        throw routeError("CHROME_DEVTOOLS_MCP_BROWSER_URL must point to local Chrome", 400);
      }
      connectionArgs.push(`--browser-url=${browserUrl.toString()}`);
    }
    this.client = new StdioMcpClient({
      command: "npx",
      args: [
        "--yes",
        "chrome-devtools-mcp@1.3.0",
        ...connectionArgs,
        "--no-usage-statistics",
        "--no-performance-crux",
        "--no-category-emulation",
        "--no-category-performance",
        "--no-category-network",
        "--experimental-structured-content",
      ],
      cwd: process.cwd(),
      timeoutMs: 45000,
    });
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.configured()) return false;
    if (runtimeConfig.CHROME_DEVTOOLS_MCP_CONNECTION_MODE === "auto") {
      return Promise.race([
        this.listPages().then(() => true).catch(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 4000)),
      ]);
    }
    try {
      const response = await fetch(`${runtimeConfig.CHROME_DEVTOOLS_MCP_BROWSER_URL.replace(/\/$/, "")}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async callReadOnlyTool(name: string, args: Record<string, unknown> = {}) {
    if (!this.configured()) {
      throw routeError("Chrome DevTools MCP 未启用，请在配置中开启 MCP 和 Chrome DevTools MCP。", 503);
    }
    if (!allowedTools.has(name)) {
      throw routeError(`Chrome DevTools MCP tool is not allowed: ${name}`, 403);
    }
    return this.getClient().callTool(name, args);
  }

  async listPages(): Promise<ChromeMcpPage[]> {
    return pagesFromResult(await this.callReadOnlyTool("list_pages"));
  }

  async ensurePage(url: string, options: EnsurePageOptions = {}): Promise<{ page: ChromeMcpPage; reused: boolean }> {
    const candidates = [url, ...(options.aliases ?? [])].map(normalizeUrl);
    const currentPages = await this.listPages();
    const existing = currentPages.find((page) => {
      const pageUrl = normalizeUrl(page.url);
      return candidates.some((candidate) => pageUrl === candidate || pageUrl.includes(candidate));
    });

    if (existing) {
      await this.callReadOnlyTool("select_page", { pageId: existing.id, bringToFront: false });
      await this.settle(options.settleMs);
      return { page: existing, reused: true };
    }

    const elapsed = Date.now() - this.lastNewPageAt;
    const minimum = Math.max(runtimeConfig.CHROME_DEVTOOLS_MCP_MIN_OPEN_INTERVAL_MS, 5000);
    if (this.lastNewPageAt > 0 && elapsed < minimum) {
      const seconds = Math.ceil((minimum - elapsed) / 1000);
      throw routeError(`为避免连续打开平台页面，请等待 ${seconds} 秒后再试。`, 429);
    }

    this.lastNewPageAt = Date.now();
    const result = await this.callReadOnlyTool("new_page", {
      url,
      background: false,
      timeout: 30000,
    });
    await this.settle(options.settleMs);
    const pages = pagesFromResult(result);
    const selected = pages.find((page) => page.selected) ?? pages.find((page) => normalizeUrl(page.url) === normalizeUrl(url));
    if (!selected) {
      const refreshed = await this.listPages();
      const fallback = refreshed.find((page) => page.selected) ?? refreshed.at(-1);
      if (!fallback) throw new Error("Chrome DevTools MCP opened the page but returned no page information");
      return { page: fallback, reused: false };
    }
    return { page: selected, reused: false };
  }

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.operationRunning) {
      throw routeError("已有一个浏览器读取任务正在运行，请等待它完成。", 409);
    }
    this.operationRunning = true;
    try {
      return await operation();
    } finally {
      this.operationRunning = false;
    }
  }

  async evaluate<T>(functionDeclaration: string): Promise<T> {
    const result = await this.callReadOnlyTool("evaluate_script", {
      function: functionDeclaration,
    });
    return parseJsonCodeBlock<T>(mcpText(result));
  }

  async read(url: string, waitMs?: number) {
    return this.runExclusive(async () => {
      const { reused } = await this.ensurePage(url, { settleMs: waitMs });
      const result = await this.evaluate<{ url: string; title: string; content: string }>(`() => ({
        url: location.href,
        title: document.title,
        content: (document.body?.innerText ?? "").slice(0, ${Math.max(runtimeConfig.PLAYWRIGHT_MAX_PAGE_TEXT_CHARS, 1000)})
      })`);
      await prisma.externalPageSnapshot.create({
        data: {
          id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          url: result.url,
          tool: "chrome-devtools-mcp",
          content: result.content,
        },
      });
      return { ...result, tool: "chrome-devtools-mcp" as const, reusedPage: reused, pageLeftOpen: true };
    });
  }

  async resetConnection(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.lastNewPageAt = 0;
    await client?.disconnect();
  }

  private async settle(requested?: number): Promise<void> {
    const waitMs = requested === undefined
      ? randomBetween(runtimeConfig.CHROME_DEVTOOLS_MCP_SETTLE_MIN_MS, runtimeConfig.CHROME_DEVTOOLS_MCP_SETTLE_MAX_MS)
      : Math.min(Math.max(requested, 300), 5000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export const chromeDevtoolsMcpService = new ChromeDevtoolsMcpService();
