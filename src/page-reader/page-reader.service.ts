import { runtimeConfig } from "../config/runtime-settings.service.js";
import { jinaRead } from "./jina-reader.js";
import { playwrightRead } from "./playwright-reader.js";
import { prisma } from "../db/prisma.js";
import type { PageContent, ReadPageOptions } from "./page-reader.types.js";

class PageReaderService {
  async read(options: ReadPageOptions): Promise<PageContent> {
    const { url, screenshot = false, preferTool } = options;

    let result: PageContent;

    const usePlaywright = preferTool === "playwright";

    if (usePlaywright) {
      if (!runtimeConfig.PLAYWRIGHT_ENABLED) {
        throw new Error("Playwright is disabled");
      }
      result = await playwrightRead(url, screenshot);
    } else {
      if (screenshot) {
        throw new Error("Jina Reader 不支持截图，请使用 Playwright 或 Chrome DevTools MCP。");
      }
      if (!runtimeConfig.JINA_ENABLED) {
        throw new Error("Jina Reader is disabled");
      }
      result = await jinaRead(url);
    }

    await prisma.externalPageSnapshot.create({
      data: {
        id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url: result.url,
        tool: result.tool,
        content: result.content,
        screenshotPath: result.screenshotBase64 ? "base64" : null, // legacy field, just mark as "base64" if present
      },
    });

    return result;
  }
}

export const pageReaderService = new PageReaderService();
