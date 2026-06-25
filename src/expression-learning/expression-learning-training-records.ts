import type {
  ExpressionLearningExample,
  ExpressionLearningTrainingRecord,
  Prisma,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";

type TrainingRecordWithExample = ExpressionLearningTrainingRecord & {
  example: ExpressionLearningExample | null;
};

export interface ExpressionLearningTrainingRecordInput {
  sourceType: string;
  platform: string;
  scene: string;
  scope?: string | null;
  status?: string;
  contextText?: string | null;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: string | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
  reasonText?: string | null;
  generatedQuestion?: unknown;
  generatedDraft?: unknown;
  analysisSnapshot?: unknown;
  rawPayload?: unknown;
  exampleId?: string | null;
}

export interface CompleteExpressionLearningTrainingRecordInput
  extends ExpressionLearningTrainingRecordInput {
  trainingRecordId?: string | null;
  example: ExpressionLearningExample;
}

function cleanText(value: unknown, fallback = "", max = 12000): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function nullableText(value: unknown, max = 12000): string | null {
  const text = cleanText(value, "", max);
  return text || null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringField(value: unknown, key: string): string | null {
  const item = objectValue(value)[key];
  return nullableText(item);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null
    ? undefined
    : value as Prisma.InputJsonValue;
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

function buildTrainingPayload(input: ExpressionLearningTrainingRecordInput) {
  const generatedQuestion = objectValue(input.generatedQuestion);
  const generatedDraft = objectValue(input.generatedDraft);
  const analysis = objectValue(input.analysisSnapshot);
  const contextText =
    nullableText(input.contextText) ??
    nullableText(generatedQuestion.contextText) ??
    "";
  const draftText =
    nullableText(input.draftText) ??
    nullableText(generatedDraft.draftText) ??
    nullableText(generatedQuestion.draftText);
  const finalText = nullableText(input.finalText, 4000);
  const reasonText =
    nullableText(input.reasonText, 4000) ??
    nullableText(input.ownerNote, 4000);
  const outcome = nullableText(input.outcome, 80);
  const tags = [
    ...stringList(generatedQuestion.tags),
    ...stringList(analysis.tags),
  ];

  return {
    schema: "lusiyuan.expression_learning.training.v1",
    source_type: cleanText(input.sourceType, "unknown", 80),
    platform: cleanText(input.platform, "general", 80),
    scene: cleanText(input.scene, "general", 80),
    scope: nullableText(input.scope, 80),
    status: cleanText(input.status, "started", 80),
    prompt_material: {
      context_text: contextText,
      generated_question: input.generatedQuestion ?? null,
      generated_draft: input.generatedDraft ?? null,
      siyuan_draft_text: draftText,
    },
    owner_decision: {
      outcome,
      owner_action: nullableText(input.ownerAction, 80),
      final_text: outcome === "skipped" ? null : finalText,
      skip_reason: outcome === "skipped" ? reasonText : null,
      owner_note: nullableText(input.ownerNote, 4000),
    },
    analysis,
    supervised_sample: {
      task: outcome === "skipped" ? "skip_reply" : "reply",
      input: contextText,
      rejected_or_reference_response: draftText,
      preferred_response: outcome === "skipped" ? null : finalText,
      skip_reason: outcome === "skipped" ? reasonText : null,
      tags: [...new Set(tags)],
      messages: outcome === "sent" && finalText
        ? [
            { role: "user", content: contextText },
            { role: "assistant", content: finalText },
          ]
        : [],
    },
  };
}

function createData(
  input: ExpressionLearningTrainingRecordInput
): Prisma.ExpressionLearningTrainingRecordUncheckedCreateInput {
  const payload = buildTrainingPayload(input);
  return {
    sourceType: cleanText(input.sourceType, "unknown", 80),
    platform: cleanText(input.platform, "general", 80),
    scene: cleanText(input.scene, "general", 80),
    scope: nullableText(input.scope, 80),
    status: cleanText(input.status, "started", 80),
    contextText: nullableText(input.contextText),
    draftText: nullableText(input.draftText, 4000),
    finalText: nullableText(input.finalText, 4000),
    outcome: nullableText(input.outcome, 80),
    ownerAction: nullableText(input.ownerAction, 80),
    ownerNote: nullableText(input.ownerNote, 4000),
    reasonText: nullableText(input.reasonText, 4000),
    generatedQuestion: jsonValue(input.generatedQuestion),
    generatedDraft: jsonValue(input.generatedDraft),
    analysisSnapshot: jsonValue(input.analysisSnapshot),
    exportPayload: payload as Prisma.InputJsonObject,
    rawPayload: jsonValue(input.rawPayload),
    exampleId: input.exampleId ?? null,
  };
}

function updateData(
  input: ExpressionLearningTrainingRecordInput
): Prisma.ExpressionLearningTrainingRecordUncheckedUpdateInput {
  const data = createData(input) as Prisma.ExpressionLearningTrainingRecordUncheckedUpdateInput;
  delete data.createdAt;
  return data;
}

export async function createExpressionLearningTrainingRecord(
  input: ExpressionLearningTrainingRecordInput
) {
  return prisma.expressionLearningTrainingRecord.create({
    data: createData(input),
  });
}

export async function completeExpressionLearningTrainingRecord(
  input: CompleteExpressionLearningTrainingRecordInput
) {
  const snapshot = analysisSnapshot(input.example);
  let dataInput: ExpressionLearningTrainingRecordInput = {
    ...input,
    status: input.status ?? "completed",
    analysisSnapshot: snapshot,
    exampleId: input.example.id,
  };

  if (input.trainingRecordId) {
    const existing = await prisma.expressionLearningTrainingRecord.findUnique({
      where: { id: input.trainingRecordId },
      select: {
        id: true,
        generatedQuestion: true,
        generatedDraft: true,
        rawPayload: true,
      },
    });
    if (existing) {
      dataInput = {
        ...dataInput,
        generatedQuestion: input.generatedQuestion ?? existing.generatedQuestion,
        generatedDraft: input.generatedDraft ?? existing.generatedDraft,
        rawPayload: {
          generated: existing.rawPayload,
          completion: input.rawPayload ?? null,
        },
      };
      return prisma.expressionLearningTrainingRecord.update({
        where: { id: input.trainingRecordId },
        data: updateData(dataInput),
      });
    }
  }

  return createExpressionLearningTrainingRecord(dataInput);
}

export function buildExpressionLearningTrainingExport(record: TrainingRecordWithExample) {
  const input: ExpressionLearningTrainingRecordInput = {
    sourceType: record.sourceType,
    platform: record.platform,
    scene: record.scene,
    scope: record.scope,
    status: record.status,
    contextText: record.contextText,
    draftText: record.draftText,
    finalText: record.finalText,
    outcome: record.outcome,
    ownerAction: record.ownerAction,
    ownerNote: record.ownerNote,
    reasonText: record.reasonText,
    generatedQuestion: record.generatedQuestion,
    generatedDraft: record.generatedDraft,
    analysisSnapshot: record.example ? analysisSnapshot(record.example) : record.analysisSnapshot,
    rawPayload: record.rawPayload,
    exampleId: record.exampleId,
  };
  return {
    ...buildTrainingPayload(input),
    record_id: record.id,
    example_id: record.exampleId,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    raw_record: {
      source_type: record.sourceType,
      platform: record.platform,
      scene: record.scene,
      scope: record.scope,
      status: record.status,
      context_text: record.contextText,
      draft_text: record.draftText,
      final_text: record.finalText,
      outcome: record.outcome,
      owner_action: record.ownerAction,
      owner_note: record.ownerNote,
      reason_text: record.reasonText,
      generated_question: record.generatedQuestion,
      generated_draft: record.generatedDraft,
      analysis_snapshot: record.analysisSnapshot,
      raw_payload: record.rawPayload,
    },
  };
}

export async function exportExpressionLearningTrainingRecords(format: "json" | "jsonl") {
  const records = await prisma.expressionLearningTrainingRecord.findMany({
    orderBy: { createdAt: "asc" },
    include: { example: true },
  });
  const items = records.map(buildExpressionLearningTrainingExport);
  if (format === "jsonl") {
    return items.map((item) => JSON.stringify(item)).join("\n") + (items.length > 0 ? "\n" : "");
  }
  return {
    schema: "lusiyuan.expression_learning.training_export.v1",
    exported_at: new Date().toISOString(),
    count: items.length,
    records: items,
  };
}
