// dream-relationship-review-organizer.ts — review relationship state as one coherent profile patch

import { Prisma, type Memory, type RelationshipState } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import { dreamModelProvider } from "../core/model-provider.js";
import { memoryService } from "../core/memory.service.js";
import {
  buildMemoryAgingPatch,
  buildMemoryReinforcement,
  dayKeyFromDate,
} from "../memory/memory-lifecycle.js";
import {
  relationshipAutoUpdateEnabled,
  relationshipLabelFromAffinity,
  relationshipStateService,
} from "../runtime/relationship-state.service.js";
import { throwIfTaskCancelled } from "../runtime/running-task-registry.js";
import { pgVectorMemoryIndex } from "../vector-index/pgvector-memory-index.js";
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
  relationToTarget?: MemoryRelation;
  targetMemoryId?: string | null;
  type?: string;
  content?: string;
  summary?: string | null;
  sourceMessageIds: string[];
}

type MemoryRelation = NonNullable<RawRelationshipMemoryChange["relationToTarget"]>;
type MemoryPolarity = "positive" | "negative" | "unknown";

export interface MemoryCandidateTerms {
  terms: Set<string>;
  rareTerms: Set<string>;
}

const REVIEW_MEMORY_BASE_LIMIT = 40;
const REVIEW_MEMORY_CANDIDATE_LIMIT = 60;
const REVIEW_MEMORY_PHRASE_LIMIT = 20;
const REVIEW_MEMORY_RAW_BASE_LIMIT = 80;
const REVIEW_MEMORY_RAW_PHRASE_LIMIT = 160;
const REVIEW_MEMORY_RAW_SEMANTIC_LIMIT = 80;
const REVIEW_MEMORY_DB_PHRASE_TERMS = 120;
const REVIEW_MEMORY_PHRASE_TERMS_PER_MESSAGE = 20;
const REVIEW_MEMORY_SEMANTIC_MIN_SCORE = 0.24;
const REVIEW_MEMORY_GLOBAL_SEMANTIC_MIN_SCORE = 0.32;
const GLOBAL_MEMORY_SCOPES = ["project", "global", "topic"];

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

const memoryChangeTypes = new Set<RawRelationshipMemoryChange["proposalType"]>([
  "create_memory",
  "update_memory",
  "supersede_memory",
  "archive_memory",
  "reinforce_memory",
]);

const memoryRelationTypes = new Set<MemoryRelation>([
  "same_fact",
  "more_specific",
  "newer_version",
  "conflict",
  "related_but_distinct",
  "unrelated",
]);

const memoryTierRank: Record<string, number> = {
  temp: 0,
  short: 1,
  mid: 2,
  long: 3,
};

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

function normalizedSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s"'“”‘’`，,。.!！?？:：；;、()（）[\]【】<>《》]+/gu, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addTerm(target: Set<string>, value: string): void {
  const term = normalizedSearchText(value);
  if (term.length >= 2 && term.length <= 24) target.add(term);
}

function chineseNgrams(value: string): string[] {
  const result: string[] = [];
  for (let size = 2; size <= 8; size += 1) {
    for (let index = 0; index + size <= value.length; index += 1) {
      result.push(value.slice(index, index + size));
    }
  }
  return result;
}

function focusedMemoryTerms(text: string): string[] {
  const result = new Set<string>();
  const pattern =
    /(?:不喜欢|喜欢|讨厌|不讨厌|爱吃|爱看|爱玩|爱听|想吃|想看|想玩|关注|养|正在做|在做|项目叫|名字叫|叫做)([\p{Script=Han}a-zA-Z0-9_-]{2,16})/gu;
  for (const match of text.matchAll(pattern)) {
    const raw = match[1];
    addTerm(result, raw);
    const withoutLeadingVerb = raw.replace(/^(吃|看|玩|听|读|写|做|用|买|养)/u, "");
    if (withoutLeadingVerb !== raw) addTerm(result, withoutLeadingVerb);
  }
  return Array.from(result);
}

export function extractMemoryCandidateTermsFromText(text: string): MemoryCandidateTerms {
  const terms = new Set<string>();
  const rareTerms = new Set<string>();

  for (const term of focusedMemoryTerms(text)) {
    addTerm(terms, term);
    if (term.length >= 3) addTerm(rareTerms, term);
  }

  for (const match of text.matchAll(/[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}/g)) {
    addTerm(terms, match[0]);
    if (match[0].length >= 3) addTerm(rareTerms, match[0]);
  }

  for (const match of text.matchAll(/[\p{Script=Han}]{2,24}/gu)) {
    for (const term of chineseNgrams(match[0])) {
      addTerm(terms, term);
      if (term.length >= 3) addTerm(rareTerms, term);
    }
  }

  return { terms, rareTerms };
}

