import { Prisma, type RelationshipState } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { isOwnerExternalId, ownerExternalIds } from "../core/owner-identity.js";

export interface RelationshipStatePatch {
  relationshipLabel?: string;
  affinity?: number;
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

interface ApplyRelationshipAffinityInput {
  relationshipId: string;
  source: "dream" | "admin" | "manual" | string;
  reason: string;
  delta?: number;
  affinity?: number;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  channel?: string;
  evidence?: Prisma.InputJsonValue;
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

interface IdentityCandidatePerson {
  id: string;
  label: string | null;
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

function snapshotRelationshipState(state: RelationshipState): Prisma.InputJsonObject {
  return {
    id: state.id,
    personId: state.personId,
    relationshipLabel: state.relationshipLabel,
    affinity: state.affinity,
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
  const terms: Array<{ value: string; normalized: string; userId?: string }> = [];
  for (const value of identityTermValues(candidate.label)) {
    terms.push({ value, normalized: normalizeIdentityToken(value) });
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
    const relationship = await prisma.relationshipState.findUniqueOrThrow({
      where: { id: relationshipId },
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
    const events = await this.listEvents(relationshipId, limit);
    return { relationship, events };
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

  async linkUserToPerson(input: {
    relationshipId: string;
    userId: string;
    source?: string;
    verifiedBy?: string;
  }): Promise<RelationshipState> {
    const target = await prisma.relationshipState.findUniqueOrThrow({
      where: { id: input.relationshipId },
    });
    const sourceLink = await prisma.identityLink.findUnique({
      where: { userId: input.userId },
      include: {
        person: {
          include: {
            relationshipState: true,
            identityLinks: { select: { id: true } },
          },
        },
      },
    });

    if (sourceLink?.personId === target.personId) return target;

    return prisma.$transaction(async (tx) => {
      let updatedTarget = target;
      const source = input.source ?? "admin_manual";

      if (!sourceLink) {
        await tx.identityLink.create({
          data: {
            personId: target.personId,
            userId: input.userId,
            source,
            verifiedBy: input.verifiedBy,
          },
        });
        await tx.relationshipStateEvent.create({
          data: {
            relationshipStateId: target.id,
            personId: target.personId,
            userId: input.userId,
            eventType: "identity_link_added",
            source,
            summary: "Admin 把一个渠道账号绑定到当前现实身份。",
            before: snapshotRelationshipState(target),
            after: snapshotRelationshipState(target),
          },
        });
      } else {
        const sourceState = sourceLink.person.relationshipState;
        const sourceLinkCount = sourceLink.person.identityLinks.length;

        if (sourceState && sourceLinkCount <= 1) {
          const affinity = Math.max(target.affinity, sourceState.affinity);
          const patch: RelationshipStatePatch = {
            affinity,
            relationshipLabel: relationshipLabelFromAffinity(affinity),
            summary: [
              target.summary,
              sourceState.summary,
              "已由 admin 确认跨渠道身份为同一个人，并合并关系状态。",
            ]
              .filter(Boolean)
              .join("\n"),
            recentSignal: "admin 手动绑定了另一个渠道账号，关系状态已合并。",
            statusNote: "由身份绑定合并关系状态；后续多个渠道会共享这一份关系。",
            metadata: metadataWith(target.metadata, {
              lastIdentityMerge: {
                at: new Date().toISOString(),
                sourcePersonId: sourceLink.personId,
                linkedUserId: input.userId,
                source,
              },
            }),
          };

          updatedTarget = await tx.relationshipState.update({
            where: { id: target.id },
            data: normalizePatch(patch),
          });
          await tx.relationshipStateEvent.updateMany({
            where: { relationshipStateId: sourceState.id },
            data: {
              relationshipStateId: target.id,
              personId: target.personId,
            },
          });
          await tx.relationshipState.delete({ where: { id: sourceState.id } });
          await tx.relationshipStateEvent.create({
            data: {
              relationshipStateId: updatedTarget.id,
              personId: updatedTarget.personId,
              userId: input.userId,
              eventType: "identity_merge",
              source,
              summary: "Admin 确认跨渠道同一人，合并关系状态。",
              patch: patchToJson(patch),
              before: snapshotRelationshipState(target),
              after: snapshotRelationshipState(updatedTarget),
            },
          });
        } else {
          await tx.relationshipStateEvent.create({
            data: {
              relationshipStateId: target.id,
              personId: target.personId,
              userId: input.userId,
              eventType: "identity_link_added",
              source,
              summary: "Admin 把一个渠道账号绑定到当前现实身份。",
              before: snapshotRelationshipState(target),
              after: snapshotRelationshipState(target),
            },
          });
        }

        await tx.identityLink.update({
          where: { userId: input.userId },
          data: {
            personId: target.personId,
            source,
            verifiedBy: input.verifiedBy,
          },
        });

        const remainingLinks = await tx.identityLink.count({
          where: { personId: sourceLink.personId },
        });
        const remainingState = await tx.relationshipState.count({
          where: { personId: sourceLink.personId },
        });
        if (remainingLinks === 0 && remainingState === 0) {
          await tx.personIdentity.delete({ where: { id: sourceLink.personId } });
        }
      }

      return updatedTarget;
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
    const relationship = await this.linkUserToPerson({
      relationshipId: targetState.id,
      userId: proposal.sourceUserId,
      source: "identity_proposal_approved",
      verifiedBy: reviewer,
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

  async applyAffinityPatch(input: ApplyRelationshipAffinityInput): Promise<RelationshipState> {
    const before = await prisma.relationshipState.findUniqueOrThrow({
      where: { id: input.relationshipId },
    });
    const nextAffinity = input.affinity !== undefined
      ? boundedNumber(input.affinity, before.affinity)
      : clampInt(before.affinity + boundedNumber(input.delta ?? 0, 0, -100, 100), 0, 100);
    const delta = nextAffinity - before.affinity;
    const patch: RelationshipStatePatch = {
      affinity: nextAffinity,
      relationshipLabel: relationshipLabelFromAffinity(nextAffinity),
      recentSignal: input.reason,
      statusNote: `由 ${input.source} 调整好感度。`,
      lastInteractionAt: new Date(),
      metadata: metadataWith(before.metadata, {
        lastAffinityPatch: {
          at: new Date().toISOString(),
          source: input.source,
          reason: input.reason,
          delta,
          affinity: nextAffinity,
          evidence: input.evidence ?? null,
        },
      }),
    };

    return this.applyPatch({
      relationshipId: input.relationshipId,
      patch,
      eventType: "affinity_update",
      source: input.source,
      summary: `好感度 ${delta >= 0 ? "+" : ""}${delta}：${input.reason}`,
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      channel: input.channel,
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
    const hints = uniqueIdentityHints([
      ...explicitHints,
      input.displayName ?? "",
      sourceUser.displayName ?? "",
    ]);
    if (hints.length === 0) return [];

    const explicitHintSet = new Set(explicitHints.map((hint) => normalizeIdentityToken(hint)));
    const candidates = await prisma.personIdentity.findMany({
      where: {
        id: { not: currentPerson.id },
      },
      include: {
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
      `- 互动风格：${state.interactionStyle ?? "自然、礼貌、慢热但不冷淡。"}`,
      `- 关系摘要：${state.summary ?? "还没有形成明确关系。"}`,
      `- 最近信号：${state.recentSignal ?? "暂无。"}`,
      state.statusNote ? `- 备注：${state.statusNote}` : "",
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
