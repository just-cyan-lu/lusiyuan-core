import { env } from "../utils/env.js";
import { prisma } from "../db/prisma.js";
import type { CdpPageContent, CdpReadOptions } from "./cdp-browser.types.js";

class CdpBrowserService {
  private get wsEndpoint(): string {
    return `http://localhost:${env.CDP_BROWSER_PORT}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.wsEndpoint}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async read(options: CdpReadOptions): Promise<CdpPageContent> {
    if (!env.CDP_BROWSER_ENABLED) {
      throw new Error("CDP Browser is disabled");
    }

    const available = await this.isAvailable();
    if (!available) {
      throw new Error(
        `Chrome is not reachable at port ${env.CDP_BROWSER_PORT}. ` +
        "Start Chrome with: --remote-debugging-port=" + env.CDP_BROWSER_PORT
      );
    }

    const { chromium } = await import("playwright");

    const browser = await chromium.connectOverCDP(
      `http://localhost:${env.CDP_BROWSER_PORT}`
    );

    try {
      const contexts = browser.contexts();
      const context = contexts[0] ?? await browser.newContext();
      const page = await context.newPage();

      await page.goto(options.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      if (options.waitMs) {
        await page.waitForTimeout(options.waitMs);
      }

      const title = await page.title();
      const content = await page.evaluate(() => document.body.innerText);
      const truncated = content.slice(0, env.PLAYWRIGHT_MAX_PAGE_TEXT_CHARS);

      await page.close();

      const result: CdpPageContent = {
        url: options.url,
        title,
        content: truncated,
        tool: "cdp",
      };

      await prisma.externalPageSnapshot.create({
        data: {
          id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          url: result.url,
          tool: result.tool,
          content: result.content,
        },
      });

      return result;
    } finally {
      await browser.close();
    }
  }
}

export const cdpBrowserService = new CdpBrowserService();
