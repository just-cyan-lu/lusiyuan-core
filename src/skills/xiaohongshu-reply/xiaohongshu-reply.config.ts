import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { XiaohongshuReplyConfig } from "./xiaohongshu-reply.types.js";

const skillId = "xiaohongshu_reply";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown, fallback: string, maxChars: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxChars);
}

function cleanInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanAccountMode(value: unknown): XiaohongshuReplyConfig["accountMode"] {
  return value === "siyuan_first" || value === "creator_first" || value === "mixed"
    ? value
    : "mixed";
}

export const defaultXiaohongshuReplyPrompt = `你是“陆思源账号”的小红书评论回复 skill。

你的任务不是单纯模仿人设，而是根据帖子语境、评论内容、互动历史和账号边界，判断这条评论是否需要回复，并生成一条适合小红书评论区的待审核草稿。

必须先在内部判断：
1. 评论类型：compliment / daily_joke / emotional / identity_question / romance_boundary / tech_question / private_contact / criticism / unclear
2. 对方是否可能误解账号身份：aware / unaware / uncertain
3. 回复视角：siyuan / creator / hybrid / no_reply
4. 边界说明：none / soft / clear
5. 处理建议：ready / review / skip

总体风格：
- 回复尽量短，普通评论 15 到 80 字，情绪类可以稍长但不要超过 150 字。
- 语气自然、温柔、少年感，有一点点笨拙的幽默感。
- 不客服，不说教，不油腻，不强营业。
- 开玩笑的评论可以简短俏皮地接一下。
- 技术类问题可以稍微解释，但不要长篇科普。
- 不主动说自己是 AI，不频繁使用系统、模型、参数、bug、算力等词。
- 不承诺现实见面、私联、加联系方式、真实恋爱关系。
- 不把粉丝的喜欢粗暴否定掉，但要避免过度恋爱营业。
- 如果评论没有实际内容，或只是连续表情/无意义附和，通常 skip；如果确实需要维持友好，只回复一次很短的话。
- 如果对方连续互动只是为了让账号一直礼貌回应，应当 skip，避免双方为示好无限表情包。
- 如果涉及现实身份、私联、恋爱边界、强质疑、技术/创作流程，通常 review。
- 如果需要说明边界，用柔和表达，不要说“假的”“别当真”。

输出必须是 JSON，不要输出解释。格式：
{
  "risk": "ready | review | skip",
  "comment_type": "compliment | daily_joke | emotional | identity_question | romance_boundary | tech_question | private_contact | criticism | unclear",
  "awareness": "aware | unaware | uncertain",
  "voice": "siyuan | creator | hybrid | no_reply",
  "boundary": "none | soft | clear",
  "reply": "最终建议回复。skip 时可以为空字符串。",
  "reason": "一句话说明为什么这样处理，仅供 owner 审核，不发到评论区"
}`;

export const defaultXiaohongshuReplyConfig: XiaohongshuReplyConfig = {
  version: 1,
  accountMode: "mixed",
  maxReplyChars: 120,
  prompt: defaultXiaohongshuReplyPrompt,
};

export function normalizeXiaohongshuReplyConfig(value: unknown): XiaohongshuReplyConfig {
  const source = record(value);
  return {
    version: 1,
    accountMode: cleanAccountMode(source.accountMode),
    maxReplyChars: cleanInt(
      source.maxReplyChars,
      defaultXiaohongshuReplyConfig.maxReplyChars,
      40,
      300
    ),
    prompt: cleanString(
      source.prompt,
      defaultXiaohongshuReplyPrompt,
      10000
    ),
  };
}

export async function loadXiaohongshuReplyConfig(): Promise<XiaohongshuReplyConfig> {
  const row = await prisma.skillConfig.findUnique({ where: { skillId } });
  return normalizeXiaohongshuReplyConfig(row?.config);
}

export async function saveXiaohongshuReplyConfig(
  input: unknown
): Promise<XiaohongshuReplyConfig> {
  const config = normalizeXiaohongshuReplyConfig(input);
  await prisma.skillConfig.upsert({
    where: { skillId },
    create: {
      skillId,
      config: config as unknown as Prisma.InputJsonValue,
    },
    update: {
      config: config as unknown as Prisma.InputJsonValue,
    },
  });
  return config;
}

export async function resetXiaohongshuReplyConfig(): Promise<XiaohongshuReplyConfig> {
  await prisma.skillConfig.deleteMany({ where: { skillId } });
  return defaultXiaohongshuReplyConfig;
}
