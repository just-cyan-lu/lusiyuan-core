import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { runtimeConfig } from "../../config/runtime-settings.service.js";
import { chromeDevtoolsMcpService } from "../../mcp/chrome-devtools-mcp.service.js";
import { recordXiaohongshuFinalDecision } from "./xiaohongshu-account.service.js";
import { validateXiaohongshuUrl } from "./xiaohongshu-url-import.service.js";

const PLATFORM = "xiaohongshu";
const MAX_COMMENT_LENGTH = 4000;

function routeError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function cleanText(value: unknown, max = MAX_COMMENT_LENGTH): string {
  return (typeof value === "string" ? value.trim() : "").slice(0, max);
}

function contentHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

interface PageVerification {
  page: string;
  targetFound: boolean;
  author: string;
  content: string;
  existingMatchCount: number;
  publishedMatchCount?: number;
  publishedReplyExternalId?: string | null;
}

function targetInspectionScript(input: {
  commentExternalId: string;
  authorName: string;
  content: string;
  postAuthorName: string | null;
}) {
  return String.raw`() => {
    const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element) => Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
    const read = (element) => {
      const inner = element.querySelector(":scope > .comment-inner-container") ?? element;
      return {
        author: normalize(inner.querySelector(".author .name")?.textContent),
        content: normalize(inner.querySelector(".content .note-text")?.textContent),
      };
    };
    const externalId = ${JSON.stringify(input.commentExternalId)};
    const target = [...document.querySelectorAll(".comment-item")].find((element) =>
      (element.id || "").replace(/^comment-/, "") === externalId
    );
    if (!target) throw new Error("当前页面没有找到这条已导入的评论；请重新读取帖子后再试。");
    const actual = read(target);
    if (actual.author !== ${JSON.stringify(input.authorName)} || actual.content !== ${JSON.stringify(input.content)}) {
      throw new Error("页面中的评论作者或正文与记录不一致，已停止发布。");
    }
    const parent = target.closest(".parent-comment") ?? target.parentElement;
    const ownerName = ${JSON.stringify(input.postAuthorName ?? "")};
    const replyNodes = [...(parent?.querySelectorAll(".comment-item-sub") ?? [])];
    const existingMatchCount = replyNodes.filter((element) => {
      const reply = read(element);
      const isOwner = [...element.querySelectorAll(".author .tag")]
        .some((tag) => normalize(tag.textContent) === "作者");
      return isOwner && (!ownerName || reply.author === ownerName) && reply.content === ${JSON.stringify(input.content)};
    }).length;
    return {
      page: location.href,
      targetFound: true,
      author: actual.author,
      content: actual.content,
      existingMatchCount,
    };
  }`;
}

function submitScript(content: string) {
  return String.raw`() => {
    const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element) => Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
    const inputs = [
      ...document.querySelectorAll('textarea[placeholder*="回复"], .comment-input textarea, [class*="comment"] textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"]'),
    ].filter(visible);
    const input = inputs.at(-1);
    if (!input) throw new Error("没有找到评论回复输入框；可能需要先手动打开评论区或重新登录。");
    input.focus();
    const value = ${JSON.stringify(content)};
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (!setter) throw new Error("无法填写评论回复内容。");
      setter.call(input, value);
    } else {
      // 小红书当前评论框是 contenteditable 元素。直接改 textContent 不会进入
      // 页面框架的输入状态，发送按钮会一直保持禁用；使用浏览器原生编辑命令。
      document.execCommand("selectAll", false);
      const inserted = document.execCommand("insertText", false, value);
      if (!inserted) input.textContent = value;
    }
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const scopes = [];
    for (let element = input.parentElement; element && scopes.length < 5; element = element.parentElement) scopes.push(element);
    const candidates = scopes.flatMap((scope) => [...scope.querySelectorAll("button, [role=button], div, span")]);
    const publish = candidates.find((element) => visible(element) && ["发布", "发送"].includes(normalize(element.textContent)));
    if (!(publish instanceof HTMLElement)) throw new Error("没有找到当前回复框对应的发布按钮；已停止发布。");
    if ((publish instanceof HTMLButtonElement && publish.disabled) || publish.getAttribute("aria-disabled") === "true") {
      throw new Error("评论发布按钮尚未可用；已停止发布。");
    }
    publish.click();
    return { submitted: true };
  }`;
}

function verificationScript(input: {
  commentExternalId: string;
  content: string;
  postAuthorName: string | null;
  beforeCount: number;
}) {
  return String.raw`() => {
    const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    const ownerName = ${JSON.stringify(input.postAuthorName ?? "")};
    const target = [...document.querySelectorAll(".comment-item")].find((element) =>
      (element.id || "").replace(/^comment-/, "") === ${JSON.stringify(input.commentExternalId)}
    );
    const parent = target?.closest(".parent-comment") ?? target?.parentElement;
    const matches = [...(parent?.querySelectorAll(".comment-item-sub") ?? [])].filter((element) => {
      const inner = element.querySelector(":scope > .comment-inner-container") ?? element;
      const author = normalize(inner.querySelector(".author .name")?.textContent);
      const content = normalize(inner.querySelector(".content .note-text")?.textContent);
      const isOwner = [...inner.querySelectorAll(".author .tag")]
        .some((tag) => normalize(tag.textContent) === "作者");
      return isOwner && (!ownerName || author === ownerName) && content === ${JSON.stringify(input.content)};
    });
    const published = matches.at(-1);
    return {
      page: location.href,
      publishedMatchCount: matches.length,
      publishedReplyExternalId: (published?.id || "").replace(/^comment-/, "") || null,
      beforeCount: ${input.beforeCount},
    };
  }`;
}