function mergeCandidateTerms(values: MemoryCandidateTerms[]): MemoryCandidateTerms {
  const terms = new Set<string>();
  const rareTerms = new Set<string>();
  for (const value of values) {
    for (const term of value.terms) terms.add(term);
    for (const term of value.rareTerms) rareTerms.add(term);
  }
  return { terms, rareTerms };
}

function memoryText(memory: Pick<Memory, "content" | "summary" | "type">): string {
  return normalizedSearchText([memory.content, memory.summary, memory.type].filter(Boolean).join("\n"));
}

function cleanMemoryRelation(value: unknown): MemoryRelation | undefined {
  return typeof value === "string" && memoryRelationTypes.has(value as MemoryRelation)
    ? (value as MemoryRelation)
    : undefined;
}

function hasCorrectionCue(text: string): boolean {
  return /不对|记错|纠正|不是|其实|改一下|说错|误会/u.test(text);
}

function polarityForTerm(text: string, term: string): MemoryPolarity {
  const normalized = normalizedSearchText(text);
  const escaped = escapeRegExp(term);
  const negativePatterns = [
    `不喜欢.{0,12}${escaped}`,
    `不是.{0,16}喜欢.{0,12}${escaped}`,
    `讨厌.{0,12}${escaped}`,
    `不想.{0,12}${escaped}`,
    `不要.{0,12}${escaped}`,
    `不会.{0,12}${escaped}`,
    `不再.{0,12}${escaped}`,
    `${escaped}.{0,12}不喜欢`,
    `${escaped}.{0,12}讨厌`,
  ];
  if (negativePatterns.some((pattern) => new RegExp(pattern, "u").test(normalized))) {
    return "negative";
  }

  const positivePatterns = [
    `喜欢.{0,12}${escaped}`,
    `爱(?:吃|看|玩|听)?.{0,12}${escaped}`,
    `想(?:吃|看|玩|听|要)?.{0,12}${escaped}`,
    `会.{0,12}${escaped}`,
    `正在.{0,12}${escaped}`,
    `在做.{0,12}${escaped}`,
  ];
  if (positivePatterns.some((pattern) => new RegExp(pattern, "u").test(normalized))) {
    return "positive";
  }

  return "unknown";
}

function polarityForTerms(text: string, terms: string[]): MemoryPolarity {
  let positive = false;
  let negative = false;
  for (const term of terms) {
    const polarity = polarityForTerm(text, term);
    if (polarity === "positive") positive = true;
    if (polarity === "negative") negative = true;
  }
  if (negative) return "negative";
  if (positive) return "positive";
  return "unknown";
}

function meaningfullySameMemoryContent(
  nextContent: string,
  existing: Pick<Memory, "content" | "summary">
): boolean {
  const next = normalizedSearchText(nextContent);
  const current = normalizedSearchText(existing.content);
  const currentSummary = existing.summary ? normalizedSearchText(existing.summary) : "";
  return next === current || (currentSummary.length >= 8 && next === currentSummary);
}

function inferMemoryRelation(input: {
  content: string;
  summary?: string | null;
  type: string;
  memory: Memory;
  relationHint?: MemoryRelation;
}): { relation: MemoryRelation; matches: string[] } | null {
  const terms = extractMemoryCandidateTermsFromText(
    [input.content, input.summary ?? "", input.type].join("\n")
  );
  const matches = matchedMemoryTerms(input.memory, terms.rareTerms);
  if (matches.length === 0) return null;

  const oldPolarity = polarityForTerms(input.memory.content, matches);
  const newPolarity = polarityForTerms(input.content, matches);
  if (
    oldPolarity !== "unknown" &&
    newPolarity !== "unknown" &&
    oldPolarity !== newPolarity
  ) {
    return { relation: "conflict", matches };
  }

  if (input.relationHint && input.relationHint !== "unrelated") {
    return { relation: input.relationHint, matches };
  }

  if (meaningfullySameMemoryContent(input.content, input.memory)) {
    return { relation: "same_fact", matches };
  }

  if (hasCorrectionCue(input.content)) {
    return { relation: "newer_version", matches };
  }

  if (
    oldPolarity !== "unknown" &&
    newPolarity !== "unknown" &&
    oldPolarity === newPolarity
  ) {
    return normalizedSearchText(input.content).length > normalizedSearchText(input.memory.content).length + 16
      ? { relation: "more_specific", matches }
      : { relation: "same_fact", matches };
  }

  return { relation: "related_but_distinct", matches };
}

