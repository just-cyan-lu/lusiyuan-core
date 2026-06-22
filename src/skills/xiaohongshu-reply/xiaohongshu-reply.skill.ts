import { modelProvider } from "../../core/model-provider.js";
import { prisma } from "../../db/prisma.js";
import {
  formatExpressionLearningExamples,
  retrieveExpressionLearningExamples,
} from "../../expression-learning/expression-learning.service.js";
import { env } from "../../utils/env.js";
import type { SkillDefinition } from "../skill.types.js";
import {
  loadXiaohongshuReplyConfig,
} from "./xiaohongshu-reply.config.js";
import type {
  XiaohongshuAwareness,
  XiaohongshuBoundary,
  XiaohongshuCommentType,
  XiaohongshuReplyConfig,
  XiaohongshuReplyInput,
  XiaohongshuReplyOutput,
  XiaohongshuReplyRisk,
  XiaohongshuReplyVoice,
} from "./xiaohongshu-reply.types.js";

const skillId = "xiaohongshu_reply" as const;

const risks: XiaohongshuReplyRisk[] = ["ready", "review", "skip"];
const commentTypes: XiaohongshuCommentType[] = [
  "compliment",
  "daily_joke",
  "emotional",
  "identity_question",
  "romance_boundary",
  "tech_question",
  "private_contact",
  "criticism",
  "unclear",
];
const awarenessValues: XiaohongshuAwareness[] = ["aware", "unaware", "uncertain"];
const voices: XiaohongshuReplyVoice[] = ["siyuan", "creator", "hybrid", "no_reply"];
const boundaries: XiaohongshuBoundary[] = ["none", "soft", "clear"];

type LoadedConfig = Awaited<ReturnType<typeof loadXiaohongshuReplyConfig>>;

export function isXiaohongshuReplySkillEnabled(): boolean {
  return env.SKILL_XIAOHONGSHU_REPLY_MODE !== "off";
}

function includes<T extends string>(values: T[], value: unknown, fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

function cleanString(value: unknown, fallback = "", maxChars = 500): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxChars);
}

function buildUserPayload(input: XiaohongshuReplyInput, config: LoadedConfig): string {
  return JSON.stringify(
    {
      post_title: input.postTitle,
      post_caption: input.postCaption ?? "",
      post_type: input.postType,
      comment: input.comment,
      commenter_history: input.commenterHistory ?? "",
      account_mode: config.accountMode,
    },
    null,
    2
  );
}

function normalizeOutput(
  value: unknown,
  config: LoadedConfig
): XiaohongshuReplyOutput {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const risk = includes(risks, raw.risk, "review");
  const reply = risk === "skip"
    ? ""
    : cleanString(raw.reply, "", config.maxReplyChars);
  return {
    risk,
    comment_type: includes(commentTypes, raw.comment_type, "unclear"),
    awareness: includes(awarenessValues, raw.awareness, "uncertain"),
    voice: includes(voices, raw.voice, risk === "skip" ? "no_reply" : "siyuan"),
    boundary: includes(boundaries, raw.boundary, "none"),
    reply,
    reason: cleanString(raw.reason, "LLM 没有提供明确原因，需要人工查看。", 240),
  };
}

export function xiaohongshuReplySkillDefinition(): SkillDefinition {
  const enabled = isXiaohongshuReplySkillEnabled();
  return {
    id: skillId,
    label: "小红书回复",
    category: "platform",
    description:
      "管理小红书帖子、评论和待审核回复草稿。由 LLM 判断评论意图、是否需要回复和回复口吻。",
    accessMode: env.SKILL_XIAOHONGSHU_REPLY_MODE,
    enabled,
    disabledReason: enabled ? null : "SKILL_XIAOHONGSHU_REPLY_MODE=off",
    configKeys: ["SKILL_XIAOHONGSHU_REPLY_MODE"],
    entryPoints: [
      "小红书平台工作台",
      "手动选择评论生成草稿",
      "小红书 Skill 详情里的 prompt 配置",
    ],
    outputContract: [
      "只生成草稿，不自动发送",
      "LLM 必须输出 risk / comment_type / voice / boundary / reply / reason",
      "review 或 skip 不应自动发布",
      "skill 关闭时平台页不能生成草稿",
    ],
    disabledBehavior:
      "调用方必须停止生成小红书回复草稿，并提示 owner 去 Skills 页面开启。",
    profiles: [
      {
        id: "xiaohongshu",
        label: "小红书评论",
        platform: "xiaohongshu",
        description: "小红书评论回复判断、草稿和人工审核流程。",
        enabled,
        implemented: true,
        configKeys: ["SKILL_XIAOHONGSHU_REPLY_MODE"],
        disabledReason: enabled ? null : "SKILL_XIAOHONGSHU_REPLY_MODE=off",
        rulesSummary: [
          "LLM 判断评论意图和是否需要回复。",
          "无意义表情、连续礼貌互动倾向 skip。",
          "私联、现实边界、强质疑和技术问题倾向 review。",
          "所有结果只保存草稿，不自动发送。",
        ],
      },
    ],
  };
}

export async function generateXiaohongshuReplyDraft(
  input: XiaohongshuReplyInput
): Promise<XiaohongshuReplyOutput> {
  if (!isXiaohongshuReplySkillEnabled()) {
    throw new Error("小红书回复 Skill 已关闭。");
  }
  const config = await loadXiaohongshuReplyConfig();
  const learningQuery = [
    `帖子：${input.postTitle}`,
    input.postCaption ? `正文：${input.postCaption}` : "",
    `帖子类型：${input.postType}`,
    `评论：${input.comment}`,
    input.commenterHistory ? `历史互动：${input.commenterHistory}` : "",
  ].filter(Boolean).join("\n");
  const learnedExamples = await retrieveExpressionLearningExamples({
    platform: "xiaohongshu",
    scene: "comment_reply",
    query: learningQuery,
    limit: 4,
  });
  const learnedContext = formatExpressionLearningExamples(learnedExamples);
  const raw = await modelProvider.chatJson<XiaohongshuReplyOutput>([
    {
      role: "system",
      content: learnedContext ? `${config.prompt}\n\n${learnedContext}` : config.prompt,
    },
    {
      role: "user",
      content: buildUserPayload(input, config),
    },
  ]);
  return normalizeOutput(raw, config);
}

export async function generateXiaohongshuReplyDraftForComment(commentId: string) {
  const comment = await prisma.xiaohongshuComment.findUniqueOrThrow({
    where: { id: commentId },
    include: { post: true },
  });

  const output = await generateXiaohongshuReplyDraft({
    postTitle: comment.post.title,
    postCaption: comment.post.caption,
    postType: comment.post.postType,
    comment: comment.content,
    commenterHistory: comment.commenterHistory,
  });

  const replyNeed =
    output.risk === "skip" ? "skip" : output.risk === "review" ? "review" : "needed";
  const commentStatus = output.risk === "skip" ? "skipped" : "drafted";

  const draft = await prisma.xiaohongshuReplyDraft.create({
    data: {
      commentId,
      originalContent: output.reply,
      content: output.reply,
      risk: output.risk,
      commentType: output.comment_type,
      awareness: output.awareness,
      voice: output.voice,
      boundary: output.boundary,
      reason: output.reason,
      status: output.risk === "skip" ? "skipped" : "draft",
    },
  });

  const updatedComment = await prisma.xiaohongshuComment.update({
    where: { id: commentId },
    data: {
      status: commentStatus,
      replyNeed,
    },
    include: {
      post: true,
      drafts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return { output, draft, comment: updatedComment };
}
