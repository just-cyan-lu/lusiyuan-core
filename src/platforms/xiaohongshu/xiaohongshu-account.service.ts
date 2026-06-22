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

function buildCommentContext(comment: {
  content: string;
  commenterHistory: string | null;
  authorName: string | null;
  post: { title: string; caption: string | null; postType: string };
}) {
  return [
    `帖子标题：${comment.post.title}`,
    `帖子类型：${comment.post.postType}`,
    comment.post.caption ? `帖子正文：${comment.post.caption}` : "",
    `评论者：${comment.authorName ?? "未知"}`,
    `评论：${comment.content}`,
    comment.commenterHistory ? `此前互动：${comment.commenterHistory}` : "",
  ].filter(Boolean).join("\n");
}

export async function listXiaohongshuAccountMirror() {
  const posts = await prisma.xiaohongshuPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      comments: {
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        include: {
          drafts: { orderBy: { createdAt: "desc" } },
          reply: true,
        },
      },
    },
  });
  const sourceRefs = posts.flatMap((post) =>
    post.comments.map((comment) => `xiaohongshu_comment:${comment.id}`)
  );
  const examples = sourceRefs.length > 0
    ? await prisma.expressionLearningExample.findMany({ where: { sourceRef: { in: sourceRefs } } })
    : [];
  const learningBySource = new Map(examples.map((example) => [example.sourceRef, example]));
  return posts.map((post) => ({
    ...post,
    comments: post.comments.map((comment) => ({
      ...comment,
      learningExample: learningBySource.get(`xiaohongshu_comment:${comment.id}`) ?? null,
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

export async function recordXiaohongshuFinalDecision(input: FinalDecisionInput) {
  const comment = await prisma.xiaohongshuComment.findUniqueOrThrow({
    where: { id: input.commentId },
    include: {
      post: true,
      drafts: { orderBy: { createdAt: "desc" } },
      reply: true,
    },
  });
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
  const ownerAction = deriveExpressionOwnerAction(draftText, finalText, input.outcome);
  const source = input.source ?? "manual";
  const publishedAt = input.publishedAt instanceof Date
    ? input.publishedAt
    : parseDate(input.publishedAt) ?? (input.outcome === "sent" ? new Date() : null);

  const reply = input.outcome === "sent"
    ? await prisma.xiaohongshuReply.upsert({
        where: { commentId: comment.id },
        create: {
          commentId: comment.id,
          content: finalText,
          externalId: cleanText(input.externalId, 240) || null,
          source,
          publishedAt,
          lastSyncedAt: source === "xiaohongshu_sync" ? new Date() : null,
        },
        update: {
          content: finalText,
          externalId: cleanText(input.externalId, 240) || comment.reply?.externalId || null,
          source,
          publishedAt,
          lastSyncedAt: source === "xiaohongshu_sync" ? new Date() : comment.reply?.lastSyncedAt,
        },
      })
    : null;

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

  const learningExample = await learnExpression({
    sourceRef: `xiaohongshu_comment:${comment.id}`,
    sourceType: "xiaohongshu_comment",
    sourceId: comment.id,
    platform: "xiaohongshu",
    scene: "comment_reply",
    scope: "platform",
    contextText: buildCommentContext(comment),
    draftText,
    finalText: input.outcome === "sent" ? finalText : null,
    outcome: input.outcome,
    ownerAction,
    ownerNote: cleanText(input.ownerNote, 2000) || null,
    metadata: {
      postId: comment.postId,
      commentId: comment.id,
      draftId: draft?.id ?? null,
      replyId: reply?.id ?? null,
      source,
    },
  });

  return {
    posts: await listXiaohongshuAccountMirror(),
    learningExample,
  };
}

export interface SyncReplyInput {
  externalId?: string | null;
  content: string;
  publishedAt?: string | null;
}

export interface SyncCommentInput {
  externalId: string;
  authorName?: string | null;
  content: string;
  commenterHistory?: string | null;
  publishedAt?: string | null;
  reply?: SyncReplyInput | null;
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
  comments?: SyncCommentInput[];
}

export async function syncXiaohongshuAccountMirror(posts: SyncPostInput[]) {
  let postCount = 0;
  let commentCount = 0;
  let replyCount = 0;
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

    for (const commentInput of (item.comments ?? []).slice(0, 500)) {
      const commentExternalId = cleanText(commentInput.externalId, 240);
      const content = cleanText(commentInput.content, 4000);
      if (!commentExternalId || !content) continue;
      const comment = await prisma.xiaohongshuComment.upsert({
        where: { postId_externalId: { postId: post.id, externalId: commentExternalId } },
        create: {
          postId: post.id,
          externalId: commentExternalId,
          authorName: cleanText(commentInput.authorName, 240) || null,
          content,
          commenterHistory: cleanText(commentInput.commenterHistory, 4000) || null,
          source: "xiaohongshu_sync",
          publishedAt: parseDate(commentInput.publishedAt),
          lastSyncedAt: new Date(),
        },
        update: {
          authorName: cleanText(commentInput.authorName, 240) || null,
          content,
          commenterHistory: cleanText(commentInput.commenterHistory, 4000) || null,
          source: "xiaohongshu_sync",
          publishedAt: parseDate(commentInput.publishedAt),
          lastSyncedAt: new Date(),
        },
      });
      commentCount++;

      if (commentInput.reply?.content) {
        const existing = await prisma.expressionLearningExample.findUnique({
          where: { sourceRef: `xiaohongshu_comment:${comment.id}` },
          select: { finalText: true },
        });
        const replyContent = cleanText(commentInput.reply.content, 4000);
        await prisma.xiaohongshuReply.upsert({
          where: { commentId: comment.id },
          create: {
            commentId: comment.id,
            externalId: cleanText(commentInput.reply.externalId, 240) || null,
            content: replyContent,
            source: "xiaohongshu_sync",
            publishedAt: parseDate(commentInput.reply.publishedAt),
            lastSyncedAt: new Date(),
          },
          update: {
            externalId: cleanText(commentInput.reply.externalId, 240) || null,
            content: replyContent,
            source: "xiaohongshu_sync",
            publishedAt: parseDate(commentInput.reply.publishedAt),
            lastSyncedAt: new Date(),
          },
        });
        await prisma.xiaohongshuComment.update({
          where: { id: comment.id },
          data: { status: "replied", replyNeed: "completed" },
        });
        replyCount++;
        if (existing?.finalText !== replyContent) {
          await recordXiaohongshuFinalDecision({
            commentId: comment.id,
            content: replyContent,
            outcome: "sent",
            source: "xiaohongshu_sync",
            externalId: commentInput.reply.externalId,
            publishedAt: commentInput.reply.publishedAt,
          });
          learnedCount++;
        }
      }
    }
  }

  return {
    posts: await listXiaohongshuAccountMirror(),
    imported: { posts: postCount, comments: commentCount, replies: replyCount, learned: learnedCount },
  };
}