export function matchedMemoryTerms(
  memory: Pick<Memory, "content" | "summary" | "type">,
  terms: Set<string>
): string[] {
  const text = memoryText(memory);
  const matches: string[] = [];
  for (const term of terms) {
    if (text.includes(term)) matches.push(term);
  }
  return matches.sort((a, b) => b.length - a.length || a.localeCompare(b)).slice(0, 12);
}

function candidateTermsForMessages(messages: DreamSourceMessage[]): MemoryCandidateTerms {
  return mergeCandidateTerms(
    messages
      .filter((message) => message.role === "user")
      .map((message) => extractMemoryCandidateTermsFromText(message.content))
  );
}

export function phraseSearchTermsForMessages(messages: DreamSourceMessage[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const message of messages.filter((item) => item.role === "user")) {
    let perMessageCount = 0;
    const terms = extractMemoryCandidateTermsFromText(message.content);
    for (const term of terms.rareTerms) {
      if (term.length < 3 || seen.has(term)) continue;
      seen.add(term);
      result.push(term);
      perMessageCount += 1;
      if (
        perMessageCount >= REVIEW_MEMORY_PHRASE_TERMS_PER_MESSAGE ||
        result.length >= REVIEW_MEMORY_DB_PHRASE_TERMS
      ) {
        break;
      }
    }
    if (result.length >= REVIEW_MEMORY_DB_PHRASE_TERMS) break;
  }

  return result;
}

