import type { ExpressionLearningExample, ExpressionLearningRule, Prisma } from "@prisma/client";
import { expressionLearningModelProvider } from "../core/model-provider.js";
import { prisma } from "../db/prisma.js";
import {
  attachExpressionLearningPublicationStates,
  unpublishExpressionLearningRule,
} from "./expression-learning-publication.js";

export type ExpressionLearningRuleKind = "avoid" | "prefer" | "strategy";
export type ExpressionLearningRuleScope = "global" | "scene";
export type ExpressionLearningRuleStrength = "hard" | "soft";
export type ExpressionLearningRuleStatus = "draft" | "active" | "disabled";
export type ExpressionLearningEvidenceCoverage = "partial" | "full";

export interface ExpressionLearningRuleCandidate {
  ruleText: string;
  kind: ExpressionLearningRuleKind;
  scope: ExpressionLearningRuleScope;
  scene: string | null;
  strength: ExpressionLearningRuleStrength;
  coverage: ExpressionLearningEvidenceCoverage;
  reason: string;
}

export interface ExpressionLearningRuleInput {
  ruleText: string;
  kind?: string;
  scope?: string;
  scene?: string | null;
  strength?: string;
  status?: string;
  source?: string;
  exampleIds?: string[];
  coverage?: string;
  metadata?: Record<string, unknown> | null;
}

const distillationPrompt = `你负责把一条珍贵的原始表达经验，提炼成可以跨对话稳定执行的表达规则。

规则：
- 原始经验必须继续保留；你只提出一条最值得独立执行的规则。
- owner 补充说明里的明确禁令优先级最高。如果 owner 使用“一定不要、绝不、任何时候”等措辞，并且禁令对象本身不依赖当前情境，必须把它单独提炼成 global + avoid + hard；不要和本题的短句、语气或回复策略揉成一条规则。
- 例如“🤝 这个表情太老气，一定不要使用”应提炼为全局硬规则“不要使用 🤝 表情，它会让表达显得老气”，不能限定为评论回复场景。
- 如果内容适用于任何聊天或回复，scope 使用 global，scene 为 null。
- 只有明确依赖私聊或公开评论时，scope 才使用 scene，并从 general/chat/reply 选择 scene。
- kind 只能是 avoid、prefer、strategy。
- strength 只有在 owner 明确表达“一定、不要、必须、绝不”等要求时才用 hard，否则用 soft。
- coverage 表示该规则是否完整覆盖原经验；原经验还包含具体回复偏好时通常为 partial。
- ruleText 只表达一个判断，写成直接、清楚、可执行的中文规则，不要包含具体题目背景。
- 只输出 JSON。

格式：
{
  "ruleText": "规则正文",
  "kind": "avoid|prefer|strategy",
  "scope": "global|scene",
  "scene": null,
  "strength": "hard|soft",
  "coverage": "partial|full",
  "reason": "为什么这样提炼"
}`;

function cleanText(value: unknown, fallback = "", max = 4000): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function cleanScene(value: unknown): string | null {
  const scene = cleanText(value, "", 80);
  return ["general", "chat", "reply"].includes(scene) ? scene : null;
}

export function normalizeExpressionLearningRuleCandidate(
  value: unknown,
  example: Pick<ExpressionLearningExample, "scene" | "lesson" | "strategy" | "ownerNote">
): ExpressionLearningRuleCandidate {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const scope = oneOf(raw.scope, ["global", "scene"] as const, "scene");
  return {
    ruleText: cleanText(raw.ruleText, example.ownerNote || example.lesson || example.strategy || "", 1000),
    kind: oneOf(raw.kind, ["avoid", "prefer", "strategy"] as const, "strategy"),
    scope,
    scene: scope === "global" ? null : cleanScene(raw.scene) ?? cleanScene(example.scene) ?? "general",
    strength: oneOf(raw.strength, ["hard", "soft"] as const, "soft"),
    coverage: oneOf(raw.coverage, ["partial", "full"] as const, "partial"),
    reason: cleanText(raw.reason, "这条规则由原始表达经验提炼而来。", 1200),
  };
}

export async function proposeExpressionLearningRule(exampleId: string) {
  const example = await prisma.expressionLearningExample.findUniqueOrThrow({ where: { id: exampleId } });
  const payload = {
    scene: example.scene,
    context: example.contextText,
    siyuan_draft: example.draftText,
    owner_final_reply: example.finalText,
    outcome: example.outcome,
    owner_note: example.ownerNote,
    learned_lesson: example.lesson,
    strategy: example.strategy,
    avoidances: example.avoidances,
  };
  try {
    const raw = await expressionLearningModelProvider.chatJson<ExpressionLearningRuleCandidate>([
      { role: "system", content: distillationPrompt },
      { role: "user", content: JSON.stringify(payload, null, 2) },
    ]);
    return normalizeExpressionLearningRuleCandidate(raw, example);
  } catch (error) {
    console.warn("Expression rule distillation failed:", error);
    return normalizeExpressionLearningRuleCandidate({}, example);
  }
}

