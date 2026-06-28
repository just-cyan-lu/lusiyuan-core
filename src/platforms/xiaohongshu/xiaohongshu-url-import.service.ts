import { createHash } from "node:crypto";
import { modelProvider } from "../../core/model-provider.js";
import { prisma } from "../../db/prisma.js";
import { chromeDevtoolsMcpService } from "../../mcp/chrome-devtools-mcp.service.js";
import {
  normalizeXiaohongshuPostType,
  syncXiaohongshuAccountMirror,
  type SyncCommentInput,
  type SyncCommentThreadInput,
} from "./xiaohongshu-account.service.js";

const XIAOHONGSHU_COMMENT_IMPORT_LIMIT = 300;

interface RawDomComment {
  externalId?: string;
  authorName?: string;
  authorUserId?: string;
  content?: string;
  isAuthor?: boolean;
  replyToAuthorName?: string;
  sortOrder?: number;
}

interface RawCommentThread {
  root?: RawDomComment;
  replies?: RawDomComment[];
}

interface RawPageInspection {
  url: string;
  documentTitle: string;
  metaTitle: string;
  metaDescription: string;
  bodyText: string;
  contentCandidates: string[];
  authorCandidates: string[];
  postAuthorName: string;
  postCaption: string;
  commentThreads: RawCommentThread[];
  imageCount: number;
}

interface LlmImportResult {
  title?: string;
  caption?: string;
  author_name?: string;
  post_type?: string;
}

const DEFAULT_IMAGE_ALT_SLOTS = 4;
const MAX_IMAGE_ALT_SLOTS = 30;

const extractionPrompt = `你负责把已经打开的小红书帖子整理成帖子档案。

页面内容来自 DOM，只能提取明确出现的信息，不允许补写、概括或润色原文。

要求：
- title 和 caption 保留原文。
- author_name 是帖子作者名。
- post_type 只能是 daily / making / technical / thought / showcase / announcement / interactive。
- 不处理评论。评论线程、回复目标和作者身份已经由程序按 DOM 结构确定。
- 没有明确内容就返回空字符串。
- 只输出 JSON：{"title":"","caption":"","author_name":"","post_type":"daily"}`;

function routeError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function cleanText(value: unknown, max = 10000): string {
  return (typeof value === "string" ? value.trim() : "").slice(0, max);
}

function uniqueStrings(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 1000)).filter(Boolean))].slice(0, maxItems);
}

export function validateXiaohongshuUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw routeError("请输入有效的小红书帖子 URL。", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw routeError("小红书 URL 必须使用 http 或 https。", 400);
  }
  const host = url.hostname.toLowerCase();
  if (!(host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com") || host === "xhslink.com" || host.endsWith(".xhslink.com"))) {
    throw routeError("当前只允许导入小红书或 xhslink 链接。", 400);
  }
  return url;
}

