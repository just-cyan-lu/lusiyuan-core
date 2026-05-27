import { env } from "../utils/env.js";
import type { PageContent } from "./page-reader.types.js";
import path from "path";
import os from "os";

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
    const truncated = content.slice(0, env.PLAYWRIGHT_MAX_PAGE_TEXT_CHARS);

    let screenshotPath: string | undefined;
    if (screenshot && env.PLAYWRIGHT_SCREENSHOT_ENABLED) {
      screenshotPath = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
    }

    return { url, title, content: truncated, tool: "playwright", screenshotPath };
  } finally {
    await browser.close();
  }
}
