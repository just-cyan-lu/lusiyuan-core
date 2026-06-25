import type { ExpressionLearningExample, Prisma } from "@prisma/client";
import { modelProvider } from "../core/model-provider.js";
import { buildChatPrompt } from "../core/prompt-builder.js";
import { loadPersona } from "../core/persona-loader.js";
import { prisma } from "../db/prisma.js";
import { createMemoryContentHash } from "../embeddings/content-hash.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import {
  searchExpressionLearningEmbeddings,
  upsertExpressionLearningEmbedding,
} from "./pgvector-expression-learning-index.js";
import type {
  ExpressionLearningAnalysis,
  ExpressionLearningDraftInput,
  ExpressionLearningDraftOutput,
  ExpressionLearningInput,
  ExpressionLearningOwnerAction,
  ExpressionLearningPracticeInput,
  ExpressionLearningPracticeQuestion,
  ExpressionLearningRetrievalInput,
  ExpressionLearningStatus,
} from "./expression-learning.types.js";

const analysisPrompt = `你负责分析 owner 如何教陆思源回应外部世界。

你会看到一次完整表达决策：当时的情境、陆思源原草稿、owner 最终回复或不回复决定，以及 owner 可能写下的补充说明。

你的任务是提炼可复用的“表达经验”，不是提取事实记忆，也不是修改陆思源的人格。

规则：
- owner 的补充说明和最终动作是最强证据。
- 不要把偶然用词夸大成长期规则。
- 要解释这次回复在长度、重点、语气、边界和是否回复上的选择。
- 如果最终是不回复，重点分析为什么沉默更合适。
- 经验要能帮助未来相似情境，但不能要求逐字模仿。
- 只输出 JSON。

格式：
{
  "lesson": "一条简洁、可复用的表达经验",
  "reasoning": "为什么从这次差异中得出该经验",
  "strategy": "未来相似情境应采用的回复策略",
  "tone": "适合的语气描述",
  "avoidances": ["应该避免的表达方式"],
  "tags": ["便于检索的中文标签"],
  "confidence": 0.0
}`;

const practiceQuestionPrompt = `你负责给 owner 设计“表达学习”练习题。

目标不是考知识，而是制造一个具体表达情境，让 owner 教陆思源该怎么回应。

规则：
- 情境要具体，有真实语气和上下文。
- 不要要求 owner 暴露隐私。
- 如果是公开平台，问题应适合公开回复；如果是 chat，问题应适合私人聊天。
- draftText 可以给一个陆思源可能会写但仍可被 owner 修正的草稿。
- teachingFocus 要说明这题想训练什么表达能力。
- expectedOwnerInput 要告诉 owner 应该怎么作答。
- 只输出 JSON。

格式：
{
  "contextText": "具体情境",
  "draftText": "陆思源可选草稿，允许为空",
  "teachingFocus": "这题训练的表达能力",
  "expectedOwnerInput": "提示 owner 应该如何回答",
  "tags": ["标签"]
}`;

function cleanText(value: unknown, fallback = "", max = 4000): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function cleanStringList(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, "", 80))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanConfidence(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0.65;
  return Math.min(Math.max(parsed, 0.3), 0.98);
}

function cleanStatus(value: unknown): ExpressionLearningStatus {
  if (value === "pending" || value === "active" || value === "disabled") return value;
  return "active";
}

export function deriveExpressionOwnerAction(
  draftText: string | null | undefined,
  finalText: string | null | undefined,
  outcome: "sent" | "skipped"
): ExpressionLearningOwnerAction {
  if (outcome === "skipped") return "skipped";
  const draft = draftText?.trim() ?? "";
  const final = finalText?.trim() ?? "";
  if (!draft) return "owner_written";
  return draft === final ? "accepted_draft" : "edited_draft";
}

export function normalizeExpressionLearningAnalysis(
  value: unknown,
  input: Pick<ExpressionLearningInput, "outcome" | "ownerAction">
): ExpressionLearningAnalysis {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fallbackLesson = input.outcome === "skipped"
    ? "类似情境不必为了礼貌持续回应，沉默也可以是明确的表达选择。"
    : input.ownerAction === "edited_draft"
      ? "参考 owner 对草稿做出的取舍，优先保留真正需要回应的重点。"
      : "参考 owner 最终采用的长度、重点和语气，但不要机械复制原句。";

  return {
    lesson: cleanText(raw.lesson, fallbackLesson, 500),
    reasoning: cleanText(raw.reasoning, "这条经验来自 owner 的最终表达决定。", 1000),
    strategy: cleanText(raw.strategy, fallbackLesson, 500),
    tone: cleanText(raw.tone, input.outcome === "skipped" ? "克制" : "自然、简洁", 120),
    avoidances: cleanStringList(raw.avoidances),
    tags: cleanStringList(raw.tags),
    confidence: cleanConfidence(raw.confidence),
  };
}

