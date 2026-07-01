// dream-relationship-review-organizer.ts — review relationship state as one coherent profile patch

import { Prisma, type Memory, type RelationshipState } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { modelProvider } from "../core/model-provider.js";
import { memoryService } from "../core/memory.service.js";
import {
  relationshipAutoUpdateEnabled,
  relationshipLabelFromAffinity,
  relationshipStateService,
} from "../runtime/relationship-state.service.js";
import { throwIfTaskCancelled } from "../runtime/running-task-registry.js";
import { RELATIONSHIP_REVIEW_SYSTEM_PROMPT } from "./dream-prompts.js";
import type {
  DreamContext,
  DreamSourceMessage,
  RawRelationshipReviewEvidence,
  RawRelationshipReviewEvidenceType,
  RawRelationshipReviewField,
  RawRelationshipMemoryChange,
  RawRelationshipReviewOutput,
} from "./dream.types.js";

export interface DreamRelationshipReviewResult {
  proposalCount: number;
  evidenceCount: number;
  appliedCount: number;
  pendingCount: number;
  memoryChangeCount: number;
  totalAffinityDelta: number;
}

interface RelationshipMessageGroup {
  relationship: RelationshipState;
  userIds: Set<string>;
  messages: DreamSourceMessage[];
}

interface NormalizedRelationshipEvidence {
  evidenceKey: string;
  evidenceType: RawRelationshipReviewEvidenceType;
  polarity: "positive" | "negative" | "neutral";
  baseDelta: number;
  adjustedDelta: number;
  confidence: number;
  content: string;
  reason: string;
  affectsFields: RawRelationshipReviewField[];
  sourceMessageIds: string[];
  messageId?: string;
  metadata: Prisma.InputJsonObject;
}

interface NormalizedRelationshipMemoryChange {
  proposalType: RawRelationshipMemoryChange["proposalType"];
  targetMemoryId?: string | null;
  type: string;
  tier: "short" | "mid" | "long";
  strength: number;
  riskLevel: "low" | "medium" | "high";
  content: string;
  summary?: string | null;
  tags: string[];
  entities: string[];
  reason: string;
  confidence: number;
  sourceMessageIds: string[];
}

const evidenceTypes = new Set<RawRelationshipReviewEvidenceType>([
  "sincerity",
  "shared_trait",
  "cheerful_chat",
  "caring_for_lusiyuan",
  "gentle_kindness",
  "project_interest",
  "project_contribution",
  "value_conflict",
  "hostility_or_value_denial",
]);

const reviewFields = new Set<RawRelationshipReviewField>([
  "affinity",
  "userIntroduction",
  "summary",
  "interactionStyle",
]);

const memoryProposalTypes = new Set<RawRelationshipMemoryChange["proposalType"]>([
  "create_memory",
  "update_memory",
  "supersede_memory",
  "archive_memory",
]);

const memoryTiers = new Set(["short", "mid", "long"]);
const riskLevels = new Set(["low", "medium", "high"]);

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function cleanText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}...` : trimmed;
}

function cleanConfidence(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0.5;
}

function normalizeKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s"'“”‘’`，,。.!！?？:：；;、()（）[\]【】<>《》]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function severityPenalty(
  type: RawRelationshipReviewEvidenceType,
  severity: RawRelationshipReviewEvidence["severity"]
): number {
  const level = severity ?? "medium";
  if (type === "value_conflict") {
    if (level === "high") return -5;
    if (level === "low") return -1;
    return -3;
  }
  if (level === "high") return -8;
  if (level === "low") return -3;
  return -5;
}

function baseDeltaForEvidence(
  type: RawRelationshipReviewEvidenceType,
  affinity: number,
  severity: RawRelationshipReviewEvidence["severity"]
): number {
  switch (type) {
    case "sincerity":
      return 1;
    case "shared_trait":
      return 5;
    case "cheerful_chat":
      return affinity < 60 ? 1 : 0;
    case "caring_for_lusiyuan":
      return affinity < 60 ? 2 : 0;
    case "gentle_kindness":
      return affinity < 60 ? 1 : 0;
    case "project_interest":
      return affinity < 40 ? 1 : 0;
    case "project_contribution":
      return affinity < 40 ? 2 : 0;
    case "value_conflict":
    case "hostility_or_value_denial":
      return severityPenalty(type, severity);
  }
}

