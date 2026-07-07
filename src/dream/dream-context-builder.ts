// dream-context-builder.ts — collect recent system events for Dream Cycle

import { prisma } from "../db/prisma.js";
import type { Prisma } from "@prisma/client";
import type {
  DreamContext,
  DreamSourceMessage,
  DreamSourceMemory,
  DreamSourceToolCall,
} from "./dream.types.js";

export interface BuildDreamContextInput {
  from: Date;
  to: Date;
  userId?: string;
  conversationId?: string;
}

type DreamMessageSourceKind = NonNullable<DreamSourceMessage["sourceKind"]>;
type DreamMessageContinuity = NonNullable<DreamSourceMessage["continuity"]>;

function readRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function classifyDreamMessageSource(input: {
  channel?: string | null;
  messageMetadata?: Prisma.JsonValue | null;
  conversationMetadata?: Prisma.JsonValue | null;
}): {
  sourceKind: DreamMessageSourceKind;
  sourcePlatform: string | null;
  sourceType: string | null;
  continuity: DreamMessageContinuity;
  dreamEligible: boolean;
  memoryEligible: boolean;
  relationshipEligible: boolean;
} {
  const messageMetadata = readRecord(input.messageMetadata ?? null);
  const conversationMetadata = readRecord(input.conversationMetadata ?? null);
  const sourcePlatform =
    stringValue(messageMetadata.sourcePlatform) ??
    stringValue(conversationMetadata.sourcePlatform) ??
    input.channel ??
    null;
  const sourceType =
    stringValue(messageMetadata.sourceType) ??
    stringValue(conversationMetadata.sourceType);
  const continuity =
    (stringValue(messageMetadata.continuity) ??
      stringValue(conversationMetadata.continuity)) === "threaded"
      ? "threaded"
      : "continuous";

  let sourceKind: DreamMessageSourceKind = "private_chat";
  if (sourcePlatform === "xiaohongshu" || input.channel === "xiaohongshu") {
    const hasReplyTarget = Boolean(stringValue(messageMetadata.replyToId));
    sourceKind = continuity === "threaded"
      ? hasReplyTarget ? "platform_thread_reply" : "platform_comment"
      : "platform_interaction";
  }
  if (sourceType === "comment_reply" || sourceType === "thread_reply") {
    sourceKind = "platform_thread_reply";
  }

  return {
    sourceKind,
    sourcePlatform,
    sourceType,
    continuity,
    dreamEligible: booleanValue(
      messageMetadata.dreamEligible ?? conversationMetadata.dreamEligible,
      true
    ),
    memoryEligible: booleanValue(
      messageMetadata.memoryEligible ?? conversationMetadata.memoryEligible,
      true
    ),
    relationshipEligible: booleanValue(
      messageMetadata.relationshipEligible ?? conversationMetadata.relationshipEligible,
      true
    ),
  };
}

export class DreamContextBuilder {
  async build(input: BuildDreamContextInput): Promise<DreamContext> {
    const { from, to, userId, conversationId } = input;

    const [messages, memories, toolCalls] =
      await Promise.all([
        this.fetchMessages(from, to, userId, conversationId),
        this.fetchMemories(from, to, userId),
        this.fetchToolCalls(from, to),
      ]);

    const sourceStats: Record<string, number> = {
      messages: messages.length,
      memories: memories.length,
      toolCalls: toolCalls.length,
    };
    for (const message of messages) {
      const sourceKey = `messages:${message.sourceKind ?? "unknown"}`;
      sourceStats[sourceKey] = (sourceStats[sourceKey] ?? 0) + 1;
      if (message.continuity === "threaded") {
        sourceStats["messages:threaded"] = (sourceStats["messages:threaded"] ?? 0) + 1;
      }
    }

    return {
      range: { from, to },
      messages,
      memories,
      toolCalls,
      sourceStats,
    };
  }

  private async fetchMessages(
    from: Date,
    to: Date,
    userId?: string,
    conversationId?: string
  ): Promise<DreamSourceMessage[]> {
    const where: Record<string, unknown> = {
      createdAt: { gte: from, lte: to },
    };

    if (conversationId) {
      const conv = await prisma.conversation.findFirst({
        where: {
          OR: [{ id: conversationId }, { externalConversationId: conversationId }],
        },
      });
      where.conversationId = conv ? conv.id : "__missing_conversation__";
    } else if (userId) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: userId }, { externalId: userId }] },
      });
      if (user) {
        const convIds = await prisma.conversation
          .findMany({ where: { userId: user.id }, select: { id: true } })
          .then((cs) => cs.map((c) => c.id));
        where.conversationId = { in: convIds };
      } else {
        where.conversationId = { in: [] };
      }
    }

    const rows = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        metadata: true,
        conversationId: true,
        conversation: {
          select: {
            channel: true,
            externalConversationId: true,
            metadata: true,
            userId: true,
            user: {
              select: {
                externalId: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    return rows
      .map((r) => {
        const source = classifyDreamMessageSource({
          channel: r.conversation.channel,
          messageMetadata: r.metadata,
          conversationMetadata: r.conversation.metadata,
        });
        return {
          id: r.id,
          role: r.role,
          content: r.content,
          createdAt: r.createdAt,
          conversationId: r.conversationId,
          channel: r.conversation.channel,
          externalConversationId: r.conversation.externalConversationId,
          userId: r.conversation.userId,
          userDisplayName: r.conversation.user.displayName,
          userExternalId: r.conversation.user.externalId,
          ...source,
        };
      })
      .filter((message) => message.dreamEligible);
  }

  private async fetchMemories(
    from: Date,
    to: Date,
    userId?: string
  ): Promise<DreamSourceMemory[]> {
    const where: Record<string, unknown> = {
      createdAt: { gte: from, lte: to },
    };

    if (userId) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: userId }, { externalId: userId }] },
        select: { identityLink: { select: { personId: true } } },
      });
      where.personId = user?.identityLink?.personId ?? "__missing_person__";
    }

    const rows = await prisma.memory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        scope: true,
        tier: true,
        content: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      scope: r.scope,
      tier: r.tier,
      content: r.content,
      createdAt: r.createdAt,
    }));
  }

  private async fetchToolCalls(from: Date, to: Date): Promise<DreamSourceToolCall[]> {
    const rows = await prisma.toolCallLog.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      select: { id: true, toolName: true, status: true, createdAt: true },
    });

    return rows.map((r) => ({
      id: r.id,
      toolName: r.toolName,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }
}

export const dreamContextBuilder = new DreamContextBuilder();