function normalizePracticeQuestion(
  value: unknown,
  input: ExpressionLearningPracticeInput
): ExpressionLearningPracticeQuestion {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const platform = cleanText(input.platform, "general", 80);
  const scene = cleanText(input.scene, "general", 80);
  const focus = cleanText(input.focus, "", 200);
  const fallbackContext = focus
    ? `有人在 ${platform} / ${scene} 场景里提出一个需要“${focus}”的表达问题。`
    : `有人在 ${platform} / ${scene} 场景里提出一个需要陆思源回应的问题。`;
  return {
    platform,
    scene,
    contextText: cleanText(raw.contextText, fallbackContext, 4000),
    draftText: cleanText(raw.draftText, "", 2000) || null,
    teachingFocus: cleanText(raw.teachingFocus, focus || "训练陆思源的表达判断。", 500),
    expectedOwnerInput: cleanText(
      raw.expectedOwnerInput,
      "请写下你希望陆思源最终采用的回复，也可以说明为什么选择不回复。",
      500
    ),
    tags: cleanStringList(raw.tags),
  };
}

function buildAnalysisPayload(input: ExpressionLearningInput): string {
  return JSON.stringify({
    platform: input.platform,
    scene: input.scene,
    scope: input.scope ?? "platform",
    context: input.contextText,
    siyuan_draft: input.draftText ?? "",
    owner_final_reply: input.finalText ?? "",
    outcome: input.outcome,
    owner_action: input.ownerAction,
    owner_note: input.ownerNote ?? "",
  }, null, 2);
}

export function buildExpressionLearningEmbeddingText(
  example: Pick<ExpressionLearningExample,
    "platform" | "scene" | "contextText" | "draftText" | "finalText" | "outcome" |
    "lesson" | "strategy" | "tone" | "avoidances" | "tags">
): string {
  const avoidances = Array.isArray(example.avoidances) ? example.avoidances.join("、") : "";
  const tags = Array.isArray(example.tags) ? example.tags.join("、") : "";
  return [
    `平台：${example.platform}`,
    `场景：${example.scene}`,
    `情境：${example.contextText}`,
    example.draftText ? `原草稿：${example.draftText}` : "",
    example.outcome === "skipped" ? "最终决定：不回复" : `最终回复：${example.finalText ?? ""}`,
    `学到的经验：${example.lesson}`,
    `策略：${example.strategy ?? ""}`,
    `语气：${example.tone ?? ""}`,
    avoidances ? `避免：${avoidances}` : "",
    tags ? `标签：${tags}` : "",
  ].filter(Boolean).join("\n").slice(0, 8000);
}

async function analyze(input: ExpressionLearningInput): Promise<ExpressionLearningAnalysis> {
  try {
    const raw = await modelProvider.chatJson<ExpressionLearningAnalysis>([
      { role: "system", content: analysisPrompt },
      { role: "user", content: buildAnalysisPayload(input) },
    ]);
    return normalizeExpressionLearningAnalysis(raw, input);
  } catch (error) {
    console.warn("Expression learning analysis failed:", error);
    return normalizeExpressionLearningAnalysis({}, input);
  }
}

export async function generateExpressionLearningPracticeQuestion(
  input: ExpressionLearningPracticeInput
): Promise<ExpressionLearningPracticeQuestion> {
  const normalized: ExpressionLearningPracticeInput = {
    platform: cleanText(input.platform, "general", 80),
    scene: cleanText(input.scene, "general", 80),
    focus: cleanText(input.focus, "", 200) || null,
  };
  try {
    const raw = await modelProvider.chatJson<ExpressionLearningPracticeQuestion>([
      { role: "system", content: practiceQuestionPrompt },
      { role: "user", content: JSON.stringify(normalized, null, 2) },
    ]);
    return normalizePracticeQuestion(raw, normalized);
  } catch (error) {
    console.warn("Expression learning practice question failed:", error);
    return normalizePracticeQuestion({}, normalized);
  }
}

