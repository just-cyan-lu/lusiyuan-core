import { pageReaderService } from "../../page-reader/page-reader.service.js";
import { cdpBrowserService } from "../../cdp-browser/cdp-browser.service.js";
import { env } from "../../utils/env.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface ReadPageInput {
  url: string;
  tool?: "jina" | "playwright" | "cdp";
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

async function handler(
  input: ReadPageInput,
  _context: ToolExecutionContext
): Promise<ReadPageOutput> {
  if (input.tool === "cdp") {
    const result = await cdpBrowserService.read({
      url: input.url,
      waitMs: input.wait_ms,
    });
    return {
      url: result.url,
      title: result.title,
      content: result.content,
      tool: result.tool,
    };
  }

  const result = await pageReaderService.read({
    url: input.url,
    screenshot: input.screenshot,
    preferTool: input.tool,
  });

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
    "- jina（默认）：快速，适合大多数公开网页\n" +
    "- playwright：本地无头浏览器，支持 JS 渲染的页面，可选截图\n" +
    "- cdp：连接用户已登录的 Chrome，适合需要登录的页面（如小红书通知）\n" +
    "参数 wait_ms：等待页面 JS 渲染完成的毫秒数。对于动态加载的页面（如社交媒体、SPA 应用）建议传 2000-5000，静态页面不需要传。",
  riskLevel: "low",
  ownerOnly: true,
  enabled: env.JINA_ENABLED || env.PLAYWRIGHT_ENABLED || env.CDP_BROWSER_ENABLED,
  handler,
};