function positiveCapForAffinity(affinity: number): number {
  if (affinity < 30) return 10;
  if (affinity < 40) return 6;
  if (affinity < 60) return 5;
  if (affinity < 70) return 4;
  return 2;
}

function adjustPositiveDelta(baseDelta: number, affinity: number): number {
  if (affinity < 30) return baseDelta * 2;
  if (affinity >= 70) return baseDelta >= 5 ? 2 : 1;
  return baseDelta;
}

function sourceMessageIdsFromEvidence(
  evidence: RawRelationshipReviewEvidence,
  validUserMessageIds: Set<string>
): string[] {
  if (!Array.isArray(evidence.sourceMessageIds)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of evidence.sourceMessageIds) {
    if (typeof id !== "string" || !validUserMessageIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function evidenceKeyFor(
  evidence: RawRelationshipReviewEvidence,
  sourceMessageIds: string[]
): string | null {
  if (evidence.evidenceType === "shared_trait") {
    const traitKey = cleanText(evidence.traitKey, 80);
    if (!traitKey) return null;
    const normalized = normalizeKeyPart(traitKey);
    return normalized ? `shared_trait:${normalized}` : null;
  }

  const sourceKey = sourceMessageIds.slice().sort().join(",");
  return `${evidence.evidenceType}:${sourceKey}`;
}

function affectsFieldsFromEvidence(
  evidence: RawRelationshipReviewEvidence,
  baseDelta: number
): RawRelationshipReviewField[] {
  const fields = Array.isArray(evidence.affectsFields)
    ? evidence.affectsFields.filter((field): field is RawRelationshipReviewField =>
        reviewFields.has(field as RawRelationshipReviewField)
      )
    : [];

  if (fields.length > 0) return Array.from(new Set(fields));
  if (baseDelta !== 0) return ["affinity"];
  return ["summary"];
}

function applyCaps(
  affinity: number,
  evidences: Omit<NormalizedRelationshipEvidence, "adjustedDelta">[]
): NormalizedRelationshipEvidence[] {
  const positiveCap = positiveCapForAffinity(affinity);
  let positiveTotal = 0;
  let negativeTotal = 0;

  return evidences.map((evidence) => {
    let adjustedDelta = evidence.baseDelta;

    if (evidence.baseDelta > 0) {
      const candidate = adjustPositiveDelta(evidence.baseDelta, affinity);
      adjustedDelta = Math.max(0, Math.min(candidate, positiveCap - positiveTotal));
      positiveTotal += adjustedDelta;
    } else if (evidence.baseDelta < 0) {
      adjustedDelta = Math.min(0, Math.max(evidence.baseDelta, -10 - negativeTotal));
      negativeTotal += adjustedDelta;
    }

    return { ...evidence, adjustedDelta };
  });
}

function normalizeEvidences(input: {
  raw: RawRelationshipReviewOutput;
  affinity: number;
  existingEvidenceKeys: Set<string>;
  validUserMessageIds: Set<string>;
}): NormalizedRelationshipEvidence[] {
  const seen = new Set<string>();
  const candidates: Omit<NormalizedRelationshipEvidence, "adjustedDelta">[] = [];

  for (const rawEvidence of Array.isArray(input.raw.evidences) ? input.raw.evidences : []) {
    if (!evidenceTypes.has(rawEvidence.evidenceType)) continue;
    const sourceMessageIds = sourceMessageIdsFromEvidence(rawEvidence, input.validUserMessageIds);
    if (sourceMessageIds.length === 0) continue;
    const evidenceKey = evidenceKeyFor(rawEvidence, sourceMessageIds);
    if (!evidenceKey || seen.has(evidenceKey) || input.existingEvidenceKeys.has(evidenceKey)) {
      continue;
    }

    const content = cleanText(rawEvidence.content, 360);
    const reason = cleanText(rawEvidence.reason, 260);
    if (!content || !reason) continue;

    const baseDelta = baseDeltaForEvidence(
      rawEvidence.evidenceType,
      input.affinity,
      rawEvidence.severity
    );
    const affectsFields = affectsFieldsFromEvidence(rawEvidence, baseDelta);

    seen.add(evidenceKey);
    candidates.push({
      evidenceKey,
      evidenceType: rawEvidence.evidenceType,
      polarity: baseDelta > 0 ? "positive" : baseDelta < 0 ? "negative" : "neutral",
      baseDelta,
      confidence: cleanConfidence(rawEvidence.confidence),
      content,
      reason,
      affectsFields,
      sourceMessageIds,
      messageId: sourceMessageIds[0],
      metadata: {
        traitKey: cleanText(rawEvidence.traitKey, 80) ?? null,
        severity: rawEvidence.severity ?? null,
        rawEvidence: rawEvidence as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return applyCaps(input.affinity, candidates);
}

function textList(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    const text = cleanText(item, 80);
    if (text) result.push(text);
    if (result.length >= maxItems) break;
  }
  return Array.from(new Set(result));
}

function normalizeMemoryTier(value: unknown): "short" | "mid" | "long" {
  return typeof value === "string" && memoryTiers.has(value)
    ? (value as "short" | "mid" | "long")
    : "short";
}

function normalizeRiskLevel(value: unknown): "low" | "medium" | "high" {
  return typeof value === "string" && riskLevels.has(value)
    ? (value as "low" | "medium" | "high")
    : "low";
}

function normalizeMemoryChanges(input: {
  raw: RawRelationshipReviewOutput;
  validUserMessageIds: Set<string>;
  currentMemories: Memory[];
}): NormalizedRelationshipMemoryChange[] {
  const currentMemoryIds = new Set(input.currentMemories.map((memory) => memory.id));
  const changes: NormalizedRelationshipMemoryChange[] = [];
  const seen = new Set<string>();

  for (const rawChange of Array.isArray(input.raw.memoryChanges) ? input.raw.memoryChanges : []) {
    if (!memoryProposalTypes.has(rawChange.proposalType)) continue;
    if (rawChange.type === "relationship" || rawChange.type === "core") continue;

    const sourceMessageIds = sourceMessageIdsFromEvidence(
      { ...rawChange, evidenceType: "sincerity" } as RawRelationshipReviewEvidence,
      input.validUserMessageIds
    );
    if (sourceMessageIds.length === 0) continue;

    const targetMemoryId = cleanText(rawChange.targetMemoryId, 120);
    if (
      rawChange.proposalType !== "create_memory" &&
      (!targetMemoryId || !currentMemoryIds.has(targetMemoryId))
    ) {
      continue;
    }

    const content = cleanText(rawChange.content, 1000);
    const reason = cleanText(rawChange.reason, 320);
    if (!content || !reason) continue;

    const key = [
      rawChange.proposalType,
      targetMemoryId ?? "new",
      normalizeKeyPart(rawChange.type),
      normalizeKeyPart(content.slice(0, 120)),
      sourceMessageIds.slice().sort().join(","),
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);

    changes.push({
      proposalType: rawChange.proposalType,
      targetMemoryId: targetMemoryId ?? null,
      type: cleanText(rawChange.type, 80) ?? "personal_fact",
      tier: normalizeMemoryTier(rawChange.tier),
      strength: clampInt(rawChange.strength ?? 1, 1, 10),
      riskLevel: normalizeRiskLevel(rawChange.riskLevel),
      content,
      summary: cleanPatchText(rawChange.summary, 240) ?? null,
      tags: textList(rawChange.tags),
      entities: textList(rawChange.entities),
      reason,
      confidence: cleanConfidence(rawChange.confidence),
      sourceMessageIds,
    });
  }

  return changes;
}

function memorySnapshot(memory: Memory): Prisma.InputJsonObject {
  return {
    id: memory.id,
    personId: memory.personId,
    scope: memory.scope,
    type: memory.type,
    tier: memory.tier,
    strength: memory.strength,
    riskLevel: memory.riskLevel,
    content: memory.content,
    summary: memory.summary,
    confidence: memory.confidence,
    status: memory.status,
    tags: memory.tags,
    entities: memory.entities,
  };
}

function mergeStringArrays(...values: Array<unknown>): string[] {
  const result = new Set<string>();
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (typeof item === "string" && item.trim()) result.add(item.trim());
    }
  }
  return Array.from(result);
}

function sourceInfoForChange(
  group: RelationshipMessageGroup,
  sourceMessageIds: string[]
): {
  sourceConversationIds: string[];
  sourceUserIds: string[];
  mentionDayKeys: string[];
  lastMentionedAt: Date | null;
} {
  const sourceIdSet = new Set(sourceMessageIds);
  const messages = group.messages.filter((message) => sourceIdSet.has(message.id));
  const sourceConversationIds = Array.from(
    new Set(messages.map((message) => message.conversationId).filter((id): id is string => Boolean(id)))
  );
  const sourceUserIds = Array.from(
    new Set(messages.map((message) => message.userId).filter((id): id is string => Boolean(id)))
  );
  const mentionDayKeys = Array.from(
    new Set(messages.map((message) => message.createdAt.toISOString().slice(0, 10)))
  );
  const lastMentionedAt = messages.reduce<Date | null>((latest, message) => {
    if (!latest || message.createdAt > latest) return message.createdAt;
    return latest;
  }, null);
  return { sourceConversationIds, sourceUserIds, mentionDayKeys, lastMentionedAt };
}

function groupSummary(group: RelationshipMessageGroup): {
  userId?: string;
  conversationId?: string;
  channel?: string;
} {
  const latestUserMessage = group.messages
    .filter((message) => message.role === "user")
    .at(-1);
  return {
    userId: latestUserMessage?.userId,
    conversationId: latestUserMessage?.conversationId,
    channel: latestUserMessage?.channel,
  };
}

function buildUserContent(input: {
  group: RelationshipMessageGroup;
  existingEvidenceKeys: string[];
  currentMemories: Memory[];
}): string {
  const relationship = input.group.relationship;
  const messages = input.group.messages.map((message) => ({
    id: message.id,
    role: message.role,
    createdAt: message.createdAt.toISOString(),
    channel: message.channel,
    userId: message.userId,
    userDisplayName: message.userDisplayName,
    content: message.content,
  }));
  const currentMemories = input.currentMemories.map((memory) => ({
    id: memory.id,
    type: memory.type,
    scope: memory.scope,
    tier: memory.tier,
    strength: memory.strength,
    riskLevel: memory.riskLevel,
    content: memory.content,
    summary: memory.summary,
    tags: memory.tags,
    entities: memory.entities,
    lastMentionedAt: memory.lastMentionedAt?.toISOString() ?? null,
    updatedAt: memory.updatedAt.toISOString(),
  }));

  return JSON.stringify(
    {
      currentRelationship: {
        relationshipStateId: relationship.id,
        personId: relationship.personId,
        relationshipLabel: relationship.relationshipLabel,
        affinity: relationship.affinity,
        userIntroduction: relationship.userIntroduction,
        summary: relationship.summary,
        interactionStyle: relationship.interactionStyle,
      },
      existingEvidenceKeys: input.existingEvidenceKeys,
      currentMemories,
      messages,
    },
    null,
    2
  );
}

function cleanPatchText(value: unknown, maxChars: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return cleanText(value, maxChars);
}

function normalizedPatch(input: {
  raw: RawRelationshipReviewOutput;
  relationship: RelationshipState;
  evidences: NormalizedRelationshipEvidence[];
}): Prisma.InputJsonObject {
  const rawPatch = input.raw.proposedPatch ?? {};
  const json: Record<string, Prisma.InputJsonValue | null> = {};
  const delta = clampInt(
    input.evidences.reduce((sum, evidence) => sum + evidence.adjustedDelta, 0),
    -10,
    10
  );
  const nextAffinity = clampInt(input.relationship.affinity + delta, 0, 100);

  if (nextAffinity !== input.relationship.affinity) {
    json.affinity = nextAffinity;
    json.relationshipLabel = relationshipLabelFromAffinity(nextAffinity);
  }

  const userIntroduction = cleanPatchText(rawPatch.userIntroduction, 420);
  if (
    userIntroduction !== undefined &&
    userIntroduction !== input.relationship.userIntroduction
  ) {
    json.userIntroduction = userIntroduction;
  }

  const summary = cleanPatchText(rawPatch.summary, 320);
  if (summary !== undefined && summary !== input.relationship.summary) {
    json.summary = summary;
  }

  const interactionStyle = cleanPatchText(rawPatch.interactionStyle, 220);
  if (
    interactionStyle !== undefined &&
    interactionStyle !== input.relationship.interactionStyle
  ) {
    json.interactionStyle = interactionStyle;
  }

  return json as Prisma.InputJsonObject;
}

function snapshotRelationshipState(state: RelationshipState): Prisma.InputJsonObject {
  return {
    id: state.id,
    personId: state.personId,
    relationshipLabel: state.relationshipLabel,
    affinity: state.affinity,
    userIntroduction: state.userIntroduction,
    interactionStyle: state.interactionStyle,
    summary: state.summary,
    recentSignal: state.recentSignal,
    statusNote: state.statusNote,
    lastInteractionAt: state.lastInteractionAt?.toISOString() ?? null,
    updatedAt: state.updatedAt.toISOString(),
  };
}

function previewAfterPatch(
  relationship: RelationshipState,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  return {
    ...snapshotRelationshipState(relationship),
    ...patch,
  };
}

function hasPatch(patch: Prisma.InputJsonObject): boolean {
  return Object.keys(patch).length > 0;
}

function buildProposalReason(raw: RawRelationshipReviewOutput): string {
  return cleanText(raw.summary, 180) ?? "Dream 根据这段时间的互动完成了一次关系复盘。";
}

export class DreamRelationshipReviewOrganizer {
  async organize(input: {
    context: DreamContext;
    reportId?: string;
    jobId?: string;
    signal?: AbortSignal;
  }): Promise<DreamRelationshipReviewResult> {
    const groups = await this.groupMessagesByRelationship(input.context);
    let proposalCount = 0;
    let evidenceCount = 0;
    let appliedCount = 0;
    let pendingCount = 0;
    let memoryChangeCount = 0;
    let totalAffinityDelta = 0;

    for (const group of groups) {
      throwIfTaskCancelled(input.signal);
      const result = await this.organizeGroup({
        group,
        reportId: input.reportId,
        jobId: input.jobId,
        signal: input.signal,
      });
      proposalCount += result.proposalCount;
      evidenceCount += result.evidenceCount;
      appliedCount += result.appliedCount;
      pendingCount += result.pendingCount;
      memoryChangeCount += result.memoryChangeCount;
      totalAffinityDelta += result.totalAffinityDelta;
    }

    return {
      proposalCount,
      evidenceCount,
      appliedCount,
      pendingCount,
      memoryChangeCount,
      totalAffinityDelta,
    };
  }

  private async groupMessagesByRelationship(context: DreamContext): Promise<RelationshipMessageGroup[]> {
    const userIds = Array.from(new Set(
      context.messages
        .map((message) => message.userId)
        .filter((userId): userId is string => Boolean(userId))
    ));
    const stateByUserId = new Map<string, RelationshipState>();

    for (const userId of userIds) {
      stateByUserId.set(userId, await relationshipStateService.getOrCreate(userId));
    }

    const groups = new Map<string, RelationshipMessageGroup>();
    for (const message of context.messages) {
      if (!message.userId) continue;
      const relationship = stateByUserId.get(message.userId);
      if (!relationship) continue;
      const existing = groups.get(relationship.id);
      if (existing) {
        existing.userIds.add(message.userId);
        existing.messages.push(message);
      } else {
        groups.set(relationship.id, {
          relationship,
          userIds: new Set([message.userId]),
          messages: [message],
        });
      }
    }

    return Array.from(groups.values()).filter((group) =>
      group.messages.some((message) => message.role === "user")
    );
  }

  private async organizeGroup(input: {
    group: RelationshipMessageGroup;
    reportId?: string;
    jobId?: string;
    signal?: AbortSignal;
  }): Promise<DreamRelationshipReviewResult> {
    const userMessageIds = new Set(
      input.group.messages
        .filter((message) => message.role === "user")
        .map((message) => message.id)
    );
    if (userMessageIds.size === 0) {
      return {
        proposalCount: 0,
        evidenceCount: 0,
        appliedCount: 0,
        pendingCount: 0,
        memoryChangeCount: 0,
        totalAffinityDelta: 0,
      };
    }

    const [currentMemories, existingEvidenceKeys] = await Promise.all([
      prisma.memory.findMany({
        where: {
          personId: input.group.relationship.personId,
          scope: "person",
          status: "active",
        },
        orderBy: [{ tier: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
        take: 40,
      }),
      prisma.relationshipReviewEvidence
        .findMany({
          where: { relationshipStateId: input.group.relationship.id },
          select: { evidenceKey: true },
        })
        .then((rows) => new Set(rows.map((row) => row.evidenceKey))),
    ]);

    const raw = await modelProvider.chatJson<RawRelationshipReviewOutput>(
      [
        { role: "system", content: RELATIONSHIP_REVIEW_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildUserContent({
            group: input.group,
            existingEvidenceKeys: Array.from(existingEvidenceKeys),
            currentMemories,
          }),
        },
      ],
      { signal: input.signal }
    );
    throwIfTaskCancelled(input.signal);

    const evidences = normalizeEvidences({
      raw,
      affinity: input.group.relationship.affinity,
      existingEvidenceKeys,
      validUserMessageIds: userMessageIds,
    });
    const patch = normalizedPatch({
      raw,
      relationship: input.group.relationship,
      evidences,
    });
    const memoryChanges = normalizeMemoryChanges({
      raw,
      validUserMessageIds: userMessageIds,
      currentMemories,
    });

    if (!hasPatch(patch) && evidences.length === 0 && memoryChanges.length === 0) {
      return {
        proposalCount: 0,
        evidenceCount: 0,
        appliedCount: 0,
        pendingCount: 0,
        memoryChangeCount: 0,
        totalAffinityDelta: 0,
      };
    }

    const autoUpdateEnabled = relationshipAutoUpdateEnabled(input.group.relationship.metadata);
    const groupInfo = groupSummary(input.group);
    const reason = buildProposalReason(raw);
    const status = hasPatch(patch) ? "pending" : "observed";
    const beforeAffinity = input.group.relationship.affinity;
    const afterAffinity = typeof patch.affinity === "number" ? patch.affinity : beforeAffinity;

    let relationshipProposalId: string | null = null;
    let appliedCount = 0;
    let pendingCount = 0;
    let totalAffinityDelta = 0;
    let relationshipEvidenceCount = 0;

    if (hasPatch(patch) || evidences.length > 0) {
      const proposal = await prisma.relationshipReviewProposal.create({
        data: {
          reportId: input.reportId ?? null,
          relationshipStateId: input.group.relationship.id,
          personId: input.group.relationship.personId,
          userId: groupInfo.userId ?? null,
          conversationId: groupInfo.conversationId ?? null,
          channel: groupInfo.channel ?? null,
          source: "dream",
          status,
          reason,
          confidence: cleanConfidence(raw.confidence),
          evidenceCount: evidences.length,
          beforeSnapshot: snapshotRelationshipState(input.group.relationship),
          proposedPatch: patch,
          afterSnapshot: previewAfterPatch(input.group.relationship, patch),
          rawOutput: raw as unknown as Prisma.InputJsonValue,
          metadata: {
            jobId: input.jobId ?? null,
            autoUpdateEnabled,
            openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions : [],
            memoryChangeCount: memoryChanges.length,
            affinity: {
              before: beforeAffinity,
              after: afterAffinity,
              delta: afterAffinity - beforeAffinity,
              positiveCap: positiveCapForAffinity(beforeAffinity),
              existingEvidenceKeyCount: existingEvidenceKeys.size,
            },
          },
          evidences: {
            create: evidences.map((evidence) => ({
              relationshipStateId: input.group.relationship.id,
              personId: input.group.relationship.personId,
              userId: groupInfo.userId ?? null,
              conversationId: groupInfo.conversationId ?? null,
              messageId: evidence.messageId ?? null,
              channel: groupInfo.channel ?? null,
              source: "dream",
              evidenceKey: evidence.evidenceKey,
              evidenceType: evidence.evidenceType,
              polarity: evidence.polarity,
              confidence: evidence.confidence,
              content: evidence.content,
              reason: evidence.reason,
              affectsFields: evidence.affectsFields,
              sourceMessageIds: evidence.sourceMessageIds,
              metadata: {
                ...evidence.metadata,
                baseDelta: evidence.baseDelta,
                adjustedDelta: evidence.adjustedDelta,
              },
            })),
          },
        },
        include: { evidences: true },
      });
      relationshipProposalId = proposal.id;
      relationshipEvidenceCount = proposal.evidences.length;
      pendingCount = status === "pending" ? 1 : 0;

      if (autoUpdateEnabled && status === "pending") {
        await relationshipStateService.applyRelationshipReviewProposal({
          proposalId: proposal.id,
          reviewedBy: "dream",
          source: "dream",
        });
        appliedCount = 1;
        pendingCount = 0;
        totalAffinityDelta = afterAffinity - beforeAffinity;
      }
    }

    const appliedMemoryProposalIds = input.reportId
      ? await this.applyMemoryChanges({
          changes: memoryChanges,
          group: input.group,
          reportId: input.reportId,
          jobId: input.jobId,
          relationshipReviewProposalId: relationshipProposalId,
          groupInfo,
        })
      : [];

    return {
      proposalCount: (relationshipProposalId ? 1 : 0) + appliedMemoryProposalIds.length,
      evidenceCount: relationshipEvidenceCount,
      appliedCount,
      pendingCount,
      memoryChangeCount: appliedMemoryProposalIds.length,
      totalAffinityDelta,
    };
  }

  private async applyMemoryChanges(input: {
    changes: NormalizedRelationshipMemoryChange[];
    group: RelationshipMessageGroup;
    reportId: string;
    jobId?: string;
    relationshipReviewProposalId?: string | null;
    groupInfo: ReturnType<typeof groupSummary>;
  }): Promise<string[]> {
    const proposalIds: string[] = [];

    for (const change of input.changes) {
      const result = await this.applyMemoryChange({
        change,
        group: input.group,
        reportId: input.reportId,
        jobId: input.jobId,
        relationshipReviewProposalId: input.relationshipReviewProposalId,
        groupInfo: input.groupInfo,
      });
      if (result.proposalId) proposalIds.push(result.proposalId);
      if (result.memory) {
        memoryService.generateAndStoreEmbedding(result.memory).catch((err) =>
          console.warn("[dream] personal memory embedding failed:", err)
        );
      }
    }

    return proposalIds;
  }

  private async applyMemoryChange(input: {
    change: NormalizedRelationshipMemoryChange;
    group: RelationshipMessageGroup;
    reportId: string;
    jobId?: string;
    relationshipReviewProposalId?: string | null;
    groupInfo: ReturnType<typeof groupSummary>;
  }): Promise<{ proposalId: string | null; memory: Memory | null }> {
    const { change, group, reportId, jobId, relationshipReviewProposalId, groupInfo } = input;
    const sourceInfo = sourceInfoForChange(group, change.sourceMessageIds);
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const baseProposalData = {
        reportId,
        personId: group.relationship.personId,
        conversationId: groupInfo.conversationId ?? null,
        channel: groupInfo.channel ?? null,
        proposalType: change.proposalType,
        targetMemoryId: change.targetMemoryId ?? null,
        scope: "person",
        type: change.type,
        tier: change.tier,
        strength: change.strength,
        content: change.content,
        summary: change.summary ?? null,
        tags: change.tags,
        entities: change.entities,
        reason: change.reason,
        confidence: change.confidence,
        riskLevel: change.riskLevel,
        status: "applied",
        reviewedBy: "dream",
        reviewedAt: now,
        sourceMessageIds: change.sourceMessageIds,
        sourceConversationIds: sourceInfo.sourceConversationIds,
        sourceUserIds: sourceInfo.sourceUserIds,
        metadata: {
          autoApplied: true,
          jobId: jobId ?? null,
          relationshipReviewProposalId: relationshipReviewProposalId ?? null,
        },
      } satisfies Prisma.MemoryProposalUncheckedCreateInput;

      if (change.proposalType === "create_memory") {
        const memory = await tx.memory.create({
          data: {
            personId: group.relationship.personId,
            scope: "person",
            type: change.type,
            tier: change.tier,
            strength: change.strength,
            riskLevel: change.riskLevel,
            content: change.content,
            summary: change.summary ?? null,
            importance: Math.max(1, Math.min(10, Math.round(change.confidence * 10))),
            confidence: change.confidence,
            status: "active",
            source: "dream_relationship_review",
            tags: change.tags,
            entities: change.entities,
            channel: groupInfo.channel ?? null,
            conversationId: groupInfo.conversationId ?? null,
            sourceMessageIds: change.sourceMessageIds,
            sourceConversationIds: sourceInfo.sourceConversationIds,
            sourceUserIds: sourceInfo.sourceUserIds,
            mentionDayKeys: sourceInfo.mentionDayKeys,
            lastMentionedAt: sourceInfo.lastMentionedAt,
            metadata: {
              autoApplied: true,
              jobId: jobId ?? null,
              relationshipReviewProposalId: relationshipReviewProposalId ?? null,
              reason: change.reason,
            },
          },
        });
        const proposal = await tx.memoryProposal.create({
          data: {
            ...baseProposalData,
            appliedMemoryId: memory.id,
            metadata: {
              ...(baseProposalData.metadata as Prisma.InputJsonObject),
              rollback: { type: "create_memory", appliedMemoryId: memory.id },
            },
          },
        });
        const updated = await tx.memory.update({
          where: { id: memory.id },
          data: {
            metadata: {
              ...(memory.metadata && typeof memory.metadata === "object" && !Array.isArray(memory.metadata)
                ? (memory.metadata as Prisma.JsonObject)
                : {}),
              sourceProposalId: proposal.id,
            },
          },
        });
        return { proposalId: proposal.id, memory: updated };
      }

      if (!change.targetMemoryId) return { proposalId: null, memory: null };
      const target = await tx.memory.findFirst({
        where: {
          id: change.targetMemoryId,
          personId: group.relationship.personId,
          scope: "person",
        },
      });
      if (!target) return { proposalId: null, memory: null };

      if (change.proposalType === "archive_memory") {
        const archived = await tx.memory.update({
          where: { id: target.id },
          data: { status: "archived" },
        });
        const proposal = await tx.memoryProposal.create({
          data: {
            ...baseProposalData,
            appliedMemoryId: archived.id,
            metadata: {
              ...(baseProposalData.metadata as Prisma.InputJsonObject),
              rollback: { type: "archive_memory", targetMemory: memorySnapshot(target) },
            },
          },
        });
        return { proposalId: proposal.id, memory: null };
      }

      if (change.proposalType === "supersede_memory") {
        await tx.memory.update({
          where: { id: target.id },
          data: { status: "superseded" },
        });
        const memory = await tx.memory.create({
          data: {
            personId: group.relationship.personId,
            scope: "person",
            type: change.type,
            tier: change.tier,
            strength: change.strength,
            riskLevel: change.riskLevel,
            content: change.content,
            summary: change.summary ?? null,
            importance: Math.max(1, Math.min(10, Math.round(change.confidence * 10))),
            confidence: change.confidence,
            status: "active",
            source: "dream_relationship_review",
            tags: change.tags,
            entities: change.entities,
            channel: groupInfo.channel ?? null,
            conversationId: groupInfo.conversationId ?? null,
            sourceMessageIds: change.sourceMessageIds,
            sourceConversationIds: sourceInfo.sourceConversationIds,
            sourceUserIds: sourceInfo.sourceUserIds,
            mentionDayKeys: sourceInfo.mentionDayKeys,
            lastMentionedAt: sourceInfo.lastMentionedAt,
            metadata: {
              autoApplied: true,
              jobId: jobId ?? null,
              relationshipReviewProposalId: relationshipReviewProposalId ?? null,
              supersedesMemoryId: target.id,
              reason: change.reason,
            },
          },
        });
        const proposal = await tx.memoryProposal.create({
          data: {
            ...baseProposalData,
            appliedMemoryId: memory.id,
            metadata: {
              ...(baseProposalData.metadata as Prisma.InputJsonObject),
              rollback: {
                type: "supersede_memory",
                targetMemory: memorySnapshot(target),
                appliedMemoryId: memory.id,
              },
            },
          },
        });
        const updated = await tx.memory.update({
          where: { id: memory.id },
          data: {
            metadata: {
              ...(memory.metadata && typeof memory.metadata === "object" && !Array.isArray(memory.metadata)
                ? (memory.metadata as Prisma.JsonObject)
                : {}),
              sourceProposalId: proposal.id,
            },
          },
        });
        return { proposalId: proposal.id, memory: updated };
      }

      const updated = await tx.memory.update({
        where: { id: target.id },
        data: {
          type: change.type,
          tier: change.tier,
          strength: Math.max(target.strength, change.strength),
          riskLevel: change.riskLevel,
          content: change.content,
          summary: change.summary ?? null,
          confidence: change.confidence,
          tags: change.tags,
          entities: change.entities,
          sourceMessageIds: mergeStringArrays(target.sourceMessageIds, change.sourceMessageIds),
          sourceConversationIds: mergeStringArrays(
            target.sourceConversationIds,
            sourceInfo.sourceConversationIds
          ),
          sourceUserIds: mergeStringArrays(target.sourceUserIds, sourceInfo.sourceUserIds),
          mentionDayKeys: mergeStringArrays(target.mentionDayKeys, sourceInfo.mentionDayKeys),
          lastMentionedAt: sourceInfo.lastMentionedAt ?? target.lastMentionedAt,
          metadata: {
            ...(target.metadata && typeof target.metadata === "object" && !Array.isArray(target.metadata)
              ? (target.metadata as Prisma.JsonObject)
              : {}),
            lastDreamUpdateAt: now.toISOString(),
            lastDreamReason: change.reason,
          },
        },
      });
      const proposal = await tx.memoryProposal.create({
        data: {
          ...baseProposalData,
          appliedMemoryId: updated.id,
          metadata: {
            ...(baseProposalData.metadata as Prisma.InputJsonObject),
            rollback: { type: "update_memory", targetMemory: memorySnapshot(target) },
          },
        },
      });
      return { proposalId: proposal.id, memory: updated };
    });
  }
}

export const dreamRelationshipReviewOrganizer = new DreamRelationshipReviewOrganizer();