export async function generateExpressionLearningDraft(
  input: ExpressionLearningDraftInput
): Promise<ExpressionLearningDraftOutput> {
  const normalized: ExpressionLearningDraftInput = {
    platform: cleanText(input.platform, "general", 80),
    scene: cleanText(input.scene, "general", 80),
    contextText: cleanText(input.contextText, "", 12000),
  };
  if (!normalized.contextText) {
    throw Object.assign(new Error("contextText is required"), { statusCode: 400 });
  }

  const [persona, learnedExamples] = await Promise.all([
    loadPersona(),
    retrieveExpressionLearningExamples({
      platform: normalized.platform,
      scene: normalized.scene,
      query: normalized.contextText,
      limit: 4,
    }),
  ]);
  const learnedContext = formatExpressionLearningExamples(learnedExamples);
  const userMessage = [
    "请根据下面的表达学习情境，生成一版“陆思源可能会写的原草稿”。",
    "",
    `平台：${normalized.platform}`,
    `场景：${normalized.scene}`,
    "",
    "情境：",
    normalized.contextText,
    "",
    learnedContext ? `可参考的既有表达经验：\n${learnedContext}` : "",
    "",
    "要求：",
    "- 只输出回复正文，不要解释、不加标题。",
    "- 这是一版可被 owner 修正的草稿，不需要追求完美。",
    "- 如果情境明显不该回复，也请输出一句克制的短回复草稿，方便 owner 判断和教学。",
  ].filter(Boolean).join("\n");
  const draft = await modelProvider.chat(buildChatPrompt({
    persona,
    memories: [],
    recentMessages: [],
    userMessage,
    channel: normalized.platform,
  }));
  return {
    draftText: cleanText(
      draft.replace(/^草稿[:：]\s*/i, "").replace(/^回复[:：]\s*/i, ""),
      "",
      4000
    ),
    referenceExampleIds: learnedExamples.map((example) => example.id),
  };
}

