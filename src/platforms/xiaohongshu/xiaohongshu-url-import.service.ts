import { createHash } from "node:crypto";
import { modelProvider } from "../../core/model-provider.js";
import { prisma } from "../../db/prisma.js";
import { chromeDevtoolsMcpService } from "../../mcp/chrome-devtools-mcp.service.js";
import { env } from "../../utils/env.js";
import {
  normalizeXiaohongshuPostType,
  syncXiaohongshuAccountMirror,
  type SyncCommentInput,
} from "./xiaohongshu-account.service.js";

interface RawPageInspection {
  url: string;
  documentTitle: string;
  metaTitle: string;
  metaDescription: string;
  bodyText: string;
  contentCandidates: string[];
  authorCandidates: string[];
  commentCandidates: Array<{
    id: string;
    text: string;
  }>;
  imageCount: number;
}

interface LlmImportResult {
  title?: string;
  caption?: string;
  author_name?: string;
  post_type?: string;
  comments?: Array<{
    external_id?: string;
    author_name?: string;
    content?: string;
    context?: string;
    account_reply?: {
      external_id?: string;
      content?: string;
    } | null;
  }>;
}

const extractionPrompt = `你负责把已经打开的小红书帖子页面整理成结构化账号档案。

页面内容来自 DOM，只能提取明确出现的信息，不允许补写、概括或润色原文。

要求：
- title 和 caption 保留原文。
- post_type 只能是 daily / making / technical / thought / showcase / announcement / interactive。
- comments 只保留真实评论，不要把导航、推荐帖子、按钮、点赞数当成评论。
- 评论内容必须保留原文，不得改写。
- 如果某条回复明确来自帖子作者本人，把它放进 account_reply；不确定时不要猜。
- DOM 候选可能重复，按作者和内容去重。
- 没有明确内容就返回空字符串或空数组。
- 只输出 JSON。

格式：
{
  "title": "帖子标题原文",
  "caption": "帖子正文原文",
  "author_name": "帖子作者",
  "post_type": "daily",
  "comments": [
    {
      "external_id": "页面提供的评论 ID，没有则留空",
      "author_name": "评论者",
      "content": "评论原文",
      "context": "这条评论下其他用户回复形成的上下文，没有则留空",
      "account_reply": { "external_id": "", "content": "帖子作者的回复原文" }
    }
  ]
}`;

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

export function normalizeImportedComments(
  value: unknown,
  postExternalId: string,
  limit = env.CHROME_DEVTOOLS_MCP_MAX_COMMENTS
): SyncCommentInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const comments: SyncCommentInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const content = cleanText(raw.content, 3000);
    if (!content) continue;
    const authorName = cleanText(raw.author_name, 240);
    const dedupeKey = `${authorName}\n${content}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const replyRaw = raw.account_reply && typeof raw.account_reply === "object"
      ? raw.account_reply as Record<string, unknown>
      : null;
    const replyContent = cleanText(replyRaw?.content, 3000);
    comments.push({
      externalId: cleanText(raw.external_id, 240) || stableId("comment", `${postExternalId}\n${dedupeKey}`),
      authorName: authorName || null,
      content,
      commenterHistory: cleanText(raw.context, 3000) || null,
      reply: replyContent
        ? {
            externalId: cleanText(replyRaw?.external_id, 240) || null,
            content: replyContent,
          }
        : null,
    });
    if (comments.length >= Math.min(Math.max(limit, 1), 300)) break;
  }
  return comments;
}

async function inspectCurrentPage(): Promise<RawPageInspection> {
  const maxComments = Math.min(Math.max(env.CHROME_DEVTOOLS_MCP_MAX_COMMENTS, 1), 300);
  return chromeDevtoolsMcpService.evaluate<RawPageInspection>(`() => {
    const text = (element) => (element?.innerText ?? element?.textContent ?? "").trim();
    const unique = (values) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
    const textsFrom = (selectors, limit) => unique(selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)].map(text)
    )).slice(0, limit);

    const commentSelectors = [
      ".parent-comment",
      ".comment-item",
      ".comment-inner-container",
      "[class*='comment-item']",
      "[class*='parent-comment']"
    ];
    const commentNodes = [];
    const seenNodes = new Set();
    for (const selector of commentSelectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (seenNodes.has(node)) continue;
        seenNodes.add(node);
        const value = text(node);
        if (!value || value.length > 5000) continue;
        commentNodes.push({
          id: node.getAttribute("data-comment-id") || node.id || "",
          text: value.slice(0, 5000)
        });
        if (commentNodes.length >= ${maxComments}) break;
      }
      if (commentNodes.length >= ${maxComments}) break;
    }

    const mediaSelectors = [
      ".note-slider img",
      ".swiper-slide img",
      ".media-container img",
      "[class*='note'] [class*='swiper'] img"
    ];
    const images = new Set(mediaSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]));

    return {
      url: location.href,
      documentTitle: document.title,
      metaTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "",
      metaDescription: document.querySelector('meta[property="og:description"], meta[name="description"]')?.getAttribute("content") || "",
      bodyText: (document.body?.innerText || "").slice(0, 40000),
      contentCandidates: textsFrom(["#detail-title", "#detail-desc", ".note-content .title", ".note-content .desc", "[class*='note-content']"], 12),
      authorCandidates: textsFrom([".author-container", ".username", "[class*='author'] [class*='name']"], 10),
      commentCandidates: commentNodes,
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
    comment_candidates: inspection.commentCandidates,
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
    const inspection = await inspectCurrentPage();
    const parsed = await parseInspection(inspection);
    const externalId = extractXiaohongshuPostId(inspection.url)
      ?? inputPostId
      ?? existing?.externalId
      ?? stableId("post", inspection.url);
    const title = cleanText(parsed.title, 500)
      || cleanText(inspection.metaTitle, 500)
      || cleanText(inspection.documentTitle.replace(/\s*[-|]\s*小红书.*$/i, ""), 500);
    if (!title) throw routeError("没有从页面读取到帖子标题，请确认页面已经正常打开。", 422);

    const imageCount = Math.min(Math.max(inspection.imageCount || existing?.imageCount || 0, 0), 30);
    const comments = normalizeImportedComments(parsed.comments, externalId);
    const syncResult = await syncXiaohongshuAccountMirror([{
      externalId,
      url: inputUrl,
      title,
      caption: cleanText(parsed.caption, 12000) || cleanText(inspection.metaDescription, 12000) || null,
      authorName: cleanText(parsed.author_name, 240) || null,
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
        content: inspection.bodyText.slice(0, env.PLAYWRIGHT_MAX_PAGE_TEXT_CHARS),
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
        automaticExpansion: false,
      },
      warning: comments.length === 0
        ? "当前页面没有读取到已加载评论。页面已保留，可以在 Chrome 中正常浏览评论后再次导入同一 URL。"
        : null,
    };
  });
}