function normalizeRuleInput(input: ExpressionLearningRuleInput) {
  const scope = oneOf(input.scope, ["global", "scene"] as const, "global");
  return {
    ruleText: cleanText(input.ruleText, "", 1000),
    kind: oneOf(input.kind, ["avoid", "prefer", "strategy"] as const, "strategy"),
    scope,
    scene: scope === "global" ? null : cleanScene(input.scene) ?? "general",
    strength: oneOf(input.strength, ["hard", "soft"] as const, "soft"),
    status: oneOf(input.status, ["draft", "active", "disabled"] as const, "draft"),
    source: oneOf(input.source, ["manual", "distilled", "markdown"] as const, "manual"),
    coverage: oneOf(input.coverage, ["partial", "full"] as const, "partial"),
    exampleIds: [...new Set((input.exampleIds ?? []).filter(Boolean))],
    metadata: input.metadata ? input.metadata as Prisma.InputJsonObject : undefined,
  };
}

export async function listExpressionLearningRules(input: {
  status?: string;
  scope?: string;
  scene?: string;
  query?: string;
  limit?: number;
}) {
  const where: Prisma.ExpressionLearningRuleWhereInput = {};
  if (input.status && input.status !== "all") where.status = input.status;
  if (input.scope && input.scope !== "all") where.scope = input.scope;
  if (input.scene && input.scene !== "all") where.scene = input.scene;
  if (input.query) where.ruleText = { contains: input.query, mode: "insensitive" };
  const [rules, total, active, draft] = await Promise.all([
    prisma.expressionLearningRule.findMany({
      where,
      include: {
        evidences: {
          include: { example: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: Math.min(Math.max(input.limit ?? 200, 1), 300),
    }),
    prisma.expressionLearningRule.count(),
    prisma.expressionLearningRule.count({ where: { status: "active" } }),
    prisma.expressionLearningRule.count({ where: { status: "draft" } }),
  ]);
  return {
    rules: await attachExpressionLearningPublicationStates(rules),
    summary: { total, active, draft },
  };
}

export async function createExpressionLearningRule(input: ExpressionLearningRuleInput) {
  const normalized = normalizeRuleInput(input);
  if (!normalized.ruleText) {
    throw Object.assign(new Error("ruleText is required"), { statusCode: 400 });
  }
  return prisma.expressionLearningRule.create({
    data: {
      ruleText: normalized.ruleText,
      kind: normalized.kind,
      scope: normalized.scope,
      scene: normalized.scene,
      strength: normalized.strength,
      status: normalized.status,
      source: normalized.source,
      metadata: normalized.metadata,
      evidences: normalized.exampleIds.length > 0 ? {
        create: normalized.exampleIds.map((exampleId) => ({
          exampleId,
          coverage: normalized.coverage,
          relation: "supports",
        })),
      } : undefined,
    },
    include: { evidences: { include: { example: true } } },
  });
}

export async function updateExpressionLearningRule(id: string, input: ExpressionLearningRuleInput) {
  const normalized = normalizeRuleInput(input);
  if (!normalized.ruleText) {
    throw Object.assign(new Error("ruleText is required"), { statusCode: 400 });
  }
  const current = await prisma.expressionLearningRule.findUniqueOrThrow({ where: { id } });
  if (current.publishedAt && (normalized.status !== "active" || normalized.scope !== "global")) {
    await unpublishExpressionLearningRule(id);
  }
  return prisma.expressionLearningRule.update({
    where: { id },
    data: {
      ruleText: normalized.ruleText,
      kind: normalized.kind,
      scope: normalized.scope,
      scene: normalized.scene,
      strength: normalized.strength,
      status: normalized.status,
    },
    include: { evidences: { include: { example: true } } },
  });
}

export async function retrieveExpressionLearningRules(scene: string): Promise<ExpressionLearningRule[]> {
  const normalizedScene = cleanScene(scene) ?? "general";
  return prisma.expressionLearningRule.findMany({
    where: {
      status: "active",
      publishedAt: null,
      OR: [
        { scope: "global" },
        { scope: "scene", scene: { in: ["general", normalizedScene] } },
      ],
    },
    orderBy: [{ strength: "asc" }, { updatedAt: "desc" }],
    take: 40,
  });
}

export function formatExpressionLearningRules(rules: ExpressionLearningRule[]): string {
  if (rules.length === 0) return "";
  const lines = rules.map((rule) => {
    const strength = rule.strength === "hard" ? "必须遵守" : "表达偏好";
    const scope = rule.scope === "global" ? "全局" : `场景：${rule.scene ?? "general"}`;
    return `- [${strength}/${scope}/${rule.kind}] ${rule.ruleText}`;
  });
  return [
    "已确认的表达规则（优先于后面的相似经验）：",
    ...lines,
  ].join("\n");
}
