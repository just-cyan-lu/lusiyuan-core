import type { ExpressionLearningExample, ExpressionLearningRule, Prisma } from "@prisma/client";
import { modelProvider } from "../core/model-provider.js";
import { prisma } from "../db/prisma.js";
import {
  createExpressionLearningRule,
  type ExpressionLearningEvidenceCoverage,
  type ExpressionLearningRuleKind,
  type ExpressionLearningRuleScope,
  type ExpressionLearningRuleStrength,
} from "./expression-learning-rules.js";

export type ExpressionLearningDistillationMatchType = "new" | "duplicate" | "conflict";

export interface ExpressionLearningDistillationCandidateValue {
  ruleText: string;
  kind: ExpressionLearningRuleKind;
  scope: ExpressionLearningRuleScope;
  scene: string | null;
  strength: ExpressionLearningRuleStrength;
  coverage: ExpressionLearningEvidenceCoverage;
  reason: string;
  sourceExampleIds: string[];
  matchType: ExpressionLearningDistillationMatchType;
  matchedRuleId: string | null;
  matchReason: string;
}

export interface ExpressionLearningDistillationInput {
  exampleIds?: string[];
  scene?: string | null;
  organization?: string;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
}

const batchDistillationPrompt = `你负责把一批 owner 的原始表达经验整理成少量、稳定、可执行的候选规则，并与已有规则比较。

目标：
- 合并多条经验中重复出现的共同判断，不要一条经验机械生成一条规则。
- 每条经验的 coveredByRules 列出了它已经支持或反驳过的规则。不要再次从同一条经验生成相同侧面；优先寻找尚未覆盖的新侧面。
- 如果一条新经验能给 existingRules 增加尚未记录的证明，可以输出 duplicate，让 owner 把这条新证据合并进去。
- 一条候选只表达一个判断，保留支持它的全部 sourceExampleIds。
- owner 补充说明中的“一定不要、绝不、必须”等跨场景禁令，应单独提炼成 global + avoid + hard。
- 场景相关规则使用 scope=scene，scene 只能是 general/chat/reply；全局规则 scene=null。
- kind 只能是 avoid/prefer/strategy，strength 只能是 hard/soft，coverage 只能是 partial/full。
- coverage=full 仅表示候选规则完整覆盖其列出的每条原始经验；只提取了经验中的一部分判断时必须是 partial。

与 existingRules 比较：
- 含义已经被某条旧规则覆盖：matchType=duplicate，并填写 matchedRuleId。
- 与某条旧规则在同一适用范围内给出相反要求：matchType=conflict，并填写 matchedRuleId。
- 没有重复或冲突：matchType=new，matchedRuleId=null。
- matchedRuleId 只能原样使用 existingRules 中给出的 id，不能编造。
- 候选之间也要去重，最多输出 12 条最有价值的规则。
- 不要因为措辞不同就误判冲突；只有行为要求相反才算冲突。
- 只输出 JSON。

格式：
{
  "candidates": [{
    "ruleText": "规则正文",
    "kind": "avoid|prefer|strategy",
    "scope": "global|scene",
    "scene": null,
    "strength": "hard|soft",
    "coverage": "partial|full",
    "reason": "提炼依据",
    "sourceExampleIds": ["原始经验 id"],
    "matchType": "new|duplicate|conflict",
    "matchedRuleId": null,
    "matchReason": "为什么重复、冲突或是新规则"
  }]
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

function canonicalRuleText(value: string): string {
  return value.toLocaleLowerCase("zh-CN").replace(/[\s，。！？、,.!?；;：:'"“”‘’（）()]/g, "");
}

function parseDateBoundary(value: string | null | undefined, end: boolean): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function buildExpressionLearningDistillationWhere(
  input: ExpressionLearningDistillationInput
): Prisma.ExpressionLearningExampleWhereInput {
  if (input.exampleIds?.length) return { id: { in: [...new Set(input.exampleIds)] } };
  const where: Prisma.ExpressionLearningExampleWhereInput = {};
  if (input.scene && input.scene !== "all") where.scene = input.scene;
  const from = parseDateBoundary(input.createdFrom, false);
  const to = parseDateBoundary(input.createdTo, true);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const organization = oneOf(input.organization, ["unorganized", "partial", "full", "all"] as const, "unorganized");
  if (organization === "unorganized") where.ruleEvidences = { none: {} };
  if (organization === "partial") {
    where.AND = [
      { ruleEvidences: { some: { coverage: "partial" } } },
      { ruleEvidences: { none: { coverage: "full" } } },
    ];
  }
  if (organization === "full") where.ruleEvidences = { some: { coverage: "full" } };
  return where;
}

export function normalizeExpressionLearningDistillationCandidates(input: {
  value: unknown;
  examples: Array<Pick<ExpressionLearningExample, "id" | "scene" | "lesson" | "ownerNote"> & {
    ruleEvidences?: Array<{ ruleId: string; relation: string }>;
  }>;
  existingRules: Array<Pick<ExpressionLearningRule, "id" | "ruleText">>;
}): ExpressionLearningDistillationCandidateValue[] {
  const rawObject = input.value && typeof input.value === "object" ? input.value as Record<string, unknown> : {};
  const rows = Array.isArray(rawObject.candidates) ? rawObject.candidates : [];
  const examplesById = new Map(input.examples.map((example) => [example.id, example]));
  const existingById = new Map(input.existingRules.map((rule) => [rule.id, rule]));
  const existingByText = new Map(input.existingRules.map((rule) => [canonicalRuleText(rule.ruleText), rule]));
  const merged = new Map<string, ExpressionLearningDistillationCandidateValue>();

  for (const item of rows.slice(0, 24)) {
    const raw = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const ruleText = cleanText(raw.ruleText, "", 1000);
    if (!ruleText) continue;
    let sourceExampleIds = Array.isArray(raw.sourceExampleIds)
      ? [...new Set(raw.sourceExampleIds.filter((id): id is string => typeof id === "string" && examplesById.has(id)))]
      : [];
    if (sourceExampleIds.length === 0) continue;
    const firstExample = examplesById.get(sourceExampleIds[0]);
    const scope = oneOf(raw.scope, ["global", "scene"] as const, "scene");
    let matchedRuleId = typeof raw.matchedRuleId === "string" && existingById.has(raw.matchedRuleId)
      ? raw.matchedRuleId
      : null;
    let matchType = oneOf(raw.matchType, ["new", "duplicate", "conflict"] as const, "new");
    const exactRule = existingByText.get(canonicalRuleText(ruleText));
    if (exactRule) {
      matchedRuleId = exactRule.id;
      matchType = "duplicate";
    }
    if (matchType !== "new" && !matchedRuleId) matchType = "new";
    if (matchedRuleId && matchType !== "new") {
      const relation = matchType === "conflict" ? "contradicts" : "supports";
      sourceExampleIds = sourceExampleIds.filter((exampleId) => {
        const example = examplesById.get(exampleId);
        return !example?.ruleEvidences?.some((evidence) => (
          evidence.ruleId === matchedRuleId && evidence.relation === relation
        ));
      });
      if (sourceExampleIds.length === 0) continue;
    }
    const candidate: ExpressionLearningDistillationCandidateValue = {
      ruleText,
      kind: oneOf(raw.kind, ["avoid", "prefer", "strategy"] as const, "strategy"),
      scope,
      scene: scope === "global" ? null : cleanScene(raw.scene) ?? cleanScene(firstExample?.scene) ?? "general",
      strength: oneOf(raw.strength, ["hard", "soft"] as const, "soft"),
      coverage: oneOf(raw.coverage, ["partial", "full"] as const, "partial"),
      reason: cleanText(raw.reason, "由多条原始表达经验整理而来。", 1200),
      sourceExampleIds,
      matchType,
      matchedRuleId,
      matchReason: cleanText(raw.matchReason, matchType === "new" ? "未发现重复或冲突的现有规则。" : "与现有规则含义相关。", 1200),
    };
    const key = canonicalRuleText(ruleText);
    const previous = merged.get(key);
    if (previous) {
      previous.sourceExampleIds = [...new Set([...previous.sourceExampleIds, ...candidate.sourceExampleIds])];
      if (candidate.coverage === "partial") previous.coverage = "partial";
    } else {
      merged.set(key, candidate);
    }
  }
  const candidates = [...merged.values()].slice(0, 12);
  const sourceUsage = new Map<string, number>();
  for (const candidate of candidates) {
    for (const exampleId of candidate.sourceExampleIds) {
      sourceUsage.set(exampleId, (sourceUsage.get(exampleId) ?? 0) + 1);
    }
  }
  for (const candidate of candidates) {
    if (candidate.sourceExampleIds.some((exampleId) => (sourceUsage.get(exampleId) ?? 0) > 1)) {
      candidate.coverage = "partial";
    }
  }
  return candidates;
}

function serializeExample(example: ExpressionLearningExample & {
  ruleEvidences: Array<{
    coverage: string;
    relation: string;
    rule: Pick<ExpressionLearningRule, "id" | "ruleText" | "kind" | "scope" | "scene" | "strength" | "status">;
  }>;
}) {
  return {
    id: example.id,
    scene: example.scene,
    context: example.contextText.slice(0, 1800),
    draft: example.draftText,
    finalReply: example.finalText,
    outcome: example.outcome,
    ownerNote: example.ownerNote,
    lesson: example.lesson,
    strategy: example.strategy,
    avoidances: example.avoidances,
    tags: example.tags,
    coveredByRules: example.ruleEvidences.map((evidence) => ({
      ruleId: evidence.rule.id,
      ruleText: evidence.rule.ruleText,
      ruleStatus: evidence.rule.status,
      relation: evidence.relation,
      coverage: evidence.coverage,
    })),
  };
}

const batchInclude = {
  candidates: {
    include: {
      matchedRule: true,
      createdRule: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
};

async function hydrateBatch<T extends { sourceExampleIds: unknown }>(batch: T) {
  const ids = Array.isArray(batch.sourceExampleIds)
    ? batch.sourceExampleIds.filter((id): id is string => typeof id === "string")
    : [];
  const sourceExamples = await prisma.expressionLearningExample.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "desc" },
  });
  return { ...batch, sourceExamples };
}

export async function createExpressionLearningDistillationBatch(input: ExpressionLearningDistillationInput) {
  const limit = Math.min(Math.max(input.limit ?? 40, 2), 60);
  const examples = await prisma.expressionLearningExample.findMany({
    where: buildExpressionLearningDistillationWhere(input),
    include: {
      ruleEvidences: {
        include: { rule: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  if (examples.length < 2) {
    throw Object.assign(new Error("至少需要 2 条符合条件的经验才能批量整理"), { statusCode: 400 });
  }
  const existingRules = await prisma.expressionLearningRule.findMany({
    where: { status: { in: ["active", "draft"] } },
    orderBy: { updatedAt: "desc" },
    take: 120,
  });
  const batch = await prisma.expressionLearningDistillationBatch.create({
    data: {
      status: "processing",
      scene: input.scene && input.scene !== "all" ? input.scene : null,
      organization: oneOf(input.organization, ["unorganized", "partial", "full", "all"] as const, "unorganized"),
      fromTime: parseDateBoundary(input.createdFrom, false),
      toTime: parseDateBoundary(input.createdTo, true),
      sourceExampleIds: examples.map((example) => example.id),
      sourceCount: examples.length,
    },
  });

  try {
    const raw = await modelProvider.chatJson<{ candidates?: unknown[] }>([
      { role: "system", content: batchDistillationPrompt },
      { role: "user", content: JSON.stringify({
        examples: examples.map(serializeExample),
        existingRules: existingRules.map((rule) => ({
          id: rule.id,
          ruleText: rule.ruleText,
          kind: rule.kind,
          scope: rule.scope,
          scene: rule.scene,
          strength: rule.strength,
          status: rule.status,
        })),
      }, null, 2) },
    ]);
    const candidates = normalizeExpressionLearningDistillationCandidates({
      value: raw,
      examples,
      existingRules,
    });
    const completed = await prisma.expressionLearningDistillationBatch.update({
      where: { id: batch.id },
      data: {
        status: "proposed",
        candidateCount: candidates.length,
        rawOutput: raw as Prisma.InputJsonValue,
        completedAt: new Date(),
        candidates: candidates.length > 0 ? {
          create: candidates.map((candidate) => ({
            ruleText: candidate.ruleText,
            kind: candidate.kind,
            scope: candidate.scope,
            scene: candidate.scene,
            strength: candidate.strength,
            coverage: candidate.coverage,
            reason: candidate.reason,
            sourceExampleIds: candidate.sourceExampleIds,
            matchType: candidate.matchType,
            matchedRuleId: candidate.matchedRuleId,
            matchReason: candidate.matchReason,
          })),
        } : undefined,
      },
      include: batchInclude,
    });
    return hydrateBatch(completed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.expressionLearningDistillationBatch.update({
      where: { id: batch.id },
      data: { status: "failed", error: message.slice(0, 1200), completedAt: new Date() },
    });
    throw error;
  }
}

export async function listExpressionLearningDistillationBatches(limit = 20) {
  const batches = await prisma.expressionLearningDistillationBatch.findMany({
    include: batchInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  return Promise.all(batches.map(hydrateBatch));
}

export async function updateExpressionLearningDistillationCandidate(
  id: string,
  input: Partial<ExpressionLearningDistillationCandidateValue>
) {
  const current = await prisma.expressionLearningDistillationCandidate.findUniqueOrThrow({ where: { id } });
  if (current.status !== "proposed") {
    throw Object.assign(new Error("只能修改尚未处理的候选规则"), { statusCode: 409 });
  }
  const scope = oneOf(input.scope, ["global", "scene"] as const, current.scope as ExpressionLearningRuleScope);
  const sourceIds = Array.isArray(current.sourceExampleIds)
    ? current.sourceExampleIds.filter((item): item is string => typeof item === "string")
    : [];
  return prisma.expressionLearningDistillationCandidate.update({
    where: { id },
    data: {
      ruleText: cleanText(input.ruleText, current.ruleText, 1000),
      kind: oneOf(input.kind, ["avoid", "prefer", "strategy"] as const, current.kind as ExpressionLearningRuleKind),
      scope,
      scene: scope === "global" ? null : cleanScene(input.scene) ?? current.scene ?? "general",
      strength: oneOf(input.strength, ["hard", "soft"] as const, current.strength as ExpressionLearningRuleStrength),
      coverage: oneOf(input.coverage, ["partial", "full"] as const, current.coverage as ExpressionLearningEvidenceCoverage),
      reason: input.reason === undefined ? current.reason : cleanText(input.reason, "", 1200) || null,
      sourceExampleIds: input.sourceExampleIds?.length ? [...new Set(input.sourceExampleIds)] : sourceIds,
    },
    include: { matchedRule: true, createdRule: true },
  });
}

async function completeBatchIfResolved(batchId: string) {
  const remaining = await prisma.expressionLearningDistillationCandidate.count({
    where: { batchId, status: "proposed" },
  });
  if (remaining === 0) {
    await prisma.expressionLearningDistillationBatch.update({
      where: { id: batchId },
      data: { status: "completed" },
    });
  }
}

export async function resolveExpressionLearningDistillationCandidate(input: {
  candidateId: string;
  action: "create" | "merge" | "dismiss";
  ruleStatus?: "draft" | "active";
}) {
  const candidate = await prisma.expressionLearningDistillationCandidate.findUniqueOrThrow({
    where: { id: input.candidateId },
    include: { matchedRule: true },
  });
  if (candidate.status !== "proposed") {
    throw Object.assign(new Error("候选规则已经处理过"), { statusCode: 409 });
  }
  const exampleIds = Array.isArray(candidate.sourceExampleIds)
    ? candidate.sourceExampleIds.filter((item): item is string => typeof item === "string")
    : [];
  let resultRuleId: string | null = null;
  let nextStatus = "dismissed";

  if (input.action === "create") {
    const rule = await createExpressionLearningRule({
      ruleText: candidate.ruleText,
      kind: candidate.kind,
      scope: candidate.scope,
      scene: candidate.scene,
      strength: candidate.strength,
      status: input.ruleStatus ?? "draft",
      source: "distilled",
      exampleIds,
      coverage: candidate.coverage,
      metadata: { distillationBatchId: candidate.batchId, distillationCandidateId: candidate.id },
    });
    resultRuleId = rule.id;
    nextStatus = "accepted";
  } else if (input.action === "merge") {
    if (!candidate.matchedRuleId) {
      throw Object.assign(new Error("这个候选没有可合并的现有规则"), { statusCode: 400 });
    }
    await prisma.expressionLearningRuleEvidence.createMany({
      data: exampleIds.map((exampleId) => ({
        ruleId: candidate.matchedRuleId as string,
        exampleId,
        coverage: candidate.coverage,
        relation: candidate.matchType === "conflict" ? "contradicts" : "supports",
      })),
      skipDuplicates: true,
    });
    resultRuleId = candidate.matchedRuleId;
    nextStatus = "merged";
  }

  const resolved = await prisma.expressionLearningDistillationCandidate.update({
    where: { id: candidate.id },
    data: {
      status: nextStatus,
      createdRuleId: resultRuleId,
      resolvedAt: new Date(),
    },
    include: { matchedRule: true, createdRule: true },
  });
  await completeBatchIfResolved(candidate.batchId);
  return resolved;
}

export async function reopenExpressionLearningDistillationCandidate(candidateId: string) {
  const candidate = await prisma.expressionLearningDistillationCandidate.findUniqueOrThrow({
    where: { id: candidateId },
  });
  if (candidate.status !== "dismissed") {
    throw Object.assign(new Error("只有已忽略的候选规则可以取消忽略"), { statusCode: 409 });
  }
  const reopened = await prisma.expressionLearningDistillationCandidate.update({
    where: { id: candidateId },
    data: {
      status: "proposed",
      resolvedAt: null,
      createdRuleId: null,
    },
    include: { matchedRule: true, createdRule: true },
  });
  await prisma.expressionLearningDistillationBatch.update({
    where: { id: candidate.batchId },
    data: { status: "proposed" },
  });
  return reopened;
}
