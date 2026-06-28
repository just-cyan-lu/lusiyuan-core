import type { PageContent } from "./page-reader.types.js";
import { throwIfTaskCancelled } from "../runtime/running-task-registry.js";

export async function playwrightRead(
  url: string,
  screenshot = false,
  signal?: AbortSignal
): Promise<PageContent> {
  throwIfTaskCancelled(signal);
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  const closeOnAbort = () => {
    void browser.close().catch(() => undefined);
  };
  signal?.addEventListener("abort", closeOnAbort, { once: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    throwIfTaskCancelled(signal);

    const title = await page.title();
    const content = await page.evaluate(() => document.body.innerText);
    throwIfTaskCancelled(signal);

    let screenshotBase64: string | undefined;
    if (screenshot) {
      const buffer = await page.screenshot({ fullPage: false });
      screenshotBase64 = buffer.toString("base64");
    }
    throwIfTaskCancelled(signal);

    return { url, title, content, tool: "playwright", screenshotBase64 };
  } finally {
    signal?.removeEventListener("abort", closeOnAbort);
    await browser.close().catch(() => undefined);
  }
}
