import type { InboxItem } from "../external-inbox.types.js";
import { cdpBrowserService } from "../../cdp-browser/cdp-browser.service.js";
import { env } from "../../utils/env.js";
import { createHash } from "node:crypto";

// 小红书通知中心 URL（需要登录态）
const XHS_NOTIFICATIONS_URL = "https://www.xiaohongshu.com/notification";

function stableSourceId(authorName: string | undefined, actionLine: string, content: string): string {
  const digest = createHash("sha256")
    .update([authorName ?? "", actionLine, content].join("\u0000"))
    .digest("hex")
    .slice(0, 24);
  return `xhs_${digest}`;
}

export async function fetchXiaohongshuInbox(): Promise<InboxItem[]> {
  if (!env.CDP_BROWSER_ENABLED) {
    throw new Error("CDP Browser must be enabled to read 小红书 inbox");
  }

  const page = await cdpBrowserService.read({
    url: XHS_NOTIFICATIONS_URL,
    waitMs: 2000,
  });

  // 从页面文本中提取评论条目
  // 小红书通知页面结构会变化，这里做基础解析
  const lines = page.content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items: InboxItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 简单启发式：包含"评论了你"或"回复了你"的行视为评论通知
    if (line.includes("评论了你") || line.includes("回复了你")) {
      const content = lines[i + 1] ?? line;
      const authorName = lines[i - 1];
      items.push({
        platform: "xiaohongshu",
        sourceId: stableSourceId(authorName, line, content),
        type: "comment",
        content,
        authorName,
      });
    }
  }

  return items.slice(0, env.EXTERNAL_INBOX_MAX_ITEMS_PER_SYNC);
}
