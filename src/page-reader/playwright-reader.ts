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

    let screenshotBase64: string | undefined;
    if (screenshot) {
      const buffer = await page.screenshot({ fullPage: false });
      screenshotBase64 = buffer.toString("base64");
    }

    return { url, title, content, tool: "playwright", screenshotBase64 };
  } finally {
    await browser.close();
  }
}
