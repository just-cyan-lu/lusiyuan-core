// dream-relationship-affinity-organizer.ts — extract relationship evidence and apply affinity patches

import { Prisma, type RelationshipState } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { modelProvider } from "../core/model-provider.js";
import { relationshipStateService } from "../runtime/relationship-state.service.js";
import { throwIfTaskCancelled } from "../runtime/running-task-registry.js";
import { RELATIONSHIP_AFFINITY_SYSTEM_PROMPT } from "./dream-prompts.js";
import type {
  DreamContext,
  DreamSourceMessage,
  RawRelationshipAffinityEvidence,
  RawRelationshipAffinityEvidenceType,
  RawRelationshipAffinityOutput,
} from "./dream.types.js";

export interface DreamRelationshipAffinityResult {
  proposalCount: number;
  evidenceCount: number;
  appliedCount: number;
  totalDelta: number;
}

interface RelationshipMessageGroup {
  relationship: RelationshipState;
  userIds: Set<string>;
  messages: DreamSourceMessage[];
}

interface NormalizedAffinityEvidence {
  evidenceKey: string;
  evidenceType: RawRelationshipAffinityEvidenceType;
  polarity: "positive" | "negative";
  baseDelta: number;
  adjustedDelta: number;
  confidence: number;
  content: string;
  reason: string;
  sourceMessageIds: string[];
  messageId?: string;
  metadata: Prisma.InputJsonObject;
}