async function indexExample(example: ExpressionLearningExample): Promise<ExpressionLearningExample> {
  const text = buildExpressionLearningEmbeddingText(example);
  try {
    const embedding = await embeddingProvider.embedText(text);
    await upsertExpressionLearningEmbedding({
      exampleId: example.id,
      embedding,
      provider: embeddingProvider.providerName,
      model: embeddingProvider.model,
      dimensions: embeddingProvider.dimensions,
      contentHash: createMemoryContentHash(text),
    });
    return prisma.expressionLearningExample.update({
      where: { id: example.id },
      data: { embeddingStatus: "ready", embeddingError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Expression learning embedding failed:", message);
    return prisma.expressionLearningExample.update({
      where: { id: example.id },
      data: { embeddingStatus: "failed", embeddingError: message.slice(0, 500) },
    });
  }
}

export async function learnExpression(input: ExpressionLearningInput) {
  const normalized: ExpressionLearningInput = {
    ...input,
    sourceRef: cleanText(input.sourceRef, "", 240),
    sourceType: cleanText(input.sourceType, "unknown", 80),
    sourceId: cleanText(input.sourceId, "", 160) || null,
    platform: cleanText(input.platform, "unknown", 80),
    scene: cleanText(input.scene, "general", 80),
    scope: input.scope ?? "platform",
    contextText: cleanText(input.contextText, "", 12000),
    draftText: cleanText(input.draftText, "", 4000) || null,
    finalText: cleanText(input.finalText, "", 4000) || null,
    ownerNote: cleanText(input.ownerNote, "", 2000) || null,
    status: cleanStatus(input.status),
  };
  if (!normalized.sourceRef || !normalized.contextText) {
    throw Object.assign(new Error("sourceRef and contextText are required"), { statusCode: 400 });
  }
  if (normalized.outcome === "sent" && !normalized.finalText) {
    throw Object.assign(new Error("finalText is required for sent outcomes"), { statusCode: 400 });
  }

  const analysis = await analyze(normalized);
  const data = {
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId ?? null,
    platform: normalized.platform,
    scene: normalized.scene,
    scope: normalized.scope ?? "platform",
    contextText: normalized.contextText,
    draftText: normalized.draftText ?? null,
    finalText: normalized.finalText ?? null,
    outcome: normalized.outcome,
    ownerAction: normalized.ownerAction,
    ownerNote: normalized.ownerNote ?? null,
    lesson: analysis.lesson,
    reasoning: analysis.reasoning,
    strategy: analysis.strategy,
    tone: analysis.tone,
    avoidances: analysis.avoidances,
    tags: analysis.tags,
    confidence: analysis.confidence,
    status: normalized.status,
    analysisVersion: 1,
    embeddingStatus: "pending",
    embeddingError: null,
    metadata: normalized.metadata
      ? normalized.metadata as Prisma.InputJsonObject
      : undefined,
  };

  const example = await prisma.expressionLearningExample.upsert({
    where: { sourceRef: normalized.sourceRef },
    create: { sourceRef: normalized.sourceRef, ...data },
    update: data,
  });
  return indexExample(example);
}

function rankRecentExamples(examples: ExpressionLearningExample[], scene: string) {
  return [...examples].sort((a, b) => {
    const sceneDifference = Number(b.scene === scene) - Number(a.scene === scene);
    return sceneDifference || b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function buildExpressionLearningRetrievalWhere(
  input: Pick<ExpressionLearningRetrievalInput, "platform" | "scene">
): Prisma.ExpressionLearningExampleWhereInput {
  return {
    status: "active",
    OR: [
      { scope: "global" },
      { platform: input.platform, scope: "platform" },
      { platform: input.platform, scene: input.scene, scope: "scene" },
    ],
  };
}

export async function retrieveExpressionLearningExamples(
  input: ExpressionLearningRetrievalInput
): Promise<ExpressionLearningExample[]> {
  const limit = Math.min(Math.max(input.limit ?? 4, 1), 8);
  let examples: ExpressionLearningExample[] = [];
  const recent = await prisma.expressionLearningExample.findMany({
    where: buildExpressionLearningRetrievalWhere(input),
    orderBy: { createdAt: "desc" },
    take: limit * 3,
  });
  if (recent.length === 0) return [];

  try {
    const queryEmbedding = await embeddingProvider.embedText(input.query.slice(0, 6000));
    const matches = await searchExpressionLearningEmbeddings({
      embedding: queryEmbedding,
      provider: embeddingProvider.providerName,
      model: embeddingProvider.model,
      dimensions: embeddingProvider.dimensions,
      platform: input.platform,
      scene: input.scene,
      limit: limit * 3,
    });
    if (matches.length > 0) {
      const rows = await prisma.expressionLearningExample.findMany({
        where: { id: { in: matches.map((match) => match.exampleId) } },
      });
      const scoreMap = new Map(matches.map((match) => [match.exampleId, match.score]));
      examples = rows
        .sort((a, b) => {
          const aScore = (scoreMap.get(a.id) ?? 0) + (a.scene === input.scene ? 0.08 : 0);
          const bScore = (scoreMap.get(b.id) ?? 0) + (b.scene === input.scene ? 0.08 : 0);
          return bScore - aScore;
        })
        .slice(0, limit);
    }
  } catch (error) {
    console.warn("Expression learning retrieval fell back to recent examples:", error);
  }

  if (examples.length === 0) {
    examples = rankRecentExamples(recent, input.scene).slice(0, limit);
  }

  if (examples.length > 0) {
    await prisma.expressionLearningExample.updateMany({
      where: { id: { in: examples.map((example) => example.id) } },
      data: { lastUsedAt: new Date(), accessCount: { increment: 1 } },
    });
  }
  return examples;
}

export function formatExpressionLearningExamples(examples: ExpressionLearningExample[]): string {
  if (examples.length === 0) return "";
  const blocks = examples.map((example, index) => [
    `经验 ${index + 1}（${example.platform} / ${example.scene}）`,
    `当时情境：${example.contextText.slice(0, 700)}`,
    example.outcome === "skipped" ? "owner 最终选择：不回复" : `owner 最终回复：${example.finalText ?? ""}`,
    `学到的经验：${example.lesson}`,
    example.strategy ? `建议策略：${example.strategy}` : "",
  ].filter(Boolean).join("\n"));
  return `以下是 owner 过去教过的相似表达经验。只参考判断、长度和语气，不要照抄原句：\n\n${blocks.join("\n\n")}`;
}

export async function reanalyzeExpressionLearningExample(id: string) {
  const example = await prisma.expressionLearningExample.findUniqueOrThrow({ where: { id } });
  return learnExpression({
    sourceRef: example.sourceRef,
    sourceType: example.sourceType,
    sourceId: example.sourceId,
    platform: example.platform,
    scene: example.scene,
    scope: example.scope as ExpressionLearningInput["scope"],
    contextText: example.contextText,
    draftText: example.draftText,
    finalText: example.finalText,
    outcome: example.outcome as ExpressionLearningInput["outcome"],
    ownerAction: example.ownerAction as ExpressionLearningInput["ownerAction"],
    ownerNote: example.ownerNote,
    status: example.status as ExpressionLearningInput["status"],
    metadata: example.metadata as Record<string, unknown> | null,
  });
}

export async function reindexExpressionLearningExample(id: string) {
  const example = await prisma.expressionLearningExample.findUniqueOrThrow({ where: { id } });
  await prisma.expressionLearningExample.update({
    where: { id },
    data: { embeddingStatus: "pending", embeddingError: null },
  });
  return indexExample(example);
}

export const expressionLearningService = {
  learn: learnExpression,
  generateDraft: generateExpressionLearningDraft,
  generatePracticeQuestion: generateExpressionLearningPracticeQuestion,
  retrieve: retrieveExpressionLearningExamples,
  reanalyze: reanalyzeExpressionLearningExample,
  reindex: reindexExpressionLearningExample,
};
