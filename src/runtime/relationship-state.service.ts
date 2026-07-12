import { Prisma, type RelationshipState } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { isOwnerExternalId, ownerExternalIds } from "../core/owner-identity.js";

export interface RelationshipStatePatch {
  relationshipLabel?: string;
  affinity?: number;
  userIntroduction?: string | null;
  interactionStyle?: string | null;
  summary?: string | null;
  recentSignal?: string | null;
  statusNote?: string | null;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  lastInteractionAt?: Date | null;
}

interface ObserveRelationshipTurnInput {
  userId: string;
  conversationId: string;
  messageId?: string;
  channel: string;
  userMessage: string;
  assistantReply: string;
  isOwner?: boolean;
}

interface ApplyRelationshipPatchInput {
  relationshipId: string;
  patch: RelationshipStatePatch;
  eventType: string;
  source: string;
  summary?: string;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  channel?: string;
}

interface ObserveIdentitySignalInput {
  userId: string;
  conversationId: string;
  messageId?: string;
  channel: string;
  userMessage: string;
  displayName?: string | null;
}

interface IdentityCandidateUser {
  id: string;
  externalId: string;
  displayName: string | null;
}

interface IdentityCandidateAlias {
  value: string;
  normalizedValue: string;
  sourceUserId: string | null;
  confidence: number;
}

interface IdentityCandidatePerson {
  id: string;
  label: string | null;
  identityAliases: IdentityCandidateAlias[];
  identityLinks: Array<{ user: IdentityCandidateUser }>;
}

interface IdentityCandidateMatch {
  confidence: number;
  matchedHints: string[];
  matchedTerms: string[];
  targetUserId?: string;
}

const defaultRelationshipState = {
  relationshipLabel: "刚认识",
  affinity: 10,
  userIntroduction: "还没有足够资料，只知道这是一个刚开始和思源接触的人。",
  interactionStyle: "慢热但不冷淡，先保持自然、礼貌和稳定。",
  summary: "还没有形成明确关系，只按当下对话慢慢认识。",
  recentSignal: "等待更多真实互动。",
  statusNote: "默认关系状态已初始化。",
} satisfies Omit<
  Prisma.RelationshipStateCreateInput,
  "person"
>;

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function boundedNumber(value: unknown, fallback: number, min = 0, max = 100): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? clampInt(parsed, min, max) : fallback;
}

function cleanText(value: unknown, maxChars: number): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}…` : trimmed;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function metadataWith(
  current: Prisma.JsonValue | null,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  return {
    ...(readRecord(current) as Prisma.InputJsonObject),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export function relationshipLabelFromAffinity(affinity: number): string {
  const value = clampInt(affinity, 0, 100);
  if (value >= 85) return "非常熟悉";
  if (value >= 65) return "很熟悉";
  if (value >= 40) return "熟悉稳定";
  if (value >= 20) return "逐渐熟悉";
  return "刚认识";
}

export function relationshipAutoUpdateEnabled(metadata: Prisma.JsonValue | null): boolean {
  const value = readRecord(metadata).autoUpdateEnabled;
  return typeof value === "boolean" ? value : true;
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

function normalizePatch(patch: RelationshipStatePatch): Prisma.RelationshipStateUpdateInput {
  const data: Prisma.RelationshipStateUpdateInput = {};

  if (patch.relationshipLabel !== undefined) {
    data.relationshipLabel = cleanText(patch.relationshipLabel, 60) ?? "刚认识";
  }
  if (patch.affinity !== undefined) {
    const affinity = clampInt(patch.affinity, 0, 100);
    data.affinity = affinity;
    if (patch.relationshipLabel === undefined) {
      data.relationshipLabel = relationshipLabelFromAffinity(affinity);
    }
  }
  if (patch.userIntroduction !== undefined) {
    data.userIntroduction = cleanText(patch.userIntroduction, 420);
  }
  if (patch.interactionStyle !== undefined) {
    data.interactionStyle = cleanText(patch.interactionStyle, 220);
  }
  if (patch.summary !== undefined) data.summary = cleanText(patch.summary, 320);
  if (patch.recentSignal !== undefined) {
    data.recentSignal = cleanText(patch.recentSignal, 220);
  }
  if (patch.statusNote !== undefined) data.statusNote = cleanText(patch.statusNote, 220);
  if (patch.metadata !== undefined) data.metadata = patch.metadata;
  if (patch.lastInteractionAt !== undefined) data.lastInteractionAt = patch.lastInteractionAt;

  return data;
}

function summarizePatch(patch: RelationshipStatePatch): string {
  const parts = [
    patch.relationshipLabel ? `关系：${patch.relationshipLabel}` : "",
    patch.affinity !== undefined ? `好感度 ${patch.affinity}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("；") : "关系状态已更新。";
}

function patchToJson(patch: RelationshipStatePatch): Prisma.InputJsonObject {
  const json: Record<string, Prisma.InputJsonValue | null> = {};
  if (patch.relationshipLabel !== undefined) json.relationshipLabel = patch.relationshipLabel;
  if (patch.affinity !== undefined) json.affinity = patch.affinity;
  if (patch.userIntroduction !== undefined) json.userIntroduction = patch.userIntroduction;
  if (patch.interactionStyle !== undefined) json.interactionStyle = patch.interactionStyle;
  if (patch.summary !== undefined) json.summary = patch.summary;
  if (patch.recentSignal !== undefined) json.recentSignal = patch.recentSignal;
  if (patch.statusNote !== undefined) json.statusNote = patch.statusNote;
  if (patch.metadata !== undefined) {
    json.metadata =
      patch.metadata === Prisma.JsonNull || patch.metadata === Prisma.DbNull
        ? null
        : (patch.metadata as Prisma.InputJsonValue);
  }
  if (patch.lastInteractionAt !== undefined) {
    json.lastInteractionAt = patch.lastInteractionAt?.toISOString() ?? null;
  }
  return json as Prisma.InputJsonObject;
}

function patchFromJsonForState(
  state: RelationshipState,
  value: unknown
): RelationshipStatePatch {
  const input = readRecord(value);
  const patch: RelationshipStatePatch = {};

  if (Object.prototype.hasOwnProperty.call(input, "relationshipLabel")) {
    patch.relationshipLabel = cleanText(input.relationshipLabel, 60) ?? state.relationshipLabel;
  }
  if (Object.prototype.hasOwnProperty.call(input, "affinity")) {
    patch.affinity = boundedNumber(input.affinity, state.affinity);
    if (
      !Object.prototype.hasOwnProperty.call(input, "relationshipLabel") ||
      patch.relationshipLabel === state.relationshipLabel
    ) {
      patch.relationshipLabel = relationshipLabelFromAffinity(patch.affinity);
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, "userIntroduction")) {
    patch.userIntroduction = cleanText(input.userIntroduction, 420);
  }
  if (Object.prototype.hasOwnProperty.call(input, "interactionStyle")) {
    patch.interactionStyle = cleanText(input.interactionStyle, 220);
  }
  if (Object.prototype.hasOwnProperty.call(input, "summary")) {
    patch.summary = cleanText(input.summary, 320);
  }
  return patch;
}

