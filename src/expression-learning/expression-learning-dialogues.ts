import type {
  ExpressionLearningDialogueCase,
  ExpressionLearningDialogueTurn,
  ExpressionLearningExample,
  Prisma,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";
import {
  analyzeExpressionLearningDecision,
  generateExpressionLearningDraft,
  learnExpression,
} from "./expression-learning.service.js";
import type {
  ExpressionLearningAnalysis,
  ExpressionLearningOwnerAction,
  ExpressionLearningOutcome,
  ExpressionLearningStatus,
} from "./expression-learning.types.js";

export type ExpressionLearningDialogueCaseStatus = "draft" | "active" | "archived";
export type ExpressionLearningDialogueTurnStatus = "draft" | "draft_saved" | "completed" | "dismissed";

type DialogueTurnWithExample = ExpressionLearningDialogueTurn & {
  example: ExpressionLearningExample | null;
};

type DialogueCaseWithTurns = ExpressionLearningDialogueCase & {
  turns: DialogueTurnWithExample[];
};

export interface ExpressionLearningDialogueCaseInput {
  scene: string;
  title?: string | null;
  trainingFocus?: string | null;
  rootContextText: string;
  status?: ExpressionLearningDialogueCaseStatus | string | null;
  createdFrom?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExpressionLearningDialogueCasePatch {
  scene?: string;
  title?: string | null;
  trainingFocus?: string | null;
  rootContextText?: string;
  status?: ExpressionLearningDialogueCaseStatus | string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExpressionLearningDialogueTurnInput {
  caseId: string;
  parentTurnId?: string | null;
  branchLabel?: string | null;
  userText: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: ExpressionLearningOutcome | null;
  ownerAction?: ExpressionLearningOwnerAction | null;
  ownerNote?: string | null;
  status?: ExpressionLearningDialogueTurnStatus | string | null;
}

export interface ExpressionLearningDialogueTurnPatch {
  parentTurnId?: string | null;
  branchLabel?: string | null;
  userText?: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: ExpressionLearningOutcome | null;
  ownerAction?: ExpressionLearningOwnerAction | null;
  ownerNote?: string | null;
  analysisSnapshot?: Partial<ExpressionLearningAnalysis> | null;
  status?: ExpressionLearningDialogueTurnStatus | string | null;
}

export interface ExpressionLearningDialogueTurnDecisionInput {
  draftText?: string | null;
  finalText?: string | null;
  outcome?: ExpressionLearningOutcome | null;
  ownerAction?: ExpressionLearningOwnerAction | null;
  ownerNote?: string | null;
  analysis?: Partial<ExpressionLearningAnalysis> | null;
  status?: ExpressionLearningStatus | null;
}

const dialogueCaseInclude = {
  turns: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: { example: true },
  },
} satisfies Prisma.ExpressionLearningDialogueCaseInclude;

function cleanText(value: unknown, fallback = "", max = 12000): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function nullableText(value: unknown, max = 12000): string | null {
  const text = cleanText(value, "", max);
  return text || null;
}

function cleanScene(value: unknown, fallback = "general"): string {
  const scene = cleanText(value, fallback, 80);
  return scene === "general" || scene === "chat" || scene === "reply" ? scene : fallback;
}

function cleanCaseStatus(value: unknown): ExpressionLearningDialogueCaseStatus {
  if (value === "draft" || value === "active" || value === "archived") return value;
  return "draft";
}

function cleanTurnStatus(value: unknown, fallback: ExpressionLearningDialogueTurnStatus): ExpressionLearningDialogueTurnStatus {
  if (value === "draft" || value === "draft_saved" || value === "completed" || value === "dismissed") return value;
  return fallback;
}

function cleanOutcome(value: unknown): ExpressionLearningOutcome | null {
  if (value === "sent" || value === "skipped") return value;
  return null;
}

function cleanOwnerAction(value: unknown, outcome: ExpressionLearningOutcome | null): ExpressionLearningOwnerAction | null {
  if (value === "owner_written" || value === "edited_draft" || value === "accepted_draft" || value === "owner_taught") {
    return value;
  }
  if (value === "skipped" || outcome === "skipped") return "skipped";
  return outcome === "sent" ? "owner_taught" : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : value as Prisma.InputJsonValue;
}

function assertContext(value: string, message: string): void {
  if (!value.trim()) {
    throw Object.assign(new Error(message), { statusCode: 400 });
  }
}

function analysisSnapshot(example: ExpressionLearningExample): Prisma.InputJsonObject {
  return {
    lesson: example.lesson,
    reasoning: example.reasoning,
    strategy: example.strategy,
    tone: example.tone,
    avoidances: example.avoidances ?? [],
    tags: example.tags ?? [],
    confidence: example.confidence,
    analysisVersion: example.analysisVersion,
    exampleStatus: example.status,
    embeddingStatus: example.embeddingStatus,
    embeddingError: example.embeddingError,
  };
}

function draftReasonFromSnapshot(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const reason = (value as Record<string, unknown>).draftReason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function withDraftReason(snapshot: Prisma.InputJsonObject, draftReason: string | null): Prisma.InputJsonObject {
  return draftReason ? { ...snapshot, draftReason } : snapshot;
}

function caseTitle(input: ExpressionLearningDialogueCaseInput): string {
  const explicit = cleanText(input.title, "", 120);
  if (explicit) return explicit;
  const focus = cleanText(input.trainingFocus, "", 80);
  if (focus) return focus;
  return cleanText(input.rootContextText, "连续对话练习", 36);
}

function sortTurns(turns: ExpressionLearningDialogueTurn[]): ExpressionLearningDialogueTurn[] {
  return [...turns].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function lineageForTurn(
  turns: ExpressionLearningDialogueTurn[],
  turn: ExpressionLearningDialogueTurn
): ExpressionLearningDialogueTurn[] {
  const byId = new Map(turns.map((item) => [item.id, item]));
  byId.set(turn.id, turn);
  const lineage: ExpressionLearningDialogueTurn[] = [];
  const seen = new Set<string>();
  let current: ExpressionLearningDialogueTurn | undefined = turn;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    lineage.push(current);
    current = current.parentTurnId ? byId.get(current.parentTurnId) : undefined;
  }
  return lineage.reverse();
}

export function buildExpressionLearningDialogueContext(input: {
  dialogueCase: Pick<ExpressionLearningDialogueCase, "scene" | "title" | "trainingFocus" | "rootContextText">;
  turns: Array<Pick<ExpressionLearningDialogueTurn,
    "id" | "parentTurnId" | "branchLabel" | "userText" | "draftText" | "finalText" | "outcome" | "ownerNote" | "sortOrder" | "createdAt"
  >>;
  turn: Pick<ExpressionLearningDialogueTurn,
    "id" | "parentTurnId" | "branchLabel" | "userText" | "draftText" | "finalText" | "outcome" | "ownerNote" | "sortOrder" | "createdAt"
  >;
}): string {
  const lineage = lineageForTurn(
    input.turns as ExpressionLearningDialogueTurn[],
    input.turn as ExpressionLearningDialogueTurn
  );
  const lines = [
    `训练案例：${input.dialogueCase.title}`,
    `场景：${input.dialogueCase.scene}`,
    input.dialogueCase.trainingFocus ? `训练重点：${input.dialogueCase.trainingFocus}` : "",
    "",
    "起始情境：",
    input.dialogueCase.rootContextText,
  ].filter(Boolean);

  lineage.forEach((turn, index) => {
    const label = index + 1;
    lines.push("", `第 ${label} 轮`);
    if (turn.branchLabel) lines.push(`分支条件：${turn.branchLabel}`);
    lines.push(`对方：${turn.userText}`);
    const isCurrent = turn.id === input.turn.id;
    if (isCurrent) return;
    if (turn.outcome === "skipped") {
      lines.push(`陆思源：不回复${turn.ownerNote ? `（${turn.ownerNote}）` : ""}`);
      return;
    }
    if (turn.finalText) {
      lines.push(`陆思源：${turn.finalText}`);
      return;
    }
    if (turn.draftText) {
      lines.push(`陆思源试答：${turn.draftText}`);
    }
  });

  return lines.join("\n").slice(0, 12000);
}

async function getDialogueCaseOrThrow(caseId: string): Promise<DialogueCaseWithTurns> {
  return prisma.expressionLearningDialogueCase.findUniqueOrThrow({
    where: { id: caseId },
    include: dialogueCaseInclude,
  });
}

async function getDialogueTurnContext(turnId: string) {
  const turn = await prisma.expressionLearningDialogueTurn.findUniqueOrThrow({
    where: { id: turnId },
    include: {
      example: true,
      case: {
        include: dialogueCaseInclude,
      },
    },
  });
  const dialogueCase = turn.case;
  const pathText = buildExpressionLearningDialogueContext({
    dialogueCase,
    turns: dialogueCase.turns,
    turn,
  });
  return { dialogueCase, turn, pathText };
}

async function rebuildCasePathTexts(caseId: string): Promise<void> {
  const dialogueCase = await getDialogueCaseOrThrow(caseId);
  await Promise.all(
    dialogueCase.turns.map((turn) => prisma.expressionLearningDialogueTurn.update({
      where: { id: turn.id },
      data: {
        pathText: buildExpressionLearningDialogueContext({
          dialogueCase,
          turns: dialogueCase.turns,
          turn,
        }),
      },
    }))
  );
}

async function collectDescendants(turnId: string): Promise<Array<{ id: string; exampleId: string | null }>> {
  const descendants: Array<{ id: string; exampleId: string | null }> = [];
  let frontier = [turnId];
  while (frontier.length > 0) {
    const rows = await prisma.expressionLearningDialogueTurn.findMany({
      where: { parentTurnId: { in: frontier } },
      select: { id: true, exampleId: true },
    });
    descendants.push(...rows);
    frontier = rows.map((row) => row.id);
  }
  return descendants;
}

async function markTurnsForReview(turnIds: string[], exampleIds: string[]): Promise<void> {
  await Promise.all([
    turnIds.length > 0
      ? prisma.expressionLearningDialogueTurn.updateMany({
          where: { id: { in: turnIds } },
          data: { needsReview: true },
        })
      : Promise.resolve(),
    exampleIds.length > 0
      ? prisma.expressionLearningExample.updateMany({
          where: { id: { in: exampleIds }, status: "active" },
          data: { status: "disabled" },
        })
      : Promise.resolve(),
  ]);
}

async function markAffectedTurnsForReview(turn: ExpressionLearningDialogueTurn, includeSelf: boolean): Promise<void> {
  const descendants = await collectDescendants(turn.id);
  const turnIds = [
    ...(includeSelf && turn.exampleId ? [turn.id] : []),
    ...descendants.map((item) => item.id),
  ];
  const exampleIds = [
    ...(includeSelf && turn.exampleId ? [turn.exampleId] : []),
    ...descendants.map((item) => item.exampleId).filter((id): id is string => Boolean(id)),
  ];
  await markTurnsForReview(turnIds, exampleIds);
}

export async function listExpressionLearningDialogueCases(input: {
  scene?: string | null;
  status?: string | null;
  limit?: number;
}) {
  const where: Prisma.ExpressionLearningDialogueCaseWhereInput = {};
  const scene = cleanText(input.scene, "", 80);
  const status = cleanText(input.status, "", 80);
  if (scene && scene !== "all") where.scene = cleanScene(scene);
  if (status && status !== "all") where.status = cleanCaseStatus(status);
  const limit = Math.min(Math.max(input.limit ?? 80, 1), 200);

  const [cases, total, draft, active, archived] = await Promise.all([
    prisma.expressionLearningDialogueCase.findMany({
      where,
      include: dialogueCaseInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.expressionLearningDialogueCase.count({ where }),
    prisma.expressionLearningDialogueCase.count({ where: { ...where, status: "draft" } }),
    prisma.expressionLearningDialogueCase.count({ where: { ...where, status: "active" } }),
    prisma.expressionLearningDialogueCase.count({ where: { ...where, status: "archived" } }),
  ]);

  return {
    cases,
    summary: { total, draft, active, archived },
  };
}

export async function createExpressionLearningDialogueCase(input: ExpressionLearningDialogueCaseInput) {
  const rootContextText = cleanText(input.rootContextText, "", 12000);
  assertContext(rootContextText, "rootContextText is required");
  return prisma.expressionLearningDialogueCase.create({
    data: {
      scene: cleanScene(input.scene),
      title: caseTitle(input),
      trainingFocus: nullableText(input.trainingFocus, 500),
      rootContextText,
      status: cleanCaseStatus(input.status),
      createdFrom: cleanText(input.createdFrom, "manual", 80),
      metadata: input.metadata ? input.metadata as Prisma.InputJsonObject : undefined,
    },
    include: dialogueCaseInclude,
  });
}

export async function updateExpressionLearningDialogueCase(caseId: string, patch: ExpressionLearningDialogueCasePatch) {
  const data: Prisma.ExpressionLearningDialogueCaseUpdateInput = {};
  let pathRelevant = false;
  if (patch.scene !== undefined) {
    data.scene = cleanScene(patch.scene);
    pathRelevant = true;
  }
  if (patch.title !== undefined) {
    data.title = cleanText(patch.title, "", 120) || "连续对话练习";
    pathRelevant = true;
  }
  if (patch.trainingFocus !== undefined) {
    data.trainingFocus = nullableText(patch.trainingFocus, 500);
    pathRelevant = true;
  }
  if (patch.rootContextText !== undefined) {
    const rootContextText = cleanText(patch.rootContextText, "", 12000);
    assertContext(rootContextText, "rootContextText is required");
    data.rootContextText = rootContextText;
    pathRelevant = true;
  }
  if (patch.status !== undefined) data.status = cleanCaseStatus(patch.status);
  if (patch.metadata !== undefined) data.metadata = jsonValue(patch.metadata);

  const updated = await prisma.expressionLearningDialogueCase.update({
    where: { id: caseId },
    data,
    include: dialogueCaseInclude,
  });
  if (pathRelevant) {
    const exampleIds = updated.turns.map((turn) => turn.exampleId).filter((id): id is string => Boolean(id));
    await markTurnsForReview(updated.turns.map((turn) => turn.id), exampleIds);
    await rebuildCasePathTexts(caseId);
  }
  return getDialogueCaseOrThrow(caseId);
}

export async function createExpressionLearningDialogueTurn(input: ExpressionLearningDialogueTurnInput) {
  const dialogueCase = await getDialogueCaseOrThrow(input.caseId);
  const userText = cleanText(input.userText, "", 4000);
  assertContext(userText, "userText is required");
  const parentTurnId = nullableText(input.parentTurnId, 120);
  if (parentTurnId) {
    const parent = dialogueCase.turns.find((turn) => turn.id === parentTurnId);
    if (!parent) {
      throw Object.assign(new Error("parentTurnId must belong to the dialogue case"), { statusCode: 400 });
    }
  }
  const siblingCount = dialogueCase.turns.filter((turn) => (turn.parentTurnId ?? null) === (parentTurnId ?? null)).length;
  const outcome = cleanOutcome(input.outcome);
  const turn = await prisma.expressionLearningDialogueTurn.create({
    data: {
      caseId: dialogueCase.id,
      parentTurnId,
      branchLabel: nullableText(input.branchLabel, 200),
      userText,
      draftText: nullableText(input.draftText, 4000),
      finalText: outcome === "skipped" ? null : nullableText(input.finalText, 4000),
      outcome,
      ownerAction: cleanOwnerAction(input.ownerAction, outcome),
      ownerNote: nullableText(input.ownerNote, 2000),
      status: cleanTurnStatus(input.status, "draft"),
      sortOrder: siblingCount,
    },
  });
  await rebuildCasePathTexts(dialogueCase.id);
  return getDialogueCaseOrThrow(dialogueCase.id);
}

export async function updateExpressionLearningDialogueTurn(turnId: string, patch: ExpressionLearningDialogueTurnPatch) {
  const current = await prisma.expressionLearningDialogueTurn.findUniqueOrThrow({ where: { id: turnId } });
  const data: Prisma.ExpressionLearningDialogueTurnUpdateInput = {};
  let pathRelevant = false;
  let decisionRelevant = false;

  if (patch.parentTurnId !== undefined) {
    const nextParentId = nullableText(patch.parentTurnId, 120);
    if (nextParentId === turnId) {
      throw Object.assign(new Error("parentTurnId cannot point to the same turn"), { statusCode: 400 });
    }
    if (nextParentId) {
      const parent = await prisma.expressionLearningDialogueTurn.findFirst({
        where: { id: nextParentId, caseId: current.caseId },
        select: { id: true },
      });
      if (!parent) {
        throw Object.assign(new Error("parentTurnId must belong to the dialogue case"), { statusCode: 400 });
      }
    }
    data.parent = nextParentId ? { connect: { id: nextParentId } } : { disconnect: true };
    pathRelevant = true;
  }
  if (patch.branchLabel !== undefined) {
    data.branchLabel = nullableText(patch.branchLabel, 200);
    pathRelevant = true;
  }
  if (patch.userText !== undefined) {
    const userText = cleanText(patch.userText, "", 4000);
    assertContext(userText, "userText is required");
    data.userText = userText;
    pathRelevant = true;
  }
  if (patch.draftText !== undefined) {
    data.draftText = nullableText(patch.draftText, 4000);
    decisionRelevant = true;
  }
  const nextOutcome = patch.outcome !== undefined ? cleanOutcome(patch.outcome) : cleanOutcome(current.outcome);
  if (patch.finalText !== undefined) {
    data.finalText = nextOutcome === "skipped" ? null : nullableText(patch.finalText, 4000);
    pathRelevant = true;
    decisionRelevant = true;
  }
  if (patch.outcome !== undefined) {
    data.outcome = nextOutcome;
    if (nextOutcome === "skipped") data.finalText = null;
    pathRelevant = true;
    decisionRelevant = true;
  }
  if (patch.ownerAction !== undefined) {
    data.ownerAction = cleanOwnerAction(patch.ownerAction, nextOutcome);
    decisionRelevant = true;
  }
  if (patch.ownerNote !== undefined) {
    data.ownerNote = nullableText(patch.ownerNote, 2000);
    pathRelevant = true;
    decisionRelevant = true;
  }
  if (patch.analysisSnapshot !== undefined) {
    data.analysisSnapshot = jsonValue(patch.analysisSnapshot);
    decisionRelevant = true;
  }
  if (patch.status !== undefined) {
    data.status = cleanTurnStatus(patch.status, current.status as ExpressionLearningDialogueTurnStatus);
  }
  if ((pathRelevant || decisionRelevant) && current.exampleId) {
    data.needsReview = true;
  }

  await prisma.expressionLearningDialogueTurn.update({
    where: { id: turnId },
    data,
  });
  if (pathRelevant || decisionRelevant) {
    await markAffectedTurnsForReview(current, Boolean(current.exampleId));
  }
  if (pathRelevant) {
    await rebuildCasePathTexts(current.caseId);
  }
  return getDialogueCaseOrThrow(current.caseId);
}

export async function deleteExpressionLearningDialogueTurn(turnId: string) {
  const current = await prisma.expressionLearningDialogueTurn.findUniqueOrThrow({ where: { id: turnId } });
  const descendants = await collectDescendants(turnId);
  const turnIds = [turnId, ...descendants.map((turn) => turn.id)];
  const exampleIds = [current.exampleId, ...descendants.map((turn) => turn.exampleId)]
    .filter((id): id is string => Boolean(id));
  await prisma.$transaction(async (tx) => {
    if (exampleIds.length > 0) {
      await tx.expressionLearningExample.deleteMany({ where: { id: { in: exampleIds } } });
    }
    await tx.expressionLearningDialogueTurn.deleteMany({
      where: { id: { in: turnIds } },
    });
  });
  await rebuildCasePathTexts(current.caseId);
  return getDialogueCaseOrThrow(current.caseId);
}

export async function deleteExpressionLearningDialogueCase(caseId: string) {
  const dialogueCase = await getDialogueCaseOrThrow(caseId);
  const exampleIds = dialogueCase.turns
    .map((turn) => turn.exampleId)
    .filter((id): id is string => Boolean(id));
  await prisma.$transaction(async (tx) => {
    if (exampleIds.length > 0) {
      await tx.expressionLearningExample.deleteMany({ where: { id: { in: exampleIds } } });
    }
    await tx.expressionLearningDialogueCase.delete({ where: { id: caseId } });
  });
  return { deletedId: caseId };
}

export async function generateExpressionLearningDialogueTurnDraft(turnId: string) {
  const { dialogueCase, turn, pathText } = await getDialogueTurnContext(turnId);
  const draft = await generateExpressionLearningDraft({
    scene: dialogueCase.scene,
    contextText: pathText,
  });
  await prisma.expressionLearningDialogueTurn.update({
    where: { id: turn.id },
    data: {
      pathText,
      draftText: draft.draftText,
      analysisSnapshot: withDraftReason({}, draft.reason),
      status: turn.status === "completed" ? turn.status : "draft_saved",
      needsReview: Boolean(turn.exampleId),
    },
  });
  if (turn.exampleId) {
    await markAffectedTurnsForReview(turn, true);
  }
  return {
    ...draft,
    dialogueCase: await getDialogueCaseOrThrow(dialogueCase.id),
  };
}

function resolveDecision(
  turn: ExpressionLearningDialogueTurn,
  input: ExpressionLearningDialogueTurnDecisionInput
) {
  const outcome = input.outcome ?? cleanOutcome(turn.outcome) ?? "sent";
  const draftText = input.draftText !== undefined ? nullableText(input.draftText, 4000) : turn.draftText;
  const finalText = outcome === "skipped"
    ? null
    : input.finalText !== undefined
      ? nullableText(input.finalText, 4000)
      : turn.finalText;
  if (outcome === "sent" && !finalText) {
    throw Object.assign(new Error("finalText is required for sent outcomes"), { statusCode: 400 });
  }
  return {
    outcome,
    draftText,
    finalText,
    ownerAction: input.ownerAction ?? cleanOwnerAction(turn.ownerAction, outcome) ?? "owner_taught",
    ownerNote: input.ownerNote !== undefined ? nullableText(input.ownerNote, 2000) : turn.ownerNote,
  };
}

export async function analyzeExpressionLearningDialogueTurn(
  turnId: string,
  input: ExpressionLearningDialogueTurnDecisionInput
) {
  const { dialogueCase, turn, pathText } = await getDialogueTurnContext(turnId);
  const decision = resolveDecision(turn, input);
  const analysis = await analyzeExpressionLearningDecision({
    sourceRef: `dialogue_turn_preview:${turn.id}`,
    sourceType: "dialogue_turn",
    sourceId: turn.id,
    scene: dialogueCase.scene,
    contextText: pathText,
    draftText: decision.draftText,
    finalText: decision.finalText,
    outcome: decision.outcome,
    ownerAction: decision.ownerAction,
    ownerNote: decision.ownerNote,
    status: "disabled",
    metadata: {
      dialogueCaseId: dialogueCase.id,
      dialogueTurnId: turn.id,
      parentTurnId: turn.parentTurnId,
      branchLabel: turn.branchLabel,
      trainingFocus: dialogueCase.trainingFocus,
    },
  });

  await prisma.expressionLearningDialogueTurn.update({
    where: { id: turn.id },
    data: {
      pathText,
      draftText: decision.draftText,
      finalText: decision.finalText,
      outcome: decision.outcome,
      ownerAction: decision.ownerAction,
      ownerNote: decision.ownerNote,
      analysisSnapshot: withDraftReason(
        analysis as unknown as Prisma.InputJsonObject,
        draftReasonFromSnapshot(turn.analysisSnapshot),
      ),
      status: turn.status === "completed" ? "draft_saved" : "draft_saved",
      needsReview: Boolean(turn.exampleId),
    },
  });
  if (turn.exampleId) {
    await markAffectedTurnsForReview(turn, true);
  }

  return {
    analysis,
    dialogueCase: await getDialogueCaseOrThrow(dialogueCase.id),
  };
}

export async function saveExpressionLearningDialogueTurnExample(
  turnId: string,
  input: ExpressionLearningDialogueTurnDecisionInput
) {
  const { dialogueCase, turn, pathText } = await getDialogueTurnContext(turnId);
  const decision = resolveDecision(turn, input);
  const analysis = input.analysis ?? (
    turn.analysisSnapshot && typeof turn.analysisSnapshot === "object"
      ? turn.analysisSnapshot as Partial<ExpressionLearningAnalysis>
      : null
  );
  const status = input.status ?? "active";
  const example = await learnExpression(
    {
      sourceRef: `dialogue_turn:${turn.id}`,
      sourceType: "dialogue_turn",
      sourceId: turn.id,
      scene: dialogueCase.scene,
      contextText: pathText,
      draftText: decision.draftText,
      finalText: decision.finalText,
      outcome: decision.outcome,
      ownerAction: decision.ownerAction,
      ownerNote: decision.ownerNote,
      status,
      metadata: {
        createdFrom: "admin_expression_dialogue",
        dialogueCaseId: dialogueCase.id,
        dialogueCaseTitle: dialogueCase.title,
        dialogueTurnId: turn.id,
        parentTurnId: turn.parentTurnId,
        branchLabel: turn.branchLabel,
        trainingFocus: dialogueCase.trainingFocus,
      },
    },
    analysis
  );

  await prisma.expressionLearningDialogueTurn.update({
    where: { id: turn.id },
    data: {
      pathText,
      draftText: decision.draftText,
      finalText: decision.finalText,
      outcome: decision.outcome,
      ownerAction: decision.ownerAction,
      ownerNote: decision.ownerNote,
      analysisSnapshot: withDraftReason(analysisSnapshot(example), draftReasonFromSnapshot(turn.analysisSnapshot)),
      exampleId: example.id,
      status: "completed",
      needsReview: false,
    },
  });

  return {
    example,
    dialogueCase: await getDialogueCaseOrThrow(dialogueCase.id),
  };
}
