import type { InboxItem } from "../external-inbox.types.js";
import { cdpBrowserService } from "../../cdp-browser/cdp-browser.service.js";
import { env } from "../../utils/env.js";

// 小红书通知中心 URL（需要登录态）
const XHS_NOTIFICATIONS_URL = "https://www.xiaohongshu.com/notification";

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
      items.push({
        platform: "xiaohongshu",
        sourceId: `xhs_${Date.now()}_${i}`,
        type: "comment",
        content: lines[i + 1] ?? line,
        authorName: lines[i - 1],
      });
    }
  }

  return items.slice(0, env.EXTERNAL_INBOX_MAX_ITEMS_PER_SYNC);
}