export function selectMemoriesForRelationshipReview(
  memories: Memory[],
  messages: DreamSourceMessage[]
): Memory[] {
  const candidateTerms = candidateTermsForMessages(messages);
  const phraseMatches = memories
    .map((memory) => ({
      memory,
      matches: matchedMemoryTerms(memory, candidateTerms.rareTerms),
    }))
    .filter((item) => item.matches.length > 0)
    .sort((a, b) => {
      const matchDelta = b.matches.join("").length - a.matches.join("").length;
      if (matchDelta !== 0) return matchDelta;
      const tierDelta = (memoryTierRank[b.memory.tier] ?? 0) - (memoryTierRank[a.memory.tier] ?? 0);
      if (tierDelta !== 0) return tierDelta;
      return b.memory.updatedAt.getTime() - a.memory.updatedAt.getTime();
    })
    .slice(0, REVIEW_MEMORY_PHRASE_LIMIT)
    .map((item) => item.memory);

  const result: Memory[] = [];
  const seen = new Set<string>();
  const add = (memory: Memory) => {
    if (seen.has(memory.id) || result.length >= REVIEW_MEMORY_CANDIDATE_LIMIT) return;
    seen.add(memory.id);
    result.push(memory);
  };

  for (const memory of phraseMatches) add(memory);
  for (const memory of memories.slice(0, REVIEW_MEMORY_BASE_LIMIT)) add(memory);
  for (const memory of sortMemoriesForReview([...memories]).slice(0, REVIEW_MEMORY_BASE_LIMIT)) add(memory);

  return result;
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

function sourceKindsForIds(
  ids: string[],
  messageById: Map<string, DreamSourceMessage>
): string[] {
  return Array.from(new Set(
    ids.map((id) => messageById.get(id)?.sourceKind ?? "unknown")
  ));
}

function positiveDeltaForSourceContext(
  baseDelta: number,
  sourceKinds: string[]
): number {
  if (baseDelta <= 0) return baseDelta;
  if (sourceKinds.length === 0) return baseDelta;
  const onlyPlatform = sourceKinds.every((kind) =>
    kind === "platform_comment" ||
    kind === "platform_thread_reply" ||
    kind === "platform_interaction"
  );
  if (!onlyPlatform) return baseDelta;

  const hasThreadReply = sourceKinds.includes("platform_thread_reply");
  return Math.min(baseDelta, hasThreadReply ? 2 : 1);
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

function sourceMessageIdsFromList(
  value: unknown,
  validUserMessageIds: Set<string>
): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || !validUserMessageIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function sourceMessageIdsFromEvidence(
  evidence: RawRelationshipReviewEvidence,
  validUserMessageIds: Set<string>
): string[] {
  return sourceMessageIdsFromList(evidence.sourceMessageIds, validUserMessageIds);
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
  messageById: Map<string, DreamSourceMessage>;
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

    const rawBaseDelta = baseDeltaForEvidence(
      rawEvidence.evidenceType,
      input.affinity,
      rawEvidence.severity
    );
    const sourceKinds = sourceKindsForIds(sourceMessageIds, input.messageById);
    const baseDelta = positiveDeltaForSourceContext(rawBaseDelta, sourceKinds);
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
        sourceKinds,
        sourceContextAdjusted: baseDelta !== rawBaseDelta,
        rawBaseDelta,
        rawEvidence: rawEvidence as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return applyCaps(input.affinity, candidates);
}

function sortMemoriesForReview(memories: Memory[]): Memory[] {
  return memories.sort((a, b) => {
    const tierDelta = (memoryTierRank[b.tier] ?? 0) - (memoryTierRank[a.tier] ?? 0);
    if (tierDelta !== 0) return tierDelta;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

function memoryReviewSemanticThreshold(memory: Memory): number {
  return memory.scope === "person"
    ? REVIEW_MEMORY_SEMANTIC_MIN_SCORE
    : REVIEW_MEMORY_GLOBAL_SEMANTIC_MIN_SCORE;
}

function buildMemoryReviewQuery(messages: DreamSourceMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
}

export function normalizeMemoryChanges(input: {
  raw: RawRelationshipReviewOutput;
  validUserMessageIds: Set<string>;
  currentMemories: Memory[];
}): NormalizedRelationshipMemoryChange[] {
  const currentMemoryById = new Map(
    input.currentMemories
      .filter((memory) => memory.scope === "person" && memory.personId)
      .map((memory) => [memory.id, memory])
  );
  const currentMemoryIds = new Set(currentMemoryById.keys());
  const changes: NormalizedRelationshipMemoryChange[] = [];
  const seen = new Set<string>();

  for (const rawChange of Array.isArray(input.raw.memoryChanges) ? input.raw.memoryChanges : []) {
    if (!memoryChangeTypes.has(rawChange.proposalType)) continue;
    if (rawChange.type === "relationship" || rawChange.type === "core") continue;

    const relationHint = cleanMemoryRelation(rawChange.relationToTarget);
    if (relationHint === "unrelated") continue;

    const sourceMessageIds = sourceMessageIdsFromList(
      rawChange.sourceMessageIds,
      input.validUserMessageIds
    );
    if (sourceMessageIds.length === 0) continue;

    const targetMemoryId = cleanText(rawChange.targetMemoryId, 120);
    const isCreate = rawChange.proposalType === "create_memory";
    if (!isCreate && (!targetMemoryId || !currentMemoryIds.has(targetMemoryId))) continue;

    const content = cleanText(rawChange.content, 1000);
    if (
      (rawChange.proposalType === "create_memory" ||
        rawChange.proposalType === "update_memory" ||
        rawChange.proposalType === "supersede_memory") &&
      !content
    ) {
      continue;
    }

    let proposalType = rawChange.proposalType;
    let finalTargetMemoryId = targetMemoryId ?? null;
    const type = cleanText(rawChange.type, 80) ?? "personal_fact";
    let relationToTarget: MemoryRelation | undefined = relationHint;

    if (proposalType === "create_memory" && content) {
      const duplicateTarget = findCreateDuplicateTarget({
        content,
        summary: rawChange.summary,
        type,
        currentMemories: input.currentMemories,
      });
      if (duplicateTarget) {
        relationToTarget = duplicateTarget.relation;
        proposalType =
          duplicateTarget.relation === "same_fact" ? "reinforce_memory" : "update_memory";
        finalTargetMemoryId = duplicateTarget.id;
      }
    } else if (targetMemoryId && content) {
      const target = currentMemoryById.get(targetMemoryId);
      if (target) {
        const inferred = inferMemoryRelation({
          content,
          summary: rawChange.summary,
          type,
          memory: target,
          relationHint,
        });
        relationToTarget = inferred?.relation ?? relationToTarget;
        if (relationToTarget === "related_but_distinct") continue;
        if (
          proposalType === "update_memory" &&
          (relationToTarget === "same_fact" || meaningfullySameMemoryContent(content, target))
        ) {
          proposalType = "reinforce_memory";
        }
      }
    } else if (
      proposalType === "reinforce_memory" &&
      (relationHint === "conflict" ||
        relationHint === "more_specific" ||
        relationHint === "newer_version" ||
        relationHint === "related_but_distinct")
    ) {
      continue;
    }

    const key = [
      proposalType,
      finalTargetMemoryId ?? "new",
      normalizeKeyPart(type),
      normalizeKeyPart((content ?? "").slice(0, 120)),
      sourceMessageIds.slice().sort().join(","),
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);

    changes.push({
      proposalType,
      relationToTarget,
      targetMemoryId: finalTargetMemoryId,
      type,
      content:
        proposalType === "archive_memory" || proposalType === "reinforce_memory"
          ? undefined
          : content ?? undefined,
      summary:
        proposalType === "archive_memory" || proposalType === "reinforce_memory"
          ? null
          : cleanPatchText(rawChange.summary, 240) ?? null,
      sourceMessageIds,
    });
  }

  return coalesceMemoryChanges(changes);
}

function findCreateDuplicateTarget(input: {
  content: string;
  summary?: string | null;
  type: string;
  currentMemories: Memory[];
}): { id: string; relation: MemoryRelation } | null {
  const candidates = input.currentMemories
    .filter((memory) => memory.scope === "person" && memory.type === input.type)
    .map((memory) => {
      const inferred = inferMemoryRelation({
        content: input.content,
        summary: input.summary,
        type: input.type,
        memory,
      });
      return inferred ? { memory, ...inferred } : null;
    })
    .filter((item): item is { memory: Memory; relation: MemoryRelation; matches: string[] } =>
      Boolean(item)
    )
    .filter((item) => item.relation !== "related_but_distinct" && item.relation !== "unrelated")
    .sort((a, b) => {
      const matchDelta = b.matches.join("").length - a.matches.join("").length;
      if (matchDelta !== 0) return matchDelta;
      const tierDelta = (memoryTierRank[b.memory.tier] ?? 0) - (memoryTierRank[a.memory.tier] ?? 0);
      if (tierDelta !== 0) return tierDelta;
      return b.memory.updatedAt.getTime() - a.memory.updatedAt.getTime();
    });

  const target = candidates[0];
  return target ? { id: target.memory.id, relation: target.relation } : null;
}

function memoryChangePriority(change: NormalizedRelationshipMemoryChange): number {
  switch (change.proposalType) {
    case "supersede_memory":
      return 5;
    case "update_memory":
      return 4;
    case "archive_memory":
      return 3;
    case "reinforce_memory":
      return 2;
    case "create_memory":
      return 1;
  }
}

function mergeMemoryChanges(
  current: NormalizedRelationshipMemoryChange,
  next: NormalizedRelationshipMemoryChange
): NormalizedRelationshipMemoryChange {
  const currentPriority = memoryChangePriority(current);
  const nextPriority = memoryChangePriority(next);
  const winner = nextPriority > currentPriority ? next : current;
  const loser = winner === next ? current : next;
  return {
    ...winner,
    sourceMessageIds: mergeStringArrays(current.sourceMessageIds, next.sourceMessageIds),
    relationToTarget: winner.relationToTarget ?? loser.relationToTarget,
  };
}

function coalesceMemoryChanges(
  changes: NormalizedRelationshipMemoryChange[]
): NormalizedRelationshipMemoryChange[] {
  const byTarget = new Map<string, NormalizedRelationshipMemoryChange>();
  const creates = new Map<string, NormalizedRelationshipMemoryChange>();
  const orderedTargetKeys: string[] = [];
  const orderedCreateKeys: string[] = [];

  for (const change of changes) {
    if (change.proposalType === "create_memory") {
      const key = [
        normalizeKeyPart(change.type ?? "personal_fact"),
        normalizeKeyPart((change.content ?? "").slice(0, 180)),
      ].join(":");
      const existing = creates.get(key);
      if (existing) {
        creates.set(key, mergeMemoryChanges(existing, change));
      } else {
        creates.set(key, change);
        orderedCreateKeys.push(key);
      }
      continue;
    }

    const targetKey = change.targetMemoryId;
    if (!targetKey) continue;
    const existing = byTarget.get(targetKey);
    if (existing) {
      byTarget.set(targetKey, mergeMemoryChanges(existing, change));
    } else {
      byTarget.set(targetKey, change);
      orderedTargetKeys.push(targetKey);
    }
  }

  return [
    ...orderedTargetKeys.map((key) => byTarget.get(key)).filter((item): item is NormalizedRelationshipMemoryChange => Boolean(item)),
    ...orderedCreateKeys.map((key) => creates.get(key)).filter((item): item is NormalizedRelationshipMemoryChange => Boolean(item)),
  ];
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
  mentionDayKeys: string[];
  lastMentionedAt: Date | null;
} {
  const sourceIdSet = new Set(sourceMessageIds);
  const messages = group.messages.filter((message) => sourceIdSet.has(message.id));
  const mentionDayKeys = Array.from(
    new Set(messages.map((message) => message.createdAt.toISOString().slice(0, 10)))
  );
  const lastMentionedAt = messages.reduce<Date | null>((latest, message) => {
    if (!latest || message.createdAt > latest) return message.createdAt;
    return latest;
  }, null);
  return { mentionDayKeys, lastMentionedAt };
}

function activeDayCountAfter(dayKeys: string[], date: Date | null | undefined): number {
  if (!date) return 0;
  const startDayKey = dayKeyFromDate(date);
  return dayKeys.filter((dayKey) => dayKey > startDayKey).length;
}

function latestActivityStart(memory: Pick<Memory, "lastMentionedAt" | "tierEnteredAt" | "createdAt">): Date {
  const candidates = [memory.lastMentionedAt, memory.tierEnteredAt, memory.createdAt].filter(
    (date): date is Date => Boolean(date)
  );
  return candidates.reduce((latest, date) => (date > latest ? date : latest), memory.createdAt);
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
  const candidateTerms = candidateTermsForMessages(input.group.messages);
  const messages = input.group.messages.map((message) => ({
    id: message.id,
    role: message.role,
    createdAt: message.createdAt.toISOString(),
    channel: message.channel,
    sourceKind: message.sourceKind,
    sourcePlatform: message.sourcePlatform,
    sourceType: message.sourceType,
    continuity: message.continuity,
    memoryEligible: message.memoryEligible,
    relationshipEligible: message.relationshipEligible,
    userId: message.userId,
    userDisplayName: message.userDisplayName,
    content: message.content,
  }));
  const currentMemories = input.currentMemories.map((memory) => ({
    id: memory.id,
    type: memory.type,
    scope: memory.scope,
    tier: memory.tier,
    tierMentionCount: memory.tierMentionCount,
    tierEnteredAt: memory.tierEnteredAt?.toISOString() ?? null,
    content: memory.content,
    summary: memory.summary,
    matchedTerms: matchedMemoryTerms(memory, candidateTerms.rareTerms),
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
      memoryCandidateHint:
        "currentMemories 已包含 semantic、tier/recent 候选，也包含和本轮用户消息有短实体/短语重合的候选。matchedTerms 命中时要特别检查喜欢/不喜欢、纠正、否定等反向事实。只有 scope=person 的记忆可以作为 memoryChanges 的目标，global/project/topic 只能参考。",
      sourceContextHint:
        "messages[].sourceKind 表示来源语境。private_chat 是连续私聊；platform_comment / platform_thread_reply 是公开平台评论线，非连续私聊，关系加权要更轻，但明确稳定事实仍可整理为个人记忆。",
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

    const lifecycleReviewCount = await this.reviewDueMemories({
      personId: input.group.relationship.personId,
    });

    const [currentMemoriesRaw, existingEvidenceKeys] = await Promise.all([
      this.fetchMemoryCandidatesForReview(input.group),
      prisma.relationshipReviewEvidence
        .findMany({
          where: { relationshipStateId: input.group.relationship.id },
          select: { evidenceKey: true },
        })
        .then((rows) => new Set(rows.map((row) => row.evidenceKey))),
    ]);
    const currentMemories = selectMemoriesForRelationshipReview(
      currentMemoriesRaw,
      input.group.messages
    );

    const raw = await dreamModelProvider.chatJson<RawRelationshipReviewOutput>(
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
      messageById: new Map(input.group.messages.map((message) => [message.id, message])),
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

    if (
      !hasPatch(patch) &&
      evidences.length === 0 &&
      memoryChanges.length === 0 &&
      lifecycleReviewCount === 0
    ) {
      return {
        proposalCount: lifecycleReviewCount,
        evidenceCount: 0,
        appliedCount: 0,
        pendingCount: 0,
        memoryChangeCount: lifecycleReviewCount,
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

    const appliedMemoryCount = await this.applyMemoryChanges({
      changes: memoryChanges,
      group: input.group,
    });

    return {
      proposalCount:
        (relationshipProposalId ? 1 : 0) +
        appliedMemoryCount +
        lifecycleReviewCount,
      evidenceCount: relationshipEvidenceCount,
      appliedCount,
      pendingCount,
      memoryChangeCount: appliedMemoryCount + lifecycleReviewCount,
      totalAffinityDelta,
    };
  }

  private async fetchMemoryCandidatesForReview(group: RelationshipMessageGroup): Promise<Memory[]> {
    const whereBase: Prisma.MemoryWhereInput = {
      personId: group.relationship.personId,
      scope: "person",
      status: "active",
    };
    const phraseTerms = phraseSearchTermsForMessages(group.messages);
    const phraseWhere: Prisma.MemoryWhereInput[] = phraseTerms.flatMap((term) => [
      { content: { contains: term, mode: "insensitive" } },
      { summary: { contains: term, mode: "insensitive" } },
    ]);

    const [baseMemories, phraseMemories, semanticMemories] = await Promise.all([
      prisma.memory.findMany({
        where: whereBase,
        orderBy: [{ updatedAt: "desc" }],
        take: REVIEW_MEMORY_RAW_BASE_LIMIT,
      }),
      phraseWhere.length > 0
        ? prisma.memory.findMany({
            where: {
              ...whereBase,
              OR: phraseWhere,
            },
            orderBy: [{ updatedAt: "desc" }],
            take: REVIEW_MEMORY_RAW_PHRASE_LIMIT,
          })
        : Promise.resolve([]),
      this.fetchSemanticMemoryCandidatesForReview(group),
    ]);

    const memories: Memory[] = [];
    const seen = new Set<string>();
    for (const memory of [...phraseMemories, ...semanticMemories, ...baseMemories]) {
      if (seen.has(memory.id)) continue;
      seen.add(memory.id);
      memories.push(memory);
    }
    return memories;
  }

  private async fetchSemanticMemoryCandidatesForReview(
    group: RelationshipMessageGroup
  ): Promise<Memory[]> {
    const query = buildMemoryReviewQuery(group.messages);
    if (!query) return [];

    try {
      const queryEmbedding = await embeddingProvider.embedText(query);
      const results = await pgVectorMemoryIndex.searchSimilarMemories({
        queryEmbedding,
        personId: group.relationship.personId,
        provider: embeddingProvider.providerName,
        model: embeddingProvider.model,
        dimensions: embeddingProvider.dimensions,
        topK: REVIEW_MEMORY_RAW_SEMANTIC_LIMIT,
      });
      const scoreById = new Map(results.map((result) => [result.memoryId, result.score]));
      const ids = results.map((result) => result.memoryId);
      if (ids.length === 0) return [];

      const memories = await prisma.memory.findMany({
        where: {
          id: { in: ids },
          status: "active",
          OR: [
            {
              personId: group.relationship.personId,
              scope: "person",
            },
            {
              personId: null,
              scope: { in: GLOBAL_MEMORY_SCOPES },
            },
          ],
        },
      });
      const memoryById = new Map(memories.map((memory) => [memory.id, memory]));

      return ids
        .map((id) => memoryById.get(id))
        .filter((memory): memory is Memory => Boolean(memory))
        .filter((memory) => {
          const score = scoreById.get(memory.id) ?? 0;
          return score >= memoryReviewSemanticThreshold(memory);
        });
    } catch (err) {
      console.warn("[dream] semantic memory candidate recall failed:", err);
      return [];
    }
  }

  private async applyMemoryChanges(input: {
    changes: NormalizedRelationshipMemoryChange[];
    group: RelationshipMessageGroup;
  }): Promise<number> {
    let appliedCount = 0;

    for (const change of input.changes) {
      const result = await this.applyMemoryChange({
        change,
        group: input.group,
      });
      if (result.changed) appliedCount += 1;
      if (result.memory?.status === "active") {
        memoryService.generateAndStoreEmbedding(result.memory).catch((err) =>
          console.warn("[dream] personal memory embedding failed:", err)
        );
      }
    }

    return appliedCount;
  }

  private async activeChatDayKeysForPerson(personId: string, after: Date | null): Promise<string[]> {
    const links = await prisma.identityLink.findMany({
      where: { personId },
      select: { userId: true },
    });
    const userIds = links.map((link) => link.userId);
    if (userIds.length === 0) return [];

    const where: Prisma.MessageWhereInput = {
      role: "user",
      conversation: { userId: { in: userIds } },
    };
    if (after) where.createdAt = { gt: after };

    const rows = await prisma.message.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });

    return Array.from(new Set(rows.map((row) => dayKeyFromDate(row.createdAt)))).sort();
  }

  private async reviewDueMemories(input: {
    personId: string;
  }): Promise<number> {
    const now = new Date();
    const dueMemories = await prisma.memory.findMany({
      where: {
        personId: input.personId,
        scope: "person",
        status: "active",
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    });
    const earliestActivityStart = dueMemories.reduce<Date | null>((earliest, memory) => {
      const start = latestActivityStart(memory);
      if (!earliest || start < earliest) return start;
      return earliest;
    }, null);
    const activeDayKeys = await this.activeChatDayKeysForPerson(
      input.personId,
      earliestActivityStart
    );

    let appliedCount = 0;
    for (const memory of dueMemories) {
      const activeDayCountSinceWindowStart = activeDayCountAfter(
        activeDayKeys,
        latestActivityStart(memory)
      );
      const patch = buildMemoryAgingPatch(memory, {
        now,
        activeDayCountSinceWindowStart,
      });
      if (!patch) continue;

      const data: Prisma.MemoryUncheckedUpdateInput = {};
      if (patch.tier !== undefined) data.tier = patch.tier;
      if (patch.tierMentionCount !== undefined) {
        data.tierMentionCount = patch.tierMentionCount;
      }
      if (patch.tierEnteredAt !== undefined) data.tierEnteredAt = patch.tierEnteredAt;
      if (patch.status !== undefined) data.status = patch.status;
      const hasMeaningfulChange = Object.keys(data).length > 0;
      if (!hasMeaningfulChange) continue;

      const updated = await prisma.memory.update({
        where: { id: memory.id },
        data,
      });
      appliedCount += 1;

      if (updated.status === "active" && patch.tier !== undefined) {
        memoryService.generateAndStoreEmbedding(updated).catch((err) =>
          console.warn("[dream] memory lifecycle embedding failed:", err)
        );
      }
    }

    return appliedCount;
  }

  private async applyMemoryChange(input: {
    change: NormalizedRelationshipMemoryChange;
    group: RelationshipMessageGroup;
  }): Promise<{ memory: Memory | null; changed: boolean }> {
    const { change, group } = input;
    const sourceInfo = sourceInfoForChange(group, change.sourceMessageIds);
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      if (change.proposalType === "create_memory") {
        if (!change.content) return { memory: null, changed: false };
        const lifecycle = buildMemoryReinforcement({
          scope: "person",
          sourceDayKeys: sourceInfo.mentionDayKeys,
          lastMentionedAt: sourceInfo.lastMentionedAt,
          now,
        });
        const memory = await tx.memory.create({
          data: {
            personId: group.relationship.personId,
            scope: "person",
            type: change.type ?? "personal_fact",
            tier: lifecycle.tier,
            tierMentionCount: lifecycle.tierMentionCount,
            tierEnteredAt: lifecycle.tierEnteredAt,
            content: change.content,
            summary: change.summary ?? null,
            status: "active",
            sourceMessageIds: change.sourceMessageIds,
            mentionDayKeys: lifecycle.mentionDayKeys,
            lastMentionedAt: lifecycle.lastMentionedAt,
          },
        });
        return { memory, changed: true };
      }

      if (!change.targetMemoryId) return { memory: null, changed: false };
      const target = await tx.memory.findFirst({
        where: {
          id: change.targetMemoryId,
          personId: group.relationship.personId,
          scope: "person",
        },
      });
      if (!target) return { memory: null, changed: false };

      if (change.proposalType === "archive_memory") {
        const memory = await tx.memory.update({
          where: { id: target.id },
          data: { status: "archived" },
        });
        return { memory, changed: true };
      }

      if (change.proposalType === "reinforce_memory") {
        const lifecycle = buildMemoryReinforcement({
          existing: target,
          scope: "person",
          sourceDayKeys: sourceInfo.mentionDayKeys,
          lastMentionedAt: sourceInfo.lastMentionedAt,
          now,
        });
        const memory = await tx.memory.update({
          where: { id: target.id },
          data: {
            tier: lifecycle.tier,
            tierMentionCount: lifecycle.tierMentionCount,
            tierEnteredAt: lifecycle.tierEnteredAt,
            sourceMessageIds: mergeStringArrays(target.sourceMessageIds, change.sourceMessageIds),
            mentionDayKeys: lifecycle.mentionDayKeys,
            lastMentionedAt: lifecycle.lastMentionedAt,
          },
        });
        return { memory, changed: true };
      }

      if (change.proposalType === "supersede_memory") {
        if (!change.content) return { memory: null, changed: false };
        await tx.memory.update({
          where: { id: target.id },
          data: { status: "superseded" },
        });
        const lifecycle = buildMemoryReinforcement({
          scope: "person",
          sourceDayKeys: sourceInfo.mentionDayKeys,
          lastMentionedAt: sourceInfo.lastMentionedAt,
          now,
        });
        const memory = await tx.memory.create({
          data: {
            personId: group.relationship.personId,
            scope: "person",
            type: change.type ?? target.type,
            tier: lifecycle.tier,
            tierMentionCount: lifecycle.tierMentionCount,
            tierEnteredAt: lifecycle.tierEnteredAt,
            content: change.content,
            summary: change.summary ?? null,
            status: "active",
            sourceMessageIds: change.sourceMessageIds,
            mentionDayKeys: lifecycle.mentionDayKeys,
            lastMentionedAt: lifecycle.lastMentionedAt,
          },
        });
        return { memory, changed: true };
      }

      const lifecycle = buildMemoryReinforcement({
        existing: target,
        scope: "person",
        sourceDayKeys: sourceInfo.mentionDayKeys,
        lastMentionedAt: sourceInfo.lastMentionedAt,
        now,
      });
      if (!change.content) return { memory: null, changed: false };
      const updated = await tx.memory.update({
        where: { id: target.id },
        data: {
          type: change.type ?? target.type,
          tier: lifecycle.tier,
          tierMentionCount: lifecycle.tierMentionCount,
          tierEnteredAt: lifecycle.tierEnteredAt,
          content: change.content,
          summary: change.summary ?? null,
          sourceMessageIds: mergeStringArrays(target.sourceMessageIds, change.sourceMessageIds),
          mentionDayKeys: lifecycle.mentionDayKeys,
          lastMentionedAt: lifecycle.lastMentionedAt,
        },
      });
      return { memory: updated, changed: true };
    });
  }
}

export const dreamRelationshipReviewOrganizer = new DreamRelationshipReviewOrganizer();
