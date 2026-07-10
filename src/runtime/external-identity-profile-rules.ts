export interface SocialProfileMatch {
  platform: string;
  url: string;
}

export const socialProfileDomains = [
  "xiaohongshu.com",
  "x.com",
  "twitter.com",
  "bsky.app",
  "zhihu.com",
  "bilibili.com",
  "youtube.com",
  "douyin.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "weibo.com",
  "threads.net",
  "kuaishou.com",
  "linkedin.com",
  "github.com",
  "twitch.tv",
] as const;

function cleanHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function oneHandlePath(parts: string[], blocked: string[] = []): boolean {
  return parts.length === 1 && !blocked.includes(parts[0]?.toLowerCase() ?? "");
}

/**
 * A candidate needs at least one result that is plausibly an account/profile root.
 * Content pages, posts, comments and search pages intentionally return null.
 */
export function matchSocialProfileUrl(rawUrl: string): SocialProfileMatch | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = cleanHost(url.hostname);
  const parts = segments(url.pathname);

  if (host === "space.bilibili.com" && /^\d+$/u.test(parts[0] ?? "") && parts.length === 1) {
    return { platform: "B站", url: url.toString() };
  }
  if (host.endsWith("xiaohongshu.com") && parts[0] === "user" && parts[1] === "profile" && Boolean(parts[2])) {
    return { platform: "小红书", url: url.toString() };
  }
  if ((host === "x.com" || host === "twitter.com") && oneHandlePath(parts, ["home", "search", "explore", "i", "intent", "settings", "compose"])) {
    return { platform: "X", url: url.toString() };
  }
  if (host === "bsky.app" && parts[0] === "profile" && Boolean(parts[1]) && parts.length === 2) {
    return { platform: "Bluesky", url: url.toString() };
  }
  if (host.endsWith("zhihu.com") && parts[0] === "people" && Boolean(parts[1]) && parts.length === 2) {
    return { platform: "知乎", url: url.toString() };
  }
  if (host.endsWith("youtube.com") && ((parts[0]?.startsWith("@") && parts.length === 1) || (parts[0] === "channel" && Boolean(parts[1]) && parts.length === 2))) {
    return { platform: "YouTube", url: url.toString() };
  }
  if (host.endsWith("douyin.com") && parts[0] === "user" && Boolean(parts[1]) && parts.length === 2) {
    return { platform: "抖音", url: url.toString() };
  }
  if (host.endsWith("tiktok.com") && parts[0]?.startsWith("@") && parts.length === 1) {
    return { platform: "TikTok", url: url.toString() };
  }
  if (host.endsWith("instagram.com") && oneHandlePath(parts, ["explore", "reel", "p", "stories", "accounts", "direct"])) {
    return { platform: "Instagram", url: url.toString() };
  }
  if (host.endsWith("facebook.com") && (url.pathname === "/profile.php" || oneHandlePath(parts, ["groups", "watch", "marketplace", "events", "reel", "photo", "share"]))) {
    return { platform: "Facebook", url: url.toString() };
  }
  if (host.endsWith("weibo.com") && ((parts[0] === "u" && /^\d+$/u.test(parts[1] ?? "") && parts.length === 2) || (parts[0] === "n" && Boolean(parts[1]) && parts.length === 2))) {
    return { platform: "微博", url: url.toString() };
  }
  if (host.endsWith("threads.net") && parts[0]?.startsWith("@") && parts.length === 1) {
    return { platform: "Threads", url: url.toString() };
  }
  if (host.endsWith("kuaishou.com") && parts[0] === "profile" && Boolean(parts[1]) && parts.length === 2) {
    return { platform: "快手", url: url.toString() };
  }
  if (host.endsWith("linkedin.com") && parts[0] === "in" && Boolean(parts[1]) && parts.length === 2) {
    return { platform: "LinkedIn", url: url.toString() };
  }
  if (host === "github.com" && oneHandlePath(parts, ["topics", "organizations", "marketplace", "features", "settings", "search", "login", "signup"])) {
    return { platform: "GitHub", url: url.toString() };
  }
  if (host.endsWith("twitch.tv") && oneHandlePath(parts, ["directory", "downloads", "jobs", "turbo", "products"])) {
    return { platform: "Twitch", url: url.toString() };
  }
  return null;
}