const evidenceTypes = new Set<RawRelationshipAffinityEvidenceType>([
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

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function cleanText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}…` : trimmed;
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
  type: RawRelationshipAffinityEvidenceType,
  severity: RawRelationshipAffinityEvidence["severity"]
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
  type: RawRelationshipAffinityEvidenceType,
  affinity: number,
  severity: RawRelationshipAffinityEvidence["severity"]
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
  evidence: RawRelationshipAffinityEvidence,
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
  evidence: RawRelationshipAffinityEvidence,
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

function buildProposalReason(raw: RawRelationshipAffinityOutput, evidences: NormalizedAffinityEvidence[]): string {
  const summary = cleanText(raw.summary, 160);
  if (summary) return summary;
  return evidences
    .slice(0, 3)
    .map((evidence) => evidence.reason)
    .filter(Boolean)
    .join("；") || "Dream 根据关系证据调整好感度。";
}

function applyCaps(
  affinity: number,
  evidences: Omit<NormalizedAffinityEvidence, "adjustedDelta">[]
): NormalizedAffinityEvidence[] {
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
  raw: RawRelationshipAffinityOutput;
  affinity: number;
  existingEvidenceKeys: Set<string>;
  validUserMessageIds: Set<string>;
}): NormalizedAffinityEvidence[] {
  const seen = new Set<string>();
  const candidates: Omit<NormalizedAffinityEvidence, "adjustedDelta">[] = [];

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
    if (baseDelta === 0) continue;

    seen.add(evidenceKey);
    candidates.push({
      evidenceKey,
      evidenceType: rawEvidence.evidenceType,
      polarity: baseDelta > 0 ? "positive" : "negative",
      baseDelta,
      confidence: cleanConfidence(rawEvidence.confidence),
      content,
      reason,
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

  return JSON.stringify(
    {
      currentRelationship: {
        relationshipStateId: relationship.id,
        personId: relationship.personId,
        relationshipLabel: relationship.relationshipLabel,
        affinity: relationship.affinity,
        summary: relationship.summary,
        recentSignal: relationship.recentSignal,
      },
      existingEvidenceKeys: input.existingEvidenceKeys,
      messages,
    },
    null,
    2
  );
}

export class DreamRelationshipAffinityOrganizer {
  async organize(input: {
    context: DreamContext;
    reportId?: string;
    jobId?: string;
    signal?: AbortSignal;
  }): Promise<DreamRelationshipAffinityResult> {
    const groups = await this.groupMessagesByRelationship(input.context);
    let proposalCount = 0;
    let evidenceCount = 0;
    let appliedCount = 0;
    let totalDelta = 0;

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
      totalDelta += result.totalDelta;
    }

    return { proposalCount, evidenceCount, appliedCount, totalDelta };
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
  }): Promise<DreamRelationshipAffinityResult> {
    const userMessageIds = new Set(
      input.group.messages
        .filter((message) => message.role === "user")
        .map((message) => message.id)
    );
    if (userMessageIds.size === 0) {
      return { proposalCount: 0, evidenceCount: 0, appliedCount: 0, totalDelta: 0 };
    }

    const existingEvidenceKeys = new Set(
      await prisma.relationshipAffinityEvidence
        .findMany({
          where: { relationshipStateId: input.group.relationship.id },
          select: { evidenceKey: true },
        })
        .then((rows) => rows.map((row) => row.evidenceKey))
    );

    const raw = await modelProvider.chatJson<RawRelationshipAffinityOutput>(
      [
        { role: "system", content: RELATIONSHIP_AFFINITY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildUserContent({
            group: input.group,
            existingEvidenceKeys: Array.from(existingEvidenceKeys),
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

    if (evidences.length === 0) {
      return { proposalCount: 0, evidenceCount: 0, appliedCount: 0, totalDelta: 0 };
    }

    const delta = clampInt(
      evidences.reduce((sum, evidence) => sum + evidence.adjustedDelta, 0),
      -10,
      10
    );
    const afterAffinity = clampInt(input.group.relationship.affinity + delta, 0, 100);
    const groupInfo = groupSummary(input.group);
    const reason = buildProposalReason(raw, evidences);

    const proposal = await prisma.relationshipAffinityProposal.create({
      data: {
        reportId: input.reportId ?? null,
        relationshipStateId: input.group.relationship.id,
        personId: input.group.relationship.personId,
        userId: groupInfo.userId ?? null,
        conversationId: groupInfo.conversationId ?? null,
        channel: groupInfo.channel ?? null,
        source: "dream",
        status: delta === 0 ? "observed" : "applied",
        beforeAffinity: input.group.relationship.affinity,
        delta,
        afterAffinity,
        reason,
        confidence: cleanConfidence(raw.confidence),
        evidenceCount: evidences.length,
        appliedAt: delta === 0 ? null : new Date(),
        rawOutput: raw as unknown as Prisma.InputJsonValue,
        metadata: {
          jobId: input.jobId ?? null,
          positiveCap: positiveCapForAffinity(input.group.relationship.affinity),
          existingEvidenceKeyCount: existingEvidenceKeys.size,
          openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions : [],
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
            baseDelta: evidence.baseDelta,
            adjustedDelta: evidence.adjustedDelta,
            confidence: evidence.confidence,
            content: evidence.content,
            reason: evidence.reason,
            sourceMessageIds: evidence.sourceMessageIds,
            metadata: evidence.metadata,
          })),
        },
      },
      include: { evidences: true },
    });

    if (delta !== 0) {
      await relationshipStateService.applyAffinityPatch({
        relationshipId: input.group.relationship.id,
        source: "dream",
        reason,
        delta,
        userId: groupInfo.userId,
        conversationId: groupInfo.conversationId,
        messageId: proposal.evidences[0]?.messageId ?? undefined,
        channel: groupInfo.channel,
        evidence: {
          proposalId: proposal.id,
          reportId: input.reportId ?? null,
          jobId: input.jobId ?? null,
          evidenceIds: proposal.evidences.map((evidence) => evidence.id),
          evidenceKeys: proposal.evidences.map((evidence) => evidence.evidenceKey),
          beforeAffinity: input.group.relationship.affinity,
          afterAffinity,
        },
      });
    }

    return {
      proposalCount: 1,
      evidenceCount: proposal.evidences.length,
      appliedCount: delta === 0 ? 0 : 1,
      totalDelta: delta,
    };
  }
}

export const dreamRelationshipAffinityOrganizer = new DreamRelationshipAffinityOrganizer();
