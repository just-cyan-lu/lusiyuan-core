import { runtimeConfig } from "../config/runtime-settings.service.js";
import type { PageContent } from "./page-reader.types.js";

export async function playwrightRead(
  url: string,
  screenshot = false
): Promise<PageContent> {
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const title = await page.title();
    const content = await page.evaluate(() => document.body.innerText);
    const truncated = content.slice(0, runtimeConfig.PLAYWRIGHT_MAX_PAGE_TEXT_CHARS);

    let screenshotBase64: string | undefined;
    if (screenshot && runtimeConfig.PLAYWRIGHT_SCREENSHOT_ENABLED) {
      const buffer = await page.screenshot({ fullPage: false });
      screenshotBase64 = buffer.toString("base64");
    }

    return { url, title, content: truncated, tool: "playwright", screenshotBase64 };
  } finally {
    await browser.close();
  }
}