export async function publishXiaohongshuReply(input: {
  commentId: string;
  draftId?: string | null;
  content: string;
}) {
  if (!runtimeConfig.XIAOHONGSHU_COMMENT_PUBLISHER_ENABLED) {
    throw routeError("小红书自动发布尚未开启；请先在运行配置中开启。", 409);
  }
  const content = cleanText(input.content);
  if (!content) throw routeError("发布内容不能为空。", 400);

  const comment = await prisma.xiaohongshuComment.findUnique({
    where: { id: input.commentId },
    include: { post: true, drafts: { orderBy: { createdAt: "desc" } } },
  });
  if (!comment) throw routeError("找不到待回复评论。", 404);
  if (comment.isAuthor || comment.status === "replied") {
    throw routeError("这条评论已经是作者回复或已记录为已回复，不能再次自动发布。", 409);
  }
  if (comment.post.source !== "xiaohongshu_sync" || comment.source !== "xiaohongshu_sync") {
    throw routeError("自动发布只允许操作从真实小红书读取的评论。", 403);
  }
  const url = validateXiaohongshuUrl(comment.post.url ?? "").toString();
  const externalId = cleanText(comment.externalId, 240);
  const authorName = cleanText(comment.authorName, 240);
  if (!externalId || !authorName || !comment.content) {
    throw routeError("这条评论缺少页面核验所需的信息，请重新读取帖子后再试。", 409);
  }
  const draftId = cleanText(input.draftId, 200) || null;
  const draft = draftId ? comment.drafts.find((item) => item.id === draftId) : null;
  if (!draftId || !draft) throw routeError("只能发布这条评论已保存的草稿。", 400);
  if (draft.risk === "skip") throw routeError("该草稿被标记为建议不回复，不能自动发布。", 409);
  if (cleanText(draft.content) !== content) {
    throw routeError("草稿已修改但尚未保存；请先只保存草稿，再确认发布。", 409);
  }

  const attempt = await prisma.platformCommentPublishAttempt.create({
    data: {
      platform: PLATFORM,
      commentId: comment.id,
      draftId: draft.id,
      content,
      contentHash: contentHash(content),
      target: {
        url,
        postExternalId: comment.post.externalId,
        commentExternalId: externalId,
        expectedAuthor: authorName,
        expectedComment: comment.content,
      },
      status: "approved",
    },
  });

  let submitted = false;
  let pageConfirmed = false;
  try {
    const verification = await chromeDevtoolsMcpService.runExclusive(async () => {
      await prisma.platformCommentPublishAttempt.update({
        where: { id: attempt.id },
        data: { status: "publishing", startedAt: new Date() },
      });
      await chromeDevtoolsMcpService.ensurePage(url, { aliases: [comment.post.externalId ?? ""], settleMs: 700 });
      const before = await chromeDevtoolsMcpService.evaluate<PageVerification>(targetInspectionScript({
        commentExternalId: externalId,
        authorName,
        content: comment.content,
        postAuthorName: comment.post.authorName,
      }));
      if (before.existingMatchCount > 0) {
        throw new Error("页面上已经存在相同的作者回复；为避免重复发布已停止。请重新读取帖子核对结果。");
      }

      await chromeDevtoolsMcpService.evaluate<{ submitted: boolean }>(submitScript(content));
      submitted = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return chromeDevtoolsMcpService.evaluate<PageVerification>(verificationScript({
        commentExternalId: externalId,
        content,
        postAuthorName: comment.post.authorName,
        beforeCount: before.existingMatchCount,
      }));
    });
    if (verification.publishedMatchCount !== 1 || !verification.publishedReplyExternalId) {
      throw new Error("页面没有确认到刚才发布的回复；请到小红书页面核对，系统已标记为待确认。");
    }
    await prisma.platformCommentPublishAttempt.update({
      where: { id: attempt.id },
      data: { status: "sent", verification: verification as unknown as Prisma.InputJsonValue, completedAt: new Date() },
    });
    pageConfirmed = true;
    const result = await recordXiaohongshuFinalDecision({
      commentId: comment.id,
      draftId: draft.id,
      content,
      outcome: "sent",
      source: "xiaohongshu_publish",
      externalId: verification.publishedReplyExternalId,
    });
    return { ...result, attempt: { id: attempt.id, status: "sent", verification } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pageConfirmed) {
      await prisma.platformCommentPublishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: submitted ? "uncertain" : "failed",
          error: message.slice(0, 4000),
          completedAt: new Date(),
        },
      }).catch(() => undefined);
    }
    throw error;
  }
}