export function extractXiaohongshuPostId(value: string): string | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/(?:explore|discovery\/item)\/([A-Za-z0-9]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value, "utf8").digest("hex").slice(0, 24)}`;
}

function imageAlts(value: unknown, imageCount: number): string[] {
  const current = Array.isArray(value)
    ? value.map((item) => cleanText(item, 1000)).slice(0, 30)
    : [];
  return Array.from({ length: imageCount }, (_, index) => current[index] ?? "");
}

function defaultImageAltSlots(existingCount: number | null | undefined, detectedImageCount: number): number {
  if (typeof existingCount === "number") {
    return Math.min(Math.max(Math.trunc(existingCount), 0), MAX_IMAGE_ALT_SLOTS);
  }
  return detectedImageCount > 0 ? DEFAULT_IMAGE_ALT_SLOTS : 0;
}

function normalizeDomComment(
  value: unknown,
  fallbackKey: string,
  sortOrder: number
): SyncCommentInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const content = cleanText(raw.content, 4000);
  if (!content) return null;
  const authorName = cleanText(raw.authorName, 240);
  const externalId = cleanText(raw.externalId, 240)
    || stableId("comment", `${fallbackKey}\n${authorName}\n${content}`);
  return {
    externalId,
    authorName: authorName || null,
    authorUserId: cleanText(raw.authorUserId, 240) || null,
    content,
    isAuthor: raw.isAuthor === true,
    replyToAuthorName: cleanText(raw.replyToAuthorName, 240) || null,
    sortOrder,
  };
}

export function normalizeImportedCommentThreads(
  value: unknown,
  postExternalId: string,
  limit = XIAOHONGSHU_COMMENT_IMPORT_LIMIT
): SyncCommentThreadInput[] {
  if (!Array.isArray(value)) return [];
  const maxComments = Math.min(Math.max(limit, 1), 300);
  const seen = new Set<string>();
  const threads: SyncCommentThreadInput[] = [];
  let count = 0;

  for (let threadIndex = 0; threadIndex < value.length && count < maxComments; threadIndex++) {
    const rawThread = value[threadIndex];
    if (!rawThread || typeof rawThread !== "object") continue;
    const record = rawThread as Record<string, unknown>;
    const root = normalizeDomComment(record.root, `${postExternalId}:root:${threadIndex}`, threadIndex);
    if (!root || seen.has(root.externalId)) continue;
    seen.add(root.externalId);
    count++;

    const replies: SyncCommentInput[] = [];
    const rawReplies = Array.isArray(record.replies) ? record.replies : [];
    for (let replyIndex = 0; replyIndex < rawReplies.length && count < maxComments; replyIndex++) {
      const reply = normalizeDomComment(
        rawReplies[replyIndex],
        `${postExternalId}:${root.externalId}:reply:${replyIndex}`,
        replyIndex + 1
      );
      if (!reply || seen.has(reply.externalId)) continue;
      seen.add(reply.externalId);

      const priorNodes = [root, ...replies];
      const directTarget = reply.replyToAuthorName
        ? [...priorNodes].reverse().find((candidate) => candidate.authorName === reply.replyToAuthorName)
        : root;
      replies.push({
        ...reply,
        replyToExternalId: directTarget?.externalId ?? root.externalId,
        replyToAuthorName: reply.replyToAuthorName ?? directTarget?.authorName ?? null,
        replyToAuthorUserId: directTarget?.authorUserId ?? null,
      });
      count++;
    }
    threads.push({ ...root, replies });
  }
  return threads;
}

async function expandLoadedReplyGroups(): Promise<number> {
  const maxExpansions = 20;
  let expanded = 0;
  while (expanded < maxExpansions) {
    const result = await chromeDevtoolsMcpService.evaluate<{ clicked: boolean }>(String.raw`() => {
      const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
      const target = [...document.querySelectorAll(".reply-container .show-more")]
        .find((element) =>
          !element.hasAttribute("data-lusiyuan-expanded")
          && /^展开\s*\d+\s*条回复$/.test(normalize(element.textContent))
        );
      if (!target) return { clicked: false };
      target.setAttribute("data-lusiyuan-expanded", "true");
      target.click();
      return { clicked: true };
    }`);
    if (!result.clicked) break;
    expanded++;
    const pauseMs = 1200 + Math.round(Math.random() * 1000);
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  if (expanded > 0) {
    await chromeDevtoolsMcpService.evaluate<{ cleared: boolean }>(`() => {
      for (const element of document.querySelectorAll("[data-lusiyuan-expanded]")) {
        element.removeAttribute("data-lusiyuan-expanded");
      }
      return { cleared: true };
    }`);
  }
  return expanded;
}

async function inspectCurrentPage(): Promise<RawPageInspection> {
  const maxComments = XIAOHONGSHU_COMMENT_IMPORT_LIMIT;
  return chromeDevtoolsMcpService.evaluate<RawPageInspection>(String.raw`() => {
    const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    const text = (selector) => normalize(document.querySelector(selector)?.textContent);
    const textsFrom = (selectors, limit) => {
      const values = [];
      for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
          const value = normalize(element.textContent);
          if (value && !values.includes(value)) values.push(value);
          if (values.length >= limit) return values;
        }
      }
      return values;
    };
    const readComment = (element, sortOrder) => {
      const inner = element.querySelector(":scope > .comment-inner-container") ?? element;
      const authorLink = inner.querySelector(".author .name");
      const authorArea = inner.querySelector(".author");
      const contentArea = inner.querySelector(".content");
      const noteText = contentArea?.querySelector(".note-text");
      return {
        externalId: (element.id || "").replace(/^comment-/, ""),
        authorName: normalize(authorLink?.textContent),
        authorUserId: authorLink?.getAttribute("data-user-id")
          || inner.querySelector("[data-user-id]")?.getAttribute("data-user-id")
          || "",
        content: normalize(noteText?.textContent),
        isAuthor: [...(authorArea?.querySelectorAll(".tag") ?? [])]
          .some((tag) => normalize(tag.textContent) === "作者"),
        replyToAuthorName: normalize(contentArea?.querySelector(".nickname")?.textContent),
        sortOrder,
      };
    };
    const commentThreads = [];
    for (const parent of document.querySelectorAll(".parent-comment")) {
      const rootElement = parent.querySelector(":scope > .comment-item:not(.comment-item-sub)");
      if (!rootElement) continue;
      const root = readComment(rootElement, commentThreads.length);
      if (!root.content) continue;
      const replies = [...parent.querySelectorAll(":scope > .reply-container .comment-item-sub")]
        .map((element, index) => readComment(element, index + 1))
        .filter((comment) => comment.content);
      commentThreads.push({ root, replies });
      if (commentThreads.reduce((total, thread) => total + 1 + thread.replies.length, 0) >= ${maxComments}) break;
    }
    const images = new Set(
      [...document.querySelectorAll("#noteContainer img, .note-content img, [class*='swiper'] img")]
        .map((image) => image.currentSrc || image.src)
        .filter(Boolean)
    );
    return {
      url: location.href,
      documentTitle: document.title,
      metaTitle: document.querySelector("meta[property='og:title']")?.content ?? "",
      metaDescription: document.querySelector("meta[name='description']")?.content
        ?? document.querySelector("meta[property='og:description']")?.content
        ?? "",
      bodyText: document.body?.innerText ?? "",
      contentCandidates: textsFrom(["#detail-desc", ".note-text", ".desc", "[class*='content']"], 12),
      authorCandidates: textsFrom([".author-container", ".username", "[class*='author'] [class*='name']"], 10),
      postAuthorName: text("#noteContainer .author-container .username") || text("#noteContainer .author-container .name"),
      postCaption: text("#detail-desc") || text("#noteContainer .desc"),
      commentThreads,
      imageCount: Math.min(images.size, 30)
    };
  }`);
}

async function parseInspection(inspection: RawPageInspection): Promise<LlmImportResult> {
  const payload = {
    current_url: inspection.url,
    document_title: inspection.documentTitle,
    meta_title: inspection.metaTitle,
    meta_description: inspection.metaDescription,
    content_candidates: inspection.contentCandidates,
    author_candidates: inspection.authorCandidates,
    visible_page_text: inspection.bodyText,
  };
  return modelProvider.chatJson<LlmImportResult>([
    { role: "system", content: extractionPrompt },
    { role: "user", content: JSON.stringify(payload) },
  ]);
}

export async function importXiaohongshuUrl(value: string) {
  const inputUrl = validateXiaohongshuUrl(value).toString();
  return chromeDevtoolsMcpService.runExclusive(async () => {
    const inputPostId = extractXiaohongshuPostId(inputUrl);
    const existing = await prisma.xiaohongshuPost.findFirst({
      where: {
        OR: [
          ...(inputPostId ? [{ externalId: inputPostId }] : []),
          { url: inputUrl },
        ],
      },
    });
    const aliases = [existing?.url, existing?.externalId, inputPostId].filter((item): item is string => Boolean(item));
    const { reused } = await chromeDevtoolsMcpService.ensurePage(inputUrl, { aliases });
    const expandedReplyGroups = await expandLoadedReplyGroups();
    const inspection = await inspectCurrentPage();
    const parsed = await parseInspection(inspection);
    const externalId = extractXiaohongshuPostId(inspection.url)
      ?? inputPostId
      ?? existing?.externalId
      ?? stableId("post", inspection.url);
    const title = cleanText(inspection.metaTitle.replace(/\s*[-|]\s*小红书.*$/i, ""), 500)
      || cleanText(inspection.documentTitle.replace(/\s*[-|]\s*小红书.*$/i, ""), 500)
      || cleanText(parsed.title, 500);
    if (!title) throw routeError("没有从页面读取到帖子标题，请确认页面已经正常打开。", 422);

    const imageCount = defaultImageAltSlots(existing?.imageCount, inspection.imageCount);
    const comments = normalizeImportedCommentThreads(inspection.commentThreads, externalId);
    const syncResult = await syncXiaohongshuAccountMirror([{
      externalId,
      url: inputUrl,
      title,
      caption: cleanText(inspection.postCaption, 12000)
        || cleanText(parsed.caption, 12000)
        || cleanText(inspection.metaDescription, 12000)
        || null,
      authorName: cleanText(inspection.postAuthorName, 240) || cleanText(parsed.author_name, 240) || null,
      postType: normalizeXiaohongshuPostType(parsed.post_type),
      imageCount,
      imageAlts: imageAlts(existing?.imageAlts, imageCount),
      comments,
    }]);

    await prisma.externalPageSnapshot.create({
      data: {
        id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url: inspection.url,
        tool: "chrome-devtools-mcp",
        content: inspection.bodyText,
      },
    });

    return {
      ...syncResult,
      importedPostId: externalId,
      browser: {
        reusedPage: reused,
        pageLeftOpen: true,
        finalUrl: inspection.url,
        automaticScrolling: false,
        automaticExpansion: true,
        expandedReplyGroups,
      },
      warning: comments.length === 0
        ? "当前页面没有读取到已加载评论。页面已保留，可以在 Chrome 中正常浏览评论后再次导入同一 URL。"
        : null,
    };
  });
}
