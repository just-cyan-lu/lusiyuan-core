import { prisma } from "../../db/prisma.js";
import {
  deriveExpressionOwnerAction,
  learnExpression,
} from "../../expression-learning/expression-learning.service.js";
import type { ExpressionLearningOutcome } from "../../expression-learning/expression-learning.types.js";

export const xiaohongshuPostTypes = [
  "daily",
  "making",
  "technical",
  "thought",
  "showcase",
  "announcement",
  "interactive",
] as const;

export type XiaohongshuPostType = typeof xiaohongshuPostTypes[number];

export const xiaohongshuPostTypeLabels: Record<XiaohongshuPostType, string> = {
  daily: "日常分享",
  making: "创作过程",
  technical: "技术制作",
  thought: "想法与感受",
  showcase: "作品展示",
  announcement: "账号动态",
  interactive: "互动讨论",
};

export function normalizeXiaohongshuPostType(value: unknown): XiaohongshuPostType {
  return xiaohongshuPostTypes.includes(value as XiaohongshuPostType)
    ? value as XiaohongshuPostType
    : "daily";
}

function cleanText(value: unknown, max = 10000): string {
  return (typeof value === "string" ? value.trim() : "").slice(0, max);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatThreadLine(comment: {
  authorName: string | null;
  content: string;
  isAuthor: boolean;
  replyToAuthorName: string | null;
}) {
  const author = comment.authorName ?? "未知用户";
  const role = comment.isAuthor ? "（作者）" : "";
  const target = comment.replyToAuthorName ? ` 回复 ${comment.replyToAuthorName}` : "";
  return `${author}${role}${target}：${comment.content}`;
}

export async function getXiaohongshuCommentThreadContext(commentId: string) {
  const comment = await prisma.xiaohongshuComment.findUniqueOrThrow({
    where: { id: commentId },
    include: {
      post: true,
      drafts: { orderBy: { createdAt: "desc" } },
    },
  });
  const rootId = comment.parentId ?? comment.id;
  const thread = await prisma.xiaohongshuComment.findMany({
    where: { OR: [{ id: rootId }, { parentId: rootId }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return {
    comment,
    rootId,
    thread,
    threadContext: thread.map(formatThreadLine).join("\n"),
  };
}

export async function listXiaohongshuAccountMirror() {
  const posts = await prisma.xiaohongshuPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      comments: {
        where: { parentId: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          drafts: { orderBy: { createdAt: "desc" } },
          replies: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: { drafts: { orderBy: { createdAt: "desc" } } },
          },
        },
      },
    },
  });
  const allComments = posts.flatMap((post) =>
    post.comments.flatMap((comment) => [comment, ...comment.replies])
  );
  const sourceRefs = allComments.map((comment) => `xiaohongshu_comment:${comment.id}`);
  const examples = sourceRefs.length > 0
    ? await prisma.expressionLearningExample.findMany({ where: { sourceRef: { in: sourceRefs } } })
    : [];
  const learningBySource = new Map(examples.map((example) => [example.sourceRef, example]));
  return posts.map((post) => ({
    ...post,
    comments: post.comments.map((comment) => ({
      ...comment,
      learningExample: learningBySource.get(`xiaohongshu_comment:${comment.id}`) ?? null,
      replies: comment.replies.map((reply) => ({
        ...reply,
        replies: [],
        learningExample: learningBySource.get(`xiaohongshu_comment:${reply.id}`) ?? null,
      })),
    })),
  }));
}

interface FinalDecisionInput {
  commentId: string;
  draftId?: string | null;
  content?: string | null;
  outcome: ExpressionLearningOutcome;
  ownerNote?: string | null;
  source?: "manual" | "xiaohongshu_sync";
  externalId?: string | null;
  publishedAt?: string | Date | null;
}

async function learnFromFinalReply(input: {
  targetCommentId: string;
  replyCommentId: string | null;
  finalText: string;
  outcome: ExpressionLearningOutcome;
  draftText: string | null;
  draftId: string | null;
  ownerNote: string | null;
  source: "manual" | "xiaohongshu_sync";
}) {
  const { comment, threadContext } = await getXiaohongshuCommentThreadContext(input.targetCommentId);
  const ownerAction = deriveExpressionOwnerAction(input.draftText, input.finalText, input.outcome);
  return learnExpression({
    sourceRef: `xiaohongshu_comment:${comment.id}`,
    sourceType: "xiaohongshu_comment",
    sourceId: comment.id,
    scene: "reply",
    contextText: [
      `帖子标题：${comment.post.title}`,
      `帖子类型：${comment.post.postType}`,
      comment.post.caption ? `帖子正文：${comment.post.caption}` : "",
      `评论线程：\n${threadContext}`,
      `本次回复目标：${formatThreadLine(comment)}`,
    ].filter(Boolean).join("\n"),
    draftText: input.draftText,
    finalText: input.outcome === "sent" ? input.finalText : null,
    outcome: input.outcome,
    ownerAction,
    ownerNote: input.ownerNote,
    metadata: {
      postId: comment.postId,
      commentId: comment.id,
      draftId: input.draftId,
      replyCommentId: input.replyCommentId,
      source: input.source,
      sourcePlatform: "xiaohongshu",
    },
  });
}

export async function recordXiaohongshuFinalDecision(input: FinalDecisionInput) {
  const { comment, rootId } = await getXiaohongshuCommentThreadContext(input.commentId);
  if (comment.isAuthor) {
    throw Object.assign(new Error("作者自己的回复不能再次记录为回复目标"), { statusCode: 400 });
  }
  const draft = input.draftId
    ? comment.drafts.find((item) => item.id === input.draftId)
    : null;
  if (input.draftId && !draft) {
    throw Object.assign(new Error("回复草稿不属于这条评论"), { statusCode: 400 });
  }

  const finalText = cleanText(input.content, 4000);
  if (input.outcome === "sent" && !finalText) {
    throw Object.assign(new Error("记录已发布回复时，回复内容不能为空"), { statusCode: 400 });
  }
  const draftText = draft?.originalContent || draft?.content || null;
  const source = input.source ?? "manual";
  const publishedAt = input.publishedAt instanceof Date
    ? input.publishedAt
    : parseDate(input.publishedAt) ?? (input.outcome === "sent" ? new Date() : null);

  let replyCommentId: string | null = null;
  if (input.outcome === "sent") {
    const externalId = cleanText(input.externalId, 240) || null;
    const existingReply = externalId
      ? await prisma.xiaohongshuComment.findUnique({
          where: { postId_externalId: { postId: comment.postId, externalId } },
        })
      : await prisma.xiaohongshuComment.findFirst({
          where: { replyToId: comment.id, isAuthor: true },
          orderBy: { updatedAt: "desc" },
        });
    const lastReply = await prisma.xiaohongshuComment.findFirst({
      where: { parentId: rootId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const reply = existingReply
      ? await prisma.xiaohongshuComment.update({
          where: { id: existingReply.id },
          data: {
            content: finalText,
            externalId: externalId ?? existingReply.externalId,
            authorName: comment.post.authorName ?? "陆思源 Cyan",
            isAuthor: true,
            parentId: rootId,
            replyToId: comment.id,
            replyToAuthorName: comment.authorName,
            replyToAuthorUserId: comment.authorUserId,
            status: "published",
            replyNeed: "not_applicable",
            source,
            publishedAt,
            lastSyncedAt: source === "xiaohongshu_sync" ? new Date() : existingReply.lastSyncedAt,
          },
        })
      : await prisma.xiaohongshuComment.create({
          data: {
            postId: comment.postId,
            parentId: rootId,
            replyToId: comment.id,
            externalId,
            authorName: comment.post.authorName ?? "陆思源 Cyan",
            content: finalText,
            isAuthor: true,
            replyToAuthorName: comment.authorName,
            replyToAuthorUserId: comment.authorUserId,
            sortOrder: (lastReply?.sortOrder ?? 0) + 1,
            status: "published",
            replyNeed: "not_applicable",
            source,
            publishedAt,
            lastSyncedAt: source === "xiaohongshu_sync" ? new Date() : null,
          },
        });
    replyCommentId = reply.id;
  }

  await prisma.$transaction([
    prisma.xiaohongshuComment.update({
      where: { id: comment.id },
      data: {
        status: input.outcome === "sent" ? "replied" : "skipped",
        replyNeed: input.outcome === "sent" ? "completed" : "skip",
      },
    }),
    ...(draft
      ? [prisma.xiaohongshuReplyDraft.update({
          where: { id: draft.id },
          data: {
            content: input.outcome === "sent" ? finalText : draft.content,
            status: input.outcome === "sent" ? "published" : "rejected",
          },
        })]
      : []),
  ]);

  const learningExample = await learnFromFinalReply({
    targetCommentId: comment.id,
    replyCommentId,
    finalText,
    outcome: input.outcome,
    draftText,
    draftId: draft?.id ?? null,
    ownerNote: cleanText(input.ownerNote, 2000) || null,
    source,
  });

  return {
    posts: await listXiaohongshuAccountMirror(),
    learningExample,
  };
}

export interface SyncCommentInput {
  externalId: string;
  authorName?: string | null;
  authorUserId?: string | null;
  content: string;
  isAuthor?: boolean;
  replyToExternalId?: string | null;
  replyToAuthorName?: string | null;
  replyToAuthorUserId?: string | null;
  sortOrder?: number;
  publishedAt?: string | null;
}

export interface SyncCommentThreadInput extends SyncCommentInput {
  replies?: SyncCommentInput[];
}

export interface SyncPostInput {
  externalId: string;
  url?: string | null;
  title: string;
  caption?: string | null;
  authorName?: string | null;
  postType?: string | null;
  imageCount?: number;
  imageAlts?: string[];
  publishedAt?: string | null;
  comments?: SyncCommentThreadInput[];
}

function commentData(input: SyncCommentInput) {
  return {
    authorName: cleanText(input.authorName, 240) || null,
    authorUserId: cleanText(input.authorUserId, 240) || null,
    content: cleanText(input.content, 4000),
    isAuthor: Boolean(input.isAuthor),
    replyToAuthorName: cleanText(input.replyToAuthorName, 240) || null,
    replyToAuthorUserId: cleanText(input.replyToAuthorUserId, 240) || null,
    sortOrder: Math.max(0, Math.trunc(input.sortOrder ?? 0)),
    source: "xiaohongshu_sync",
    publishedAt: parseDate(input.publishedAt),
    lastSyncedAt: new Date(),
  };
}

export async function syncXiaohongshuAccountMirror(posts: SyncPostInput[]) {
  let postCount = 0;
  let threadCount = 0;
  let commentCount = 0;
  let replyCount = 0;
  let authorReplyCount = 0;
  let learnedCount = 0;

  for (const item of posts.slice(0, 100)) {
    const externalId = cleanText(item.externalId, 240);
    const title = cleanText(item.title, 500);
    if (!externalId || !title) continue;
    const post = await prisma.xiaohongshuPost.upsert({
      where: { externalId },
      create: {
        externalId,
        title,
        caption: cleanText(item.caption) || null,
        authorName: cleanText(item.authorName, 240) || null,
        url: cleanText(item.url, 1000) || null,
        postType: normalizeXiaohongshuPostType(item.postType),
        imageCount: Math.min(Math.max(item.imageCount ?? 0, 0), 30),
        imageAlts: item.imageAlts ?? [],
        source: "xiaohongshu_sync",
        publishedAt: parseDate(item.publishedAt),
        lastSyncedAt: new Date(),
      },
      update: {
        title,
        caption: cleanText(item.caption) || null,
        authorName: cleanText(item.authorName, 240) || null,
        url: cleanText(item.url, 1000) || null,
        postType: normalizeXiaohongshuPostType(item.postType),
        imageCount: Math.min(Math.max(item.imageCount ?? 0, 0), 30),
        imageAlts: item.imageAlts ?? [],
        source: "xiaohongshu_sync",
        publishedAt: parseDate(item.publishedAt),
        lastSyncedAt: new Date(),
      },
    });
    postCount++;

    for (const threadInput of (item.comments ?? []).slice(0, 500)) {
      const rootExternalId = cleanText(threadInput.externalId, 240);
      const rootContent = cleanText(threadInput.content, 4000);
      if (!rootExternalId || !rootContent) continue;
      const root = await prisma.xiaohongshuComment.upsert({
        where: { postId_externalId: { postId: post.id, externalId: rootExternalId } },
        create: {
          postId: post.id,
          externalId: rootExternalId,
          ...commentData(threadInput),
          status: threadInput.isAuthor ? "published" : "pending",
          replyNeed: threadInput.isAuthor ? "not_applicable" : "unknown",
        },
        update: {
          ...commentData(threadInput),
          parentId: null,
          replyToId: null,
        },
      });
      threadCount++;
      commentCount++;

      const nodesByExternalId = new Map<string, { id: string; isAuthor: boolean }>([
        [rootExternalId, { id: root.id, isAuthor: root.isAuthor }],
      ]);
      const syncedReplies: Array<{ input: SyncCommentInput; id: string; externalId: string }> = [];
      for (const replyInput of (threadInput.replies ?? []).slice(0, 499)) {
        const replyExternalId = cleanText(replyInput.externalId, 240);
        const replyContent = cleanText(replyInput.content, 4000);
        if (!replyExternalId || !replyContent) continue;
        const reply = await prisma.xiaohongshuComment.upsert({
          where: { postId_externalId: { postId: post.id, externalId: replyExternalId } },
          create: {
            postId: post.id,
            parentId: root.id,
            externalId: replyExternalId,
            ...commentData(replyInput),
            status: replyInput.isAuthor ? "published" : "pending",
            replyNeed: replyInput.isAuthor ? "not_applicable" : "unknown",
          },
          update: {
            ...commentData(replyInput),
            parentId: root.id,
          },
        });
        nodesByExternalId.set(replyExternalId, { id: reply.id, isAuthor: reply.isAuthor });
        syncedReplies.push({ input: replyInput, id: reply.id, externalId: replyExternalId });
        commentCount++;
        replyCount++;
      }

      for (const synced of syncedReplies) {
        const targetExternalId = cleanText(synced.input.replyToExternalId, 240) || rootExternalId;
        const target = nodesByExternalId.get(targetExternalId) ?? nodesByExternalId.get(rootExternalId);
        if (!target) continue;
        await prisma.xiaohongshuComment.update({
          where: { id: synced.id },
          data: { replyToId: target.id },
        });
        if (!synced.input.isAuthor || target.isAuthor) continue;

        const targetComment = await prisma.xiaohongshuComment.update({
          where: { id: target.id },
          data: { status: "replied", replyNeed: "completed" },
        });
        authorReplyCount++;
        const finalText = cleanText(synced.input.content, 4000);
        const existing = await prisma.expressionLearningExample.findUnique({
          where: { sourceRef: `xiaohongshu_comment:${targetComment.id}` },
          select: { finalText: true },
        });
        if (existing?.finalText !== finalText) {
          await learnFromFinalReply({
            targetCommentId: targetComment.id,
            replyCommentId: synced.id,
            finalText,
            outcome: "sent",
            draftText: null,
            draftId: null,
            ownerNote: null,
            source: "xiaohongshu_sync",
          });
          learnedCount++;
        }
      }
    }
  }

  return {
    posts: await listXiaohongshuAccountMirror(),
    imported: {
      posts: postCount,
      threads: threadCount,
      comments: commentCount,
      replies: replyCount,
      authorReplies: authorReplyCount,
      learned: learnedCount,
    },
  };
}
