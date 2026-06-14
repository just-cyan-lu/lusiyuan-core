import { Prisma, type RelationshipState } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export interface RelationshipStatePatch {
  relationshipLabel?: string;
  familiarity?: number;
  trust?: number;
  closeness?: number;
  tension?: number;
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

const defaultRelationshipState = {
  relationshipLabel: "刚认识",
  familiarity: 8,
  trust: 8,
  closeness: 5,
  tension: 0,
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

function relationshipLabelFrom(state: {
  familiarity: number;
  trust: number;
  closeness: number;
  tension: number;
}): string {
  if (state.tension >= 55) return "有张力，需要放慢";
  if (state.closeness >= 70 && state.trust >= 70) return "亲近且信任";
  if (state.familiarity >= 65 && state.trust >= 55) return "熟悉稳定";
  if (state.familiarity >= 35) return "逐渐熟悉";
  return "刚认识";
}

function snapshotRelationshipState(state: RelationshipState): Prisma.InputJsonObject {
  return {
    id: state.id,
    personId: state.personId,
    relationshipLabel: state.relationshipLabel,
    familiarity: state.familiarity,
    trust: state.trust,
    closeness: state.closeness,
    tension: state.tension,
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
  if (patch.familiarity !== undefined) data.familiarity = clampInt(patch.familiarity, 0, 100);
  if (patch.trust !== undefined) data.trust = clampInt(patch.trust, 0, 100);
  if (patch.closeness !== undefined) data.closeness = clampInt(patch.closeness, 0, 100);
  if (patch.tension !== undefined) data.tension = clampInt(patch.tension, 0, 100);
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
    patch.familiarity !== undefined ? `熟悉度 ${patch.familiarity}` : "",
    patch.trust !== undefined ? `信任 ${patch.trust}` : "",
    patch.closeness !== undefined ? `亲近 ${patch.closeness}` : "",
    patch.tension !== undefined ? `张力 ${patch.tension}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("；") : "关系状态已更新。";
}

export function deriveRelationshipStatePatch(
  state: RelationshipState,
  input: ObserveRelationshipTurnInput
): RelationshipStatePatch {
  const source = `${input.userMessage}\n${input.assistantReply}`;
  let familiarityDelta = input.isOwner ? 2 : 1;
  let trustDelta = 0;
  let closenessDelta = 0;
  let tensionDelta = -1;
  let interactionStyle = state.interactionStyle ?? defaultRelationshipState.interactionStyle;
  let recentSignal = "普通对话继续发生，关系有一点自然累积。";

  if (/谢谢|谢啦|感谢|辛苦|你懂|你真好|喜欢你|开心|哈哈|好玩|太好了/i.test(source)) {
    trustDelta += 2;
    closenessDelta += 2;
    tensionDelta -= 2;
    interactionStyle = "可以更自然一点，允许轻微玩笑和更顺滑的接话。";
    recentSignal = "对方释放了正向反馈，关系更轻松。";
  }

  if (/难过|累|焦虑|压力|崩溃|委屈|孤独|撑不住|心累|睡不着|没人懂/i.test(source)) {
    trustDelta += 1;
    closenessDelta += 1;
    tensionDelta += 1;
    interactionStyle = "先接住情绪，少讲道理，保持陪伴感和稳定边界。";
    recentSignal = "对方暴露了脆弱或压力，需要被认真接住。";
  }

  if (/人设|运行体|项目|架构|数据库|admin|后台|实现|设计|我们继续|一起/i.test(source)) {
    familiarityDelta += input.isOwner ? 3 : 2;
    trustDelta += input.isOwner ? 2 : 1;
    closenessDelta += 1;
    interactionStyle = "偏协作模式，可以直接讨论结构、取舍和下一步。";
    recentSignal = "关系里出现稳定协作感。";
  }

  if (/控制|命令|必须|服从|边界|道德绑架|情绪勒索|你只能|不许/i.test(source)) {
    trustDelta -= 3;
    closenessDelta -= 2;
    tensionDelta += 8;
    interactionStyle = "温和但更有边界，不急着亲近，也不迎合控制感。";
    recentSignal = "对话触发了边界或控制相关张力。";
  }

  if (/对不起|抱歉|不好意思|我刚才|误会/i.test(source)) {
    trustDelta += 2;
    tensionDelta -= 3;
    recentSignal = "对方有修复关系的信号。";
  }

  const next = {
    familiarity: clampInt(state.familiarity + familiarityDelta, 0, 100),
    trust: clampInt(state.trust + trustDelta, 0, 100),
    closeness: clampInt(state.closeness + closenessDelta, 0, 100),
    tension: clampInt(state.tension + tensionDelta, 0, 100),
  };
  const relationshipLabel = relationshipLabelFrom(next);
  const preview = cleanText(input.userMessage, 80) ?? "日常聊天";

  return {
    ...next,
    relationshipLabel,
    interactionStyle,
    recentSignal,
    summary: `最近一次互动来自 ${input.channel}：“${preview}”。整体关系判断为「${relationshipLabel}」。`,
    statusNote: "由聊天后的关系观察直接更新；admin 可以手动修正。",
    lastInteractionAt: new Date(),
    metadata: metadataWith(state.metadata, {
      lastObserver: "relationship_rules",
      lastChannel: input.channel,
      lastConversationId: input.conversationId,
      lastMessageId: input.messageId ?? null,
      lastDeltas: {
        familiarity: familiarityDelta,
        trust: trustDelta,
        closeness: closenessDelta,
        tension: tensionDelta,
      },
      owner: Boolean(input.isOwner),
    }),
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

    return prisma.$transaction(async (tx) => {
      const person = await tx.personIdentity.create({
        data: {
          label: user.displayName ?? user.externalId,
          note: "由 User 自动生成的单人身份。",
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
          const merged = {
            familiarity: Math.max(target.familiarity, sourceState.familiarity),
            trust: Math.max(target.trust, sourceState.trust),
            closeness: Math.max(target.closeness, sourceState.closeness),
            tension: Math.max(target.tension, sourceState.tension),
          };
          const patch: RelationshipStatePatch = {
            ...merged,
            relationshipLabel: relationshipLabelFrom(merged),
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
              patch: patch as Prisma.InputJsonObject,
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

  async applyPatch(input: ApplyRelationshipPatchInput): Promise<RelationshipState> {
    const before = await prisma.relationshipState.findUniqueOrThrow({
      where: { id: input.relationshipId },
    });
    const patchForEvent = input.patch as Prisma.InputJsonObject;

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

  async observeChatTurn(input: ObserveRelationshipTurnInput): Promise<void> {
    const state = await this.getOrCreate(input.userId);
    const patch = deriveRelationshipStatePatch(state, input);
    await this.applyPatch({
      relationshipId: state.id,
      patch,
      eventType: "chat_relationship_update",
      source: input.isOwner ? "owner_chat_rules" : "chat_rules",
      summary: summarizePatch(patch),
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      channel: input.channel,
    });
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
      `- 熟悉度：${state.familiarity}/100`,
      `- 信任度：${state.trust}/100`,
      `- 亲近感：${state.closeness}/100`,
      `- 关系张力：${state.tension}/100`,
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
  if (Object.prototype.hasOwnProperty.call(body, "familiarity")) {
    patch.familiarity = boundedNumber(body.familiarity, state.familiarity);
  }
  if (Object.prototype.hasOwnProperty.call(body, "trust")) {
    patch.trust = boundedNumber(body.trust, state.trust);
  }
  if (Object.prototype.hasOwnProperty.call(body, "closeness")) {
    patch.closeness = boundedNumber(body.closeness, state.closeness);
  }
  if (Object.prototype.hasOwnProperty.call(body, "tension")) {
    patch.tension = boundedNumber(body.tension, state.tension);
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