function patchHasCoreChanges(state: RelationshipState, patch: RelationshipStatePatch): boolean {
  return (
    (patch.relationshipLabel !== undefined && patch.relationshipLabel !== state.relationshipLabel) ||
    (patch.affinity !== undefined && patch.affinity !== state.affinity) ||
    (patch.userIntroduction !== undefined && patch.userIntroduction !== state.userIntroduction) ||
    (patch.interactionStyle !== undefined && patch.interactionStyle !== state.interactionStyle) ||
    (patch.summary !== undefined && patch.summary !== state.summary)
  );
}

function latestDate(...values: Array<Date | null | undefined>): Date | null {
  return values
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function normalizeIdentityToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[\s"'“”‘’`，,。.!！?？:：；;、()（）[\]【】<>《》]+/gu, "");
}

function cleanIdentityHint(value: string): string {
  return value
    .trim()
    .replace(/^[@\s"'“”‘’`，,。.!！?？:：；;、()（）[\]【】<>《》]+/gu, "")
    .replace(/[@\s"'“”‘’`，,。.!！?？:：；;、()（）[\]【】<>《》]+$/gu, "");
}

const identityStopWords = new Set([
  "我",
  "你",
  "他",
  "她",
  "之前",
  "以前",
  "上次",
  "刚才",
  "那个",
  "这个",
  "小号",
  "账号",
  "用户",
  "微信",
  "weixin",
  "telegram",
  "tg",
  "web",
  "网页",
  "owner",
  "admin",
  "陆思源",
  "思源",
  "lusiyuan",
]);

function isUsefulIdentityHint(value: string): boolean {
  const normalized = normalizeIdentityToken(value);
  if (normalized.length < 2 || normalized.length > 32) return false;
  if (identityStopWords.has(normalized)) return false;
  if (/^[a-z0-9_.-]+$/iu.test(normalized) && normalized.length < 3) return false;
  if (/^(你|之前|以前|上次|刚才|那个|这个)/u.test(normalized)) return false;
  if (/^(微信|网页|web|telegram|tg)?用户\d*$/iu.test(normalized)) return false;
  if (/^(游客|访客)\d*$/u.test(normalized)) return false;
  return true;
}

function uniqueIdentityHints(values: string[]): string[] {
  const seen = new Set<string>();
  const hints: string[] = [];
  for (const value of values) {
    const hint = cleanIdentityHint(value);
    const key = normalizeIdentityToken(hint);
    if (!isUsefulIdentityHint(hint) || seen.has(key)) continue;
    seen.add(key);
    hints.push(hint);
  }
  return hints;
}

function displayNameIdentityHints(...values: Array<string | null | undefined>): string[] {
  return uniqueIdentityHints(values.map((value) => value ?? ""));
}

async function recordSelfIdentityAliases(input: {
  personId: string;
  userId: string;
  hints: string[];
  source?: string;
  confidence?: number;
  observedAt?: Date;
}) {
  const aliases = uniqueIdentityHints(input.hints);
  if (aliases.length === 0) return;
  const observedAt = input.observedAt ?? new Date();
  const source = input.source ?? "self_identification";
  const confidence = input.confidence ?? 0.78;
  for (const value of aliases) {
    const normalizedValue = normalizeIdentityToken(value);
    if (!normalizedValue) continue;
    await prisma.identityAlias.upsert({
      where: {
        personId_normalizedValue: {
          personId: input.personId,
          normalizedValue,
        },
      },
      create: {
        personId: input.personId,
        sourceUserId: input.userId,
        value,
        normalizedValue,
        source,
        confidence,
        mentionCount: 1,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
      },
      update: {
        sourceUserId: input.userId,
        value,
        source,
        confidence,
        mentionCount: { increment: 1 },
        lastSeenAt: observedAt,
      },
    });
  }
}

export function extractIdentityHints(message: string): string[] {
  const patterns = [
    /我是(?:你)?(?:之前|以前|上次|刚才)?(?:在|用)?(?:微信|weixin|wx|telegram|tg|网页|web)?(?:上|里)?(?:聊过的|认识的|那个|的)\s*([@A-Za-z0-9_.\-\u4e00-\u9fa5]{2,32})/giu,
    /(?:微信|weixin|wx|telegram|tg|网页|web)(?:上|里)?(?:的)?(?:我|账号|号)?(?:是|叫)\s*([@A-Za-z0-9_.\-\u4e00-\u9fa5]{2,32})/giu,
    /(?:我叫|叫我|我是)\s*([@A-Za-z0-9_.\-\u4e00-\u9fa5]{2,32})/giu,
  ];
  const hints: string[] = [];
  for (const pattern of patterns) {
    for (const match of message.matchAll(pattern)) {
      if (match[1]) hints.push(match[1]);
    }
  }
  return uniqueIdentityHints(hints);
}

function identityTermValues(value: string | null | undefined): string[] {
  if (!value) return [];
  const trimmed = cleanIdentityHint(value);
  const pieces = [trimmed];
  const afterColon = trimmed.split(":").pop();
  if (afterColon && afterColon !== trimmed) pieces.push(afterColon);
  const afterSlash = trimmed.split("/").pop();
  if (afterSlash && afterSlash !== trimmed) pieces.push(afterSlash);
  return uniqueIdentityHints(pieces);
}

function identityTermsForCandidate(candidate: IdentityCandidatePerson) {
  const terms: Array<{ value: string; normalized: string; userId?: string; confidence?: number }> = [];
  for (const value of identityTermValues(candidate.label)) {
    terms.push({ value, normalized: normalizeIdentityToken(value) });
  }
  for (const alias of candidate.identityAliases) {
    for (const value of identityTermValues(alias.value)) {
      terms.push({
        value,
        normalized: alias.normalizedValue || normalizeIdentityToken(value),
        userId: alias.sourceUserId ?? undefined,
        confidence: alias.confidence,
      });
    }
  }
  for (const link of candidate.identityLinks) {
    for (const value of identityTermValues(link.user.displayName)) {
      terms.push({
        value,
        normalized: normalizeIdentityToken(value),
        userId: link.user.id,
      });
    }
    for (const value of identityTermValues(link.user.externalId)) {
      terms.push({
        value,
        normalized: normalizeIdentityToken(value),
        userId: link.user.id,
      });
    }
  }
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = `${term.normalized}:${term.userId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return term.normalized.length > 0;
  });
}

function matchIdentityCandidate(
  hints: string[],
  explicitHints: Set<string>,
  candidate: IdentityCandidatePerson
): IdentityCandidateMatch | null {
  const terms = identityTermsForCandidate(candidate);
  let confidence = 0;
  let targetUserId: string | undefined;
  const matchedHints = new Set<string>();
  const matchedTerms = new Set<string>();

  for (const hint of hints) {
    const normalizedHint = normalizeIdentityToken(hint);
    const explicit = explicitHints.has(normalizedHint);
    for (const term of terms) {
      let score = 0;
      if (normalizedHint === term.normalized) {
        score = explicit ? 0.84 : 0.72;
      } else if (
        normalizedHint.length >= 3 &&
        term.normalized.length >= 3 &&
        (normalizedHint.includes(term.normalized) || term.normalized.includes(normalizedHint))
      ) {
        score = explicit ? 0.72 : 0.62;
      }
      if (score > 0 && term.confidence !== undefined) {
        score *= term.confidence;
      }

      if (score > confidence) {
        confidence = score;
        targetUserId = term.userId;
      }
      if (score >= 0.62) {
        matchedHints.add(hint);
        matchedTerms.add(term.value);
      }
    }
  }

  if (confidence < 0.62) return null;
  return {
    confidence,
    matchedHints: Array.from(matchedHints),
    matchedTerms: Array.from(matchedTerms),
    targetUserId,
  };
}

export const relationshipStateService = {
  async getOrCreatePersonForUser(userId: string) {
    const existingLink = await prisma.identityLink.findUnique({
      where: { userId },
      include: { person: true },
    });
    if (existingLink) return existingLink.person;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, externalId: true, displayName: true, createdAt: true },
    });

    if (isOwnerExternalId(user.externalId)) {
      const ownerLink = await prisma.identityLink.findFirst({
        where: {
          user: {
            externalId: {
              in: ownerExternalIds().filter((externalId) => externalId !== user.externalId),
            },
          },
        },
        include: { person: true },
        orderBy: { createdAt: "asc" },
      });
      if (ownerLink) {
        await prisma.identityLink.create({
          data: {
            personId: ownerLink.personId,
            userId: user.id,
            source: "owner_alias",
            verifiedBy: "system",
          },
        });
        return ownerLink.person;
      }
    }

    return prisma.$transaction(async (tx) => {
      const person = await tx.personIdentity.create({
        data: {
          label: user.displayName ?? (isOwnerExternalId(user.externalId) ? "Owner" : user.externalId),
          note: isOwnerExternalId(user.externalId)
            ? "Owner 的主身份。其他 owner 渠道账号会自动链接到这个人。"
            : "由 User 自动生成的单人身份。",
          createdAt: user.createdAt,
        },
      });
      await tx.identityLink.create({
        data: {
          personId: person.id,
          userId: user.id,
          source: "auto_singleton",
        },
      });
      return person;
    });
  },

  async getOrCreate(userId: string): Promise<RelationshipState> {
    const person = await this.getOrCreatePersonForUser(userId);
    return prisma.relationshipState.upsert({
      where: { personId: person.id },
      update: {},
      create: {
        ...defaultRelationshipState,
        person: { connect: { id: person.id } },
      },
    });
  },

  async getOrCreateForPerson(personId: string): Promise<RelationshipState> {
    return prisma.relationshipState.upsert({
      where: { personId },
      update: {},
      create: {
        ...defaultRelationshipState,
        person: { connect: { id: personId } },
      },
    });
  },

  async ensureRelationshipRecordsForUsers(limit = 500): Promise<number> {
    const users = await prisma.user.findMany({
      where: { identityLink: { is: null } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: clampInt(limit, 1, 2_000),
    });

    for (const user of users) {
      await this.getOrCreate(user.id);
    }

    const people = await prisma.personIdentity.findMany({
      where: { relationshipState: { is: null } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: clampInt(limit, 1, 2_000),
    });

    for (const person of people) {
      await this.getOrCreateForPerson(person.id);
    }

    return users.length + people.length;
  },

  async list(limit = 80, search?: string) {
    const q = cleanText(search, 80);
    return prisma.relationshipState.findMany({
      where: q
        ? {
            OR: [
              { id: { contains: q, mode: "insensitive" } },
              { relationshipLabel: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { recentSignal: { contains: q, mode: "insensitive" } },
              {
                person: {
                  is: {
                    OR: [
                      { id: { contains: q, mode: "insensitive" } },
                      { label: { contains: q, mode: "insensitive" } },
                      {
                        identityAliases: {
                          some: {
                            value: { contains: q, mode: "insensitive" },
                          },
                        },
                      },
                      {
                        identityLinks: {
                          some: {
                            user: {
                              OR: [
                                { id: { contains: q, mode: "insensitive" } },
                                { externalId: { contains: q, mode: "insensitive" } },
                                { displayName: { contains: q, mode: "insensitive" } },
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {},
      include: {
        person: {
          include: {
            identityAliases: {
              orderBy: [{ lastSeenAt: "desc" }],
            },
            identityLinks: {
              include: {
                user: { select: { id: true, externalId: true, displayName: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: clampInt(limit, 1, 200),
    });
  },

  async listEvents(relationshipId: string, limit = 20) {
    return prisma.relationshipStateEvent.findMany({
      where: { relationshipStateId: relationshipId },
      orderBy: { createdAt: "desc" },
      take: clampInt(limit, 1, 100),
    });
  },

  async getDetail(relationshipId: string, limit = 20) {
    const relationship = await prisma.relationshipState.findUnique({
      where: { id: relationshipId },
      include: {
        person: {
          include: {
            identityAliases: {
              orderBy: [{ lastSeenAt: "desc" }],
            },
            identityLinks: {
              include: {
                user: { select: { id: true, externalId: true, displayName: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
    if (!relationship) {
      throw serviceError("Relationship not found", 404);
    }
    const [events, reviewProposals] = await Promise.all([
      this.listEvents(relationshipId, limit),
      prisma.relationshipReviewProposal.findMany({
        where: { relationshipStateId: relationshipId },
        orderBy: { createdAt: "desc" },
        take: clampInt(limit, 1, 100),
        include: {
          evidences: {
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    ]);
    return { relationship, events, reviewProposals };
  },

  async listIdentityLinkProposals(status = "pending", limit = 50) {
    const where =
      status && status !== "all"
        ? {
            status,
          }
        : {};
    return prisma.identityLinkProposal.findMany({
      where,
      include: {
        sourceUser: { select: { id: true, externalId: true, displayName: true } },
        targetUser: { select: { id: true, externalId: true, displayName: true } },
        targetPerson: {
          include: {
            identityAliases: {
              orderBy: [{ lastSeenAt: "desc" }],
            },
            identityLinks: {
              include: {
                user: { select: { id: true, externalId: true, displayName: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: clampInt(limit, 1, 100),
    });
  },

  async mergeRelationships(input: {
    sourceRelationshipId: string;
    targetRelationshipId: string;
    source?: string;
    reviewedBy?: string;
  }): Promise<RelationshipState> {
    if (input.sourceRelationshipId === input.targetRelationshipId) {
      throw serviceError("不能合并同一个身份。", 400);
    }

    const [sourceState, targetState] = await Promise.all([
      prisma.relationshipState.findUnique({
        where: { id: input.sourceRelationshipId },
        include: {
          person: {
            include: {
              identityLinks: {
                include: {
                  user: { select: { id: true, externalId: true, displayName: true } },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      }),
      prisma.relationshipState.findUnique({
        where: { id: input.targetRelationshipId },
        include: {
          person: {
            include: {
              identityLinks: {
                include: {
                  user: { select: { id: true, externalId: true, displayName: true } },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      }),
    ]);

    if (!sourceState) throw serviceError("Source relationship not found", 404);
    if (!targetState) throw serviceError("Target relationship not found", 404);
    if (sourceState.personId === targetState.personId) return targetState;

    return prisma.$transaction(async (tx) => {
      const source = input.source ?? "admin_identity_merge";
      const reviewer = input.reviewedBy ?? "admin";
      const reviewedAt = new Date();
      const affinity = Math.max(targetState.affinity, sourceState.affinity);
      const sourceUserIds = sourceState.person.identityLinks.map((link) => link.user.id);
      const targetUserIds = targetState.person.identityLinks.map((link) => link.user.id);
      const mergedUserIds = Array.from(new Set([...sourceUserIds, ...targetUserIds]));
      const sourceLabel =
        sourceState.person.label ??
        sourceState.person.identityLinks[0]?.user.displayName ??
        sourceState.person.identityLinks[0]?.user.externalId ??
        sourceState.personId;
      const targetLabel =
        targetState.person.label ??
        targetState.person.identityLinks[0]?.user.displayName ??
        targetState.person.identityLinks[0]?.user.externalId ??
        targetState.personId;
      const patch: RelationshipStatePatch = {
        affinity,
        relationshipLabel: relationshipLabelFromAffinity(affinity),
        summary: [
          targetState.summary,
          sourceState.summary,
          `已由 admin 确认「${sourceLabel}」和「${targetLabel}」是同一个身份，并合并关系状态。`,
        ]
          .filter(Boolean)
          .join("\n"),
        recentSignal: "admin 手动合并了两个身份，后续多个渠道共享这一份关系。",
        statusNote: "由身份合并产生；好感度保留合并前更高的一侧。",
        lastInteractionAt: latestDate(targetState.lastInteractionAt, sourceState.lastInteractionAt),
        metadata: metadataWith(targetState.metadata, {
          lastIdentityMerge: {
            at: new Date().toISOString(),
            sourcePersonId: sourceState.personId,
            sourceRelationshipId: sourceState.id,
            targetPersonId: targetState.personId,
            targetRelationshipId: targetState.id,
            sourceAffinity: sourceState.affinity,
            targetAffinity: targetState.affinity,
            mergedAffinity: affinity,
            source,
          },
        }),
      };

      const updatedTarget = await tx.relationshipState.update({
        where: { id: targetState.id },
        data: normalizePatch(patch),
      });

      await tx.identityLink.updateMany({
        where: { personId: sourceState.personId },
        data: {
          personId: targetState.personId,
          source,
          verifiedBy: reviewer,
        },
      });
      const [sourceAliases, targetAliases] = await Promise.all([
        tx.identityAlias.findMany({
          where: { personId: sourceState.personId },
        }),
        tx.identityAlias.findMany({
          where: { personId: targetState.personId },
          select: { id: true, normalizedValue: true, firstSeenAt: true, lastSeenAt: true },
        }),
      ]);
      const targetAliasByKey = new Map(targetAliases.map((alias) => [alias.normalizedValue, alias]));
      for (const alias of sourceAliases) {
        const existing = targetAliasByKey.get(alias.normalizedValue);
        if (existing) {
          await tx.identityAlias.update({
            where: { id: existing.id },
            data: {
              mentionCount: { increment: alias.mentionCount },
              firstSeenAt: alias.firstSeenAt < existing.firstSeenAt ? alias.firstSeenAt : existing.firstSeenAt,
              lastSeenAt: alias.lastSeenAt > existing.lastSeenAt ? alias.lastSeenAt : existing.lastSeenAt,
            },
          });
          await tx.identityAlias.delete({ where: { id: alias.id } });
        } else {
          await tx.identityAlias.update({
            where: { id: alias.id },
            data: { personId: targetState.personId },
          });
        }
      }
      await tx.relationshipStateEvent.updateMany({
        where: { relationshipStateId: sourceState.id },
        data: {
          relationshipStateId: targetState.id,
          personId: targetState.personId,
        },
      });
      await tx.relationshipReviewProposal.updateMany({
        where: { relationshipStateId: sourceState.id },
        data: {
          relationshipStateId: targetState.id,
          personId: targetState.personId,
        },
      });

      const sourceEvidences = await tx.relationshipReviewEvidence.findMany({
        where: { relationshipStateId: sourceState.id },
        select: { id: true, evidenceKey: true },
      });
      const targetEvidenceKeys = new Set(
        (
          await tx.relationshipReviewEvidence.findMany({
            where: { relationshipStateId: targetState.id },
            select: { evidenceKey: true },
          })
        ).map((evidence) => evidence.evidenceKey)
      );
      for (const evidence of sourceEvidences) {
        const evidenceKey = targetEvidenceKeys.has(evidence.evidenceKey)
          ? `${evidence.evidenceKey}:merged:${evidence.id}`
          : evidence.evidenceKey;
        targetEvidenceKeys.add(evidenceKey);
        await tx.relationshipReviewEvidence.update({
          where: { id: evidence.id },
          data: {
            relationshipStateId: targetState.id,
            personId: targetState.personId,
            evidenceKey,
          },
        });
      }

      await tx.identityLinkProposal.updateMany({
        where: { targetPersonId: sourceState.personId },
        data: {
          targetPersonId: targetState.personId,
        },
      });
      if (mergedUserIds.length > 0) {
        await tx.identityLinkProposal.updateMany({
          where: {
            status: "pending",
            targetPersonId: targetState.personId,
            sourceUserId: { in: mergedUserIds },
          },
          data: {
            status: "approved",
            reviewedBy: reviewer,
            reviewedAt,
          },
        });
        await tx.identityLinkProposal.updateMany({
          where: {
            status: "pending",
            sourceUserId: { in: mergedUserIds },
          },
          data: {
            status: "superseded",
            reviewedBy: reviewer,
            reviewedAt,
          },
        });
      }
      await tx.memory.updateMany({
        where: { personId: sourceState.personId },
        data: { personId: targetState.personId },
      });
      await tx.relationshipState.delete({ where: { id: sourceState.id } });
      await tx.personIdentity.delete({ where: { id: sourceState.personId } });
      await tx.relationshipStateEvent.create({
        data: {
          relationshipStateId: updatedTarget.id,
          personId: updatedTarget.personId,
          eventType: "identity_merge",
          source,
          summary: `Admin 确认「${sourceLabel}」和「${targetLabel}」是同一个身份，合并关系状态。`,
          patch: patchToJson(patch),
          before: {
            target: snapshotRelationshipState(targetState),
            source: snapshotRelationshipState(sourceState),
          },
          after: snapshotRelationshipState(updatedTarget),
        },
      });

      return updatedTarget;
    });
  },

  async splitRelationshipIdentity(input: {
    relationshipId: string;
    userIds: string[];
    newLabel?: string;
    newAffinity?: number;
    source?: string;
    reviewedBy?: string;
  }): Promise<RelationshipState> {
    const userIds = Array.from(new Set(input.userIds.map((id) => id.trim()).filter(Boolean)));
    if (userIds.length === 0) {
      throw serviceError("至少选择一个渠道账号。", 400);
    }

    const sourceState = await prisma.relationshipState.findUnique({
      where: { id: input.relationshipId },
      include: {
        person: {
          include: {
            identityLinks: {
              include: {
                user: { select: { id: true, externalId: true, displayName: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!sourceState) throw serviceError("Relationship not found", 404);

    const linksToMove = sourceState.person.identityLinks.filter((link) =>
      userIds.includes(link.userId)
    );
    if (linksToMove.length !== userIds.length) {
      throw serviceError("只能拆分当前身份下的渠道账号。", 400);
    }
    if (linksToMove.length >= sourceState.person.identityLinks.length) {
      throw serviceError("原身份至少要保留一个渠道账号。", 400);
    }

    const source = input.source ?? "admin_identity_split";
    const reviewer = input.reviewedBy ?? "admin";
    const now = new Date();
    const sourceLabel =
      sourceState.person.label ??
      sourceState.person.identityLinks[0]?.user.displayName ??
      sourceState.person.identityLinks[0]?.user.externalId ??
      sourceState.personId;
    const movedUsers = linksToMove.map((link) => ({
      id: link.user.id,
      externalId: link.user.externalId,
      displayName: link.user.displayName,
    }));
    const movedUserNames = movedUsers.map((user) => user.displayName ?? user.externalId);
    const newLabel =
      cleanText(input.newLabel, 60) ??
      movedUsers[0]?.displayName ??
      movedUsers[0]?.externalId ??
      "拆分出的身份";
    const affinity = input.newAffinity !== undefined
      ? boundedNumber(input.newAffinity, sourceState.affinity)
      : sourceState.affinity;

    return prisma.$transaction(async (tx) => {
      const latestMovedMessage = await tx.message.findFirst({
        where: {
          conversation: {
            userId: { in: userIds },
          },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const splitMetadata: Prisma.InputJsonObject = {
        at: now.toISOString(),
        source,
        reviewedBy: reviewer,
        sourcePersonId: sourceState.personId,
        sourceRelationshipId: sourceState.id,
        movedUsers,
      };

      const newPerson = await tx.personIdentity.create({
        data: {
          label: newLabel,
          note: `由「${sourceLabel}」拆分出的身份。`,
        },
      });
      const newState = await tx.relationshipState.create({
        data: {
          personId: newPerson.id,
          relationshipLabel: relationshipLabelFromAffinity(affinity),
          affinity,
          userIntroduction: sourceState.userIntroduction,
          interactionStyle: sourceState.interactionStyle,
          summary: `从「${sourceLabel}」拆分出来的身份，包含渠道账号：${movedUserNames.join(" / ")}。`,
          recentSignal: "admin 手动拆分了身份，后续这些渠道账号单独维护关系。",
          statusNote: "由身份拆分产生；好感度先继承原身份，可在详情页手动调整。",
          lastInteractionAt: latestMovedMessage?.createdAt ?? sourceState.lastInteractionAt,
          metadata: {
            splitFrom: splitMetadata,
          },
        },
      });

      await tx.identityLink.updateMany({
        where: {
          id: { in: linksToMove.map((link) => link.id) },
        },
        data: {
          personId: newPerson.id,
          source,
          verifiedBy: reviewer,
        },
      });
      await tx.identityAlias.updateMany({
        where: {
          personId: sourceState.personId,
          sourceUserId: { in: userIds },
        },
        data: {
          personId: newPerson.id,
        },
      });

      const movedMessageIds = await tx.message
        .findMany({
          where: {
            conversation: { userId: { in: userIds } },
          },
          select: { id: true },
        })
        .then((rows) => rows.map((row) => row.id));
      if (movedMessageIds.length > 0) {
        await tx.memory.updateMany({
          where: {
            personId: sourceState.personId,
            OR: movedMessageIds.map((id) => ({
              sourceMessageIds: { array_contains: [id] },
            })),
          },
          data: { personId: newPerson.id },
        });
      }

      await tx.relationshipStateEvent.updateMany({
        where: {
          relationshipStateId: sourceState.id,
          userId: { in: userIds },
        },
        data: {
          relationshipStateId: newState.id,
          personId: newPerson.id,
        },
      });

      const proposalRows = await tx.relationshipReviewProposal.findMany({
        where: {
          relationshipStateId: sourceState.id,
          userId: { in: userIds },
        },
        select: { id: true },
      });
      const proposalIds = proposalRows.map((proposal) => proposal.id);
      if (proposalIds.length > 0) {
        await tx.relationshipReviewProposal.updateMany({
          where: { id: { in: proposalIds } },
          data: {
            relationshipStateId: newState.id,
            personId: newPerson.id,
          },
        });
        await tx.relationshipReviewEvidence.updateMany({
          where: { proposalId: { in: proposalIds } },
          data: {
            relationshipStateId: newState.id,
            personId: newPerson.id,
          },
        });
      }

      await tx.identityLinkProposal.updateMany({
        where: { targetUserId: { in: userIds } },
        data: { targetPersonId: newPerson.id },
      });
      await tx.identityLinkProposal.updateMany({
        where: {
          sourceUserId: { in: userIds },
          targetPersonId: sourceState.personId,
          status: "pending",
        },
        data: {
          status: "superseded",
          reviewedBy: reviewer,
          reviewedAt: now,
        },
      });

      const sourcePatch: RelationshipStatePatch = {
        recentSignal: `admin 将 ${movedUserNames.join(" / ")} 拆分为新的身份。`,
        statusNote: "身份拆分后，原身份保留剩余渠道账号；好感度未自动变化。",
        metadata: metadataWith(sourceState.metadata, {
          lastIdentitySplit: {
            ...splitMetadata,
            newPersonId: newPerson.id,
            newRelationshipId: newState.id,
          },
        }),
      };
      const updatedSource = await tx.relationshipState.update({
        where: { id: sourceState.id },
        data: normalizePatch(sourcePatch),
      });

      await tx.relationshipStateEvent.create({
        data: {
          relationshipStateId: updatedSource.id,
          personId: updatedSource.personId,
          eventType: "identity_split",
          source,
          summary: `Admin 将 ${movedUserNames.join(" / ")} 从「${sourceLabel}」拆分为新的身份「${newLabel}」。`,
          patch: patchToJson(sourcePatch),
          before: snapshotRelationshipState(sourceState),
          after: snapshotRelationshipState(updatedSource),
        },
      });
      await tx.relationshipStateEvent.create({
        data: {
          relationshipStateId: newState.id,
          personId: newState.personId,
          userId: movedUsers[0]?.id,
          eventType: "identity_split",
          source,
          summary: `由「${sourceLabel}」拆分创建，包含渠道账号：${movedUserNames.join(" / ")}。`,
          patch: {
            movedUserIds: userIds,
            movedUsers,
            affinity,
            relationshipLabel: newState.relationshipLabel,
          },
          before: {
            source: snapshotRelationshipState(sourceState),
          },
          after: snapshotRelationshipState(newState),
        },
      });

      return newState;
    });
  },

  async updateIdentityLabel(input: {
    relationshipId: string;
    label: string | null;
    source?: string;
  }): Promise<RelationshipState> {
    const before = await prisma.relationshipState.findUnique({
      where: { id: input.relationshipId },
      include: { person: true },
    });
    if (!before) throw serviceError("Relationship not found", 404);

    const label = cleanText(input.label, 60);
    return prisma.$transaction(async (tx) => {
      const person = await tx.personIdentity.update({
        where: { id: before.personId },
        data: { label: label ?? null },
      });
      const updated = await tx.relationshipState.findUniqueOrThrow({
        where: { id: before.id },
      });
      await tx.relationshipStateEvent.create({
        data: {
          relationshipStateId: updated.id,
          personId: updated.personId,
          eventType: "identity_name_update",
          source: input.source ?? "admin",
          summary: `Admin 将身份名称改为「${person.label ?? "未命名身份"}」。`,
          patch: {
            personLabel: person.label,
          },
          before: {
            ...snapshotRelationshipState(before),
            personLabel: before.person.label,
          },
          after: {
            ...snapshotRelationshipState(updated),
            personLabel: person.label,
          },
        },
      });
      return updated;
    });
  },

  async updateIdentityUserDisplayName(input: {
    relationshipId: string;
    userId: string;
    displayName: string | null;
    source?: string;
  }): Promise<RelationshipState> {
    const relationship = await prisma.relationshipState.findUnique({
      where: { id: input.relationshipId },
      include: {
        person: {
          include: {
            identityLinks: {
              include: {
                user: { select: { id: true, externalId: true, displayName: true } },
              },
            },
          },
        },
      },
    });
    if (!relationship) throw serviceError("Relationship not found", 404);

    const link = relationship.person.identityLinks.find((item) => item.userId === input.userId);
    if (!link) throw serviceError("只能修改当前身份下的渠道账号。", 400);

    const displayName = cleanText(input.displayName, 80);
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: input.userId },
        data: { displayName: displayName ?? null },
        select: { id: true, externalId: true, displayName: true },
      });
      const updated = await tx.relationshipState.findUniqueOrThrow({
        where: { id: relationship.id },
      });
      await tx.relationshipStateEvent.create({
        data: {
          relationshipStateId: updated.id,
          personId: updated.personId,
          userId: user.id,
          eventType: "channel_user_name_update",
          source: input.source ?? "admin",
          summary: `Admin 将渠道账号「${user.externalId}」的显示名改为「${user.displayName ?? "未命名用户"}」。`,
          patch: {
            userId: user.id,
            externalId: user.externalId,
            displayName: user.displayName,
          },
          before: {
            ...snapshotRelationshipState(relationship),
            user: link.user,
          },
          after: {
            ...snapshotRelationshipState(updated),
            user,
          },
        },
      });
      return updated;
    });
    if (displayName) {
      await recordSelfIdentityAliases({
        personId: relationship.personId,
        userId: input.userId,
        hints: [displayName],
        source: "admin_channel_display_name",
        confidence: 0.8,
      });
    }
    return updated;
  },

  async updateIdentityAliases(input: {
    relationshipId: string;
    aliases: string[];
    source?: string;
  }): Promise<RelationshipState> {
    const relationship = await prisma.relationshipState.findUnique({
      where: { id: input.relationshipId },
      include: {
        person: {
          include: {
            identityAliases: {
              orderBy: [{ lastSeenAt: "desc" }],
            },
          },
        },
      },
    });
    if (!relationship) throw serviceError("Relationship not found", 404);

    const aliases = uniqueIdentityHints(input.aliases).slice(0, 40);
    const normalizedValues = aliases.map((alias) => normalizeIdentityToken(alias));
    const now = new Date();
    const source = input.source ?? "admin";
    const beforeAliases = relationship.person.identityAliases.map((alias) => ({
      id: alias.id,
      value: alias.value,
      normalizedValue: alias.normalizedValue,
      source: alias.source,
      confidence: alias.confidence,
      mentionCount: alias.mentionCount,
    }));

    return prisma.$transaction(async (tx) => {
      await tx.identityAlias.deleteMany({
        where: {
          personId: relationship.personId,
          normalizedValue: { notIn: normalizedValues },
        },
      });

      for (const value of aliases) {
        const normalizedValue = normalizeIdentityToken(value);
        await tx.identityAlias.upsert({
          where: {
            personId_normalizedValue: {
              personId: relationship.personId,
              normalizedValue,
            },
          },
          create: {
            personId: relationship.personId,
            value,
            normalizedValue,
            source,
            confidence: 0.9,
            mentionCount: 1,
            firstSeenAt: now,
            lastSeenAt: now,
          },
          update: {
            value,
            source,
            confidence: 0.9,
            lastSeenAt: now,
          },
        });
      }

      const afterAliases = await tx.identityAlias.findMany({
        where: { personId: relationship.personId },
        orderBy: [{ lastSeenAt: "desc" }],
      });
      const updated = await tx.relationshipState.findUniqueOrThrow({
        where: { id: relationship.id },
      });
      await tx.relationshipStateEvent.create({
        data: {
          relationshipStateId: updated.id,
          personId: updated.personId,
          eventType: "identity_alias_update",
          source,
          summary: aliases.length > 0
            ? `Admin 将自称/别名更新为：${aliases.join(" / ")}。`
            : "Admin 清空了自称/别名。",
          patch: {
            aliases,
          },
          before: {
            ...snapshotRelationshipState(relationship),
            identityAliases: beforeAliases,
          },
          after: {
            ...snapshotRelationshipState(updated),
            identityAliases: afterAliases.map((alias) => ({
              id: alias.id,
              value: alias.value,
              normalizedValue: alias.normalizedValue,
              source: alias.source,
              confidence: alias.confidence,
              mentionCount: alias.mentionCount,
            })),
          },
        },
      });
      return updated;
    });
  },

  async approveIdentityLinkProposal(input: { proposalId: string; reviewedBy?: string }) {
    const proposal = await prisma.identityLinkProposal.findUniqueOrThrow({
      where: { id: input.proposalId },
    });
    if (proposal.status !== "pending") {
      throw serviceError("Identity proposal is not pending", 409);
    }

    const reviewer = input.reviewedBy ?? "admin";
    const reviewedAt = new Date();
    const targetState = await this.getOrCreateForPerson(proposal.targetPersonId);
    const sourceState = await this.getOrCreate(proposal.sourceUserId);
    const relationship = sourceState.id === targetState.id
      ? targetState
      : await this.mergeRelationships({
          sourceRelationshipId: sourceState.id,
          targetRelationshipId: targetState.id,
          source: "identity_proposal_approved",
          reviewedBy: reviewer,
        });

    const [reviewedProposal] = await prisma.$transaction([
      prisma.identityLinkProposal.update({
        where: { id: proposal.id },
        data: {
          status: "approved",
          reviewedBy: reviewer,
          reviewedAt,
        },
        include: {
          sourceUser: { select: { id: true, externalId: true, displayName: true } },
          targetUser: { select: { id: true, externalId: true, displayName: true } },
          targetPerson: {
            include: {
              identityLinks: {
                include: {
                  user: { select: { id: true, externalId: true, displayName: true } },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      }),
      prisma.identityLinkProposal.updateMany({
        where: {
          sourceUserId: proposal.sourceUserId,
          status: "pending",
          id: { not: proposal.id },
        },
        data: {
          status: "superseded",
          reviewedBy: reviewer,
          reviewedAt,
        },
      }),
    ]);

    const detail = await this.getDetail(relationship.id, 20);
    return { proposal: reviewedProposal, ...detail };
  },

  async rejectIdentityLinkProposal(input: { proposalId: string; reviewedBy?: string }) {
    const proposal = await prisma.identityLinkProposal.findUniqueOrThrow({
      where: { id: input.proposalId },
    });
    if (proposal.status !== "pending") {
      throw serviceError("Identity proposal is not pending", 409);
    }

    return prisma.identityLinkProposal.update({
      where: { id: proposal.id },
      data: {
        status: "rejected",
        reviewedBy: input.reviewedBy ?? "admin",
        reviewedAt: new Date(),
      },
      include: {
        sourceUser: { select: { id: true, externalId: true, displayName: true } },
        targetUser: { select: { id: true, externalId: true, displayName: true } },
        targetPerson: {
          include: {
            identityLinks: {
              include: {
                user: { select: { id: true, externalId: true, displayName: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
  },

  async applyPatch(input: ApplyRelationshipPatchInput): Promise<RelationshipState> {
    const before = await prisma.relationshipState.findUniqueOrThrow({
      where: { id: input.relationshipId },
    });
    const patchForEvent = patchToJson(input.patch);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.relationshipState.update({
        where: { id: input.relationshipId },
        data: normalizePatch(input.patch),
      });
      await tx.relationshipStateEvent.create({
        data: {
          relationshipStateId: updated.id,
          personId: updated.personId,
          userId: input.userId,
          eventType: input.eventType,
          source: input.source,
          summary: input.summary ?? summarizePatch(input.patch),
          patch: patchForEvent,
          before: snapshotRelationshipState(before),
          after: snapshotRelationshipState(updated),
          conversationId: input.conversationId,
          messageId: input.messageId,
          channel: input.channel,
        },
      });
      return updated;
    });
  },

  async applyRelationshipReviewProposal(input: {
    proposalId: string;
    reviewedBy?: string;
    source?: string;
  }): Promise<RelationshipState> {
    const proposal = await prisma.relationshipReviewProposal.findUnique({
      where: { id: input.proposalId },
    });
    if (!proposal) throw serviceError("Relationship review proposal not found", 404);
    if (proposal.status !== "pending") {
      throw serviceError("Relationship review proposal is not pending", 409);
    }

    const before = await prisma.relationshipState.findUniqueOrThrow({
      where: { id: proposal.relationshipStateId },
    });
    const proposalPatch = patchFromJsonForState(before, proposal.proposedPatch);
    const source = input.source ?? proposal.source ?? "dream";
    const reviewedBy = input.reviewedBy ?? (source === "dream" ? "dream" : "admin");

    if (!patchHasCoreChanges(before, proposalPatch)) {
      await prisma.relationshipReviewProposal.update({
        where: { id: proposal.id },
        data: {
          status: "observed",
          reviewedBy,
          reviewedAt: new Date(),
          afterSnapshot: snapshotRelationshipState(before),
        },
      });
      return before;
    }

    const nextAffinity = proposalPatch.affinity ?? before.affinity;
    const delta = nextAffinity - before.affinity;
    const patch: RelationshipStatePatch = {
      ...proposalPatch,
      relationshipLabel: relationshipLabelFromAffinity(nextAffinity),
      recentSignal: proposal.reason,
      statusNote: `由 ${source} 关系复盘调整。`,
      lastInteractionAt: new Date(),
      metadata: metadataWith(before.metadata, {
        lastRelationshipReview: {
          at: new Date().toISOString(),
          source,
          proposalSource: proposal.source,
          proposalId: proposal.id,
          reportId: proposal.reportId ?? null,
          reason: proposal.reason,
          affinityDelta: delta,
          proposedPatch: proposal.proposedPatch as Prisma.InputJsonValue,
        },
      }),
    };

    const updated = await this.applyPatch({
      relationshipId: proposal.relationshipStateId,
      patch,
      eventType: "relationship_review",
      source,
      summary: delta === 0
        ? `关系复盘：${proposal.reason}`
        : `关系复盘，好感度 ${delta >= 0 ? "+" : ""}${delta}：${proposal.reason}`,
      userId: proposal.userId ?? undefined,
      conversationId: proposal.conversationId ?? undefined,
      channel: proposal.channel ?? undefined,
    });

    await prisma.relationshipReviewProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        appliedAt: new Date(),
        reviewedBy,
        reviewedAt: new Date(),
        afterSnapshot: snapshotRelationshipState(updated),
      },
    });

    return updated;
  },

  async rejectRelationshipReviewProposal(input: {
    proposalId: string;
    reviewedBy?: string;
  }) {
    const proposal = await prisma.relationshipReviewProposal.findUnique({
      where: { id: input.proposalId },
    });
    if (!proposal) throw serviceError("Relationship review proposal not found", 404);
    if (proposal.status !== "pending") {
      throw serviceError("Relationship review proposal is not pending", 409);
    }

    return prisma.relationshipReviewProposal.update({
      where: { id: proposal.id },
      data: {
        status: "rejected",
        reviewedBy: input.reviewedBy ?? "admin",
        reviewedAt: new Date(),
      },
      include: {
        evidences: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  },

  async observeChatTurn(input: ObserveRelationshipTurnInput): Promise<void> {
    await this.getOrCreate(input.userId);
  },

  async observeIdentitySignals(input: ObserveIdentitySignalInput) {
    const sourceUser = await prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { id: true, externalId: true, displayName: true },
    });
    const currentPerson = await this.getOrCreatePersonForUser(input.userId);
    const explicitHints = extractIdentityHints(input.userMessage);
    const displayNameHints = displayNameIdentityHints(input.displayName, sourceUser.displayName);
    const hints = uniqueIdentityHints([...explicitHints, ...displayNameHints]);
    if (hints.length === 0) return [];
    if (displayNameHints.length > 0) {
      await recordSelfIdentityAliases({
        personId: currentPerson.id,
        userId: input.userId,
        hints: displayNameHints,
        source: "channel_display_name",
        confidence: 0.76,
      });
    }
    if (explicitHints.length > 0) {
      await recordSelfIdentityAliases({
        personId: currentPerson.id,
        userId: input.userId,
        hints: explicitHints,
        source: "explicit_self_identification",
        confidence: 0.82,
      });
    }

    const explicitHintSet = new Set(explicitHints.map((hint) => normalizeIdentityToken(hint)));
    const candidates = await prisma.personIdentity.findMany({
      where: {
        id: { not: currentPerson.id },
      },
      include: {
        identityAliases: {
          orderBy: [{ lastSeenAt: "desc" }],
        },
        identityLinks: {
          include: {
            user: { select: { id: true, externalId: true, displayName: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });

    const proposals = [];
    for (const candidate of candidates) {
      const match = matchIdentityCandidate(hints, explicitHintSet, candidate);
      if (!match) continue;

      const reason = explicitHints.length > 0
        ? "用户在消息里自称了身份，且和已有现实身份相似，需要 admin 审核。"
        : "当前显示名和已有现实身份相似，需要 admin 审核。";
      const evidence: Prisma.InputJsonObject = {
        rule: explicitHints.length > 0 ? "explicit_self_identification" : "display_name_similarity",
        channel: input.channel,
        conversationId: input.conversationId,
        messageId: input.messageId ?? null,
        userMessagePreview: cleanText(input.userMessage, 180) ?? "",
        sourceUser: {
          id: sourceUser.id,
          externalId: sourceUser.externalId,
          displayName: sourceUser.displayName,
          currentPersonId: currentPerson.id,
        },
        matchedHints: match.matchedHints,
        matchedTerms: match.matchedTerms,
        targetPerson: {
          id: candidate.id,
          label: candidate.label,
          users: candidate.identityLinks.map((link) => ({
            id: link.user.id,
            externalId: link.user.externalId,
            displayName: link.user.displayName,
          })),
        },
      };

      const existing = await prisma.identityLinkProposal.findFirst({
        where: {
          sourceUserId: input.userId,
          targetPersonId: candidate.id,
          status: "pending",
        },
      });
      const proposal = existing
        ? await prisma.identityLinkProposal.update({
            where: { id: existing.id },
            data: {
              reason,
              evidence,
              confidence: match.confidence,
              targetUserId: match.targetUserId,
              source: "identity_rules",
            },
          })
        : await prisma.identityLinkProposal.create({
            data: {
              sourceUserId: input.userId,
              targetPersonId: candidate.id,
              targetUserId: match.targetUserId,
              reason,
              evidence,
              confidence: match.confidence,
              source: "identity_rules",
            },
          });
      proposals.push(proposal);
    }

    return proposals;
  },

  async reset(relationshipId: string, source = "admin"): Promise<RelationshipState> {
    return this.applyPatch({
      relationshipId,
      patch: {
        ...defaultRelationshipState,
        metadata: Prisma.JsonNull,
        lastInteractionAt: null,
      },
      eventType: "reset",
      source,
      summary: "关系状态已重置为默认状态。",
    });
  },

  async formatForPrompt(userId: string): Promise<string> {
    const state = await this.getOrCreate(userId);
    return [
      "# 数据库关系状态",
      "",
      `- 关系标签：${state.relationshipLabel}`,
      `- 好感度：${state.affinity}/100`,
      `- 用户介绍：${state.userIntroduction ?? "还没有足够资料。"}`,
      `- 互动风格：${state.interactionStyle ?? "自然、礼貌、慢热但不冷淡。"}`,
      `- 关系摘要：${state.summary ?? "还没有形成明确关系。"}`,
      "",
      "这只描述陆思源和当前用户之间的关系，不代表陆思源对所有人的整体状态。",
    ]
      .filter(Boolean)
      .join("\n");
  },
};

export function relationshipPatchFromAdminBody(
  state: RelationshipState,
  body: Record<string, unknown>
): RelationshipStatePatch {
  const patch: RelationshipStatePatch = {};
  if (Object.prototype.hasOwnProperty.call(body, "relationshipLabel")) {
    patch.relationshipLabel = cleanText(body.relationshipLabel, 60) ?? state.relationshipLabel;
  }
  if (Object.prototype.hasOwnProperty.call(body, "affinity")) {
    patch.affinity = boundedNumber(body.affinity, state.affinity);
    if (
      !Object.prototype.hasOwnProperty.call(body, "relationshipLabel") ||
      patch.relationshipLabel === state.relationshipLabel
    ) {
      patch.relationshipLabel = relationshipLabelFromAffinity(patch.affinity);
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "userIntroduction")) {
    patch.userIntroduction = cleanText(body.userIntroduction, 420);
  }
  if (Object.prototype.hasOwnProperty.call(body, "interactionStyle")) {
    patch.interactionStyle = cleanText(body.interactionStyle, 220);
  }
  if (Object.prototype.hasOwnProperty.call(body, "summary")) {
    patch.summary = cleanText(body.summary, 320);
  }
  if (Object.prototype.hasOwnProperty.call(body, "recentSignal")) {
    patch.recentSignal = cleanText(body.recentSignal, 220);
  }
  if (Object.prototype.hasOwnProperty.call(body, "statusNote")) {
    patch.statusNote = cleanText(body.statusNote, 220);
  }
  if (Object.prototype.hasOwnProperty.call(body, "metadata")) {
    patch.metadata = body.metadata as Prisma.InputJsonValue;
  }
  return patch;
}
