// dream-context-builder.ts — collect recent system events for Dream Cycle

import { prisma } from "../db/prisma.js";
import { env } from "../utils/env.js";
import { redactPrivateData } from "./dream-policy.js";
import type {
  DreamContext,
  DreamSourceMessage,
  DreamSourceMemory,
  DreamSourceToolCall,
  DreamSourceDraft,
  DreamSourceReflectionReport,
  DreamSourceMemoryProposal,
} from "./dream.types.js";

export interface BuildDreamContextInput {
  from: Date;
  to: Date;
  userId?: string;
  conversationId?: string;
}

export class DreamContextBuilder {
  async build(input: BuildDreamContextInput): Promise<DreamContext> {
    const { from, to, userId, conversationId } = input;

    const [messages, memories, toolCalls, drafts, reflectionReports, memoryProposals] =
      await Promise.all([
        this.fetchMessages(from, to, userId, conversationId),
        this.fetchMemories(from, to, userId),
        this.fetchToolCalls(from, to),
        this.fetchDrafts(from, to),
        this.fetchReflectionReports(from, to),
        this.fetchMemoryProposals(from, to),
      ]);

    const sourceStats: Record<string, number> = {
      messages: messages.length,
      memories: memories.length,
      toolCalls: toolCalls.length,
      drafts: drafts.length,
      reflectionReports: reflectionReports.length,
      memoryProposals: memoryProposals.length,
    };

    return {
      range: { from, to },
      messages,
      memories,
      toolCalls,
      drafts,
      reflectionReports,
      memoryProposals,
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
      take: env.DREAM_MAX_MESSAGES,
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: redactPrivateData(r.content),
      createdAt: r.createdAt,
    }));
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
      });
      where.userId = user ? user.id : "__missing_user__";
    }

    const rows = await prisma.memory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, content: true, importance: true, createdAt: true },
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      content: redactPrivateData(r.content),
      importance: r.importance,
      createdAt: r.createdAt,
    }));
  }

  private async fetchToolCalls(from: Date, to: Date): Promise<DreamSourceToolCall[]> {
    const rows = await prisma.toolCallLog.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: env.DREAM_MAX_TOOL_CALLS,
      select: { id: true, toolName: true, status: true, createdAt: true },
    });

    return rows.map((r) => ({
      id: r.id,
      toolName: r.toolName,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  private async fetchDrafts(from: Date, to: Date): Promise<DreamSourceDraft[]> {
    const rows = await prisma.draft.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: env.DREAM_MAX_DRAFTS,
      select: { id: true, content: true, status: true, createdAt: true },
    });

    return rows.map((r) => ({
      id: r.id,
      content: redactPrivateData(r.content),
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  private async fetchReflectionReports(
    from: Date,
    to: Date
  ): Promise<DreamSourceReflectionReport[]> {
    const rows = await prisma.reflectionReport.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: env.DREAM_MAX_REFLECTION_REPORTS,
      select: { id: true, summary: true, confidence: true, createdAt: true },
    });

    return rows.map((r) => ({
      id: r.id,
      summary: r.summary,
      confidence: r.confidence,
      createdAt: r.createdAt,
    }));
  }

  private async fetchMemoryProposals(
    from: Date,
    to: Date
  ): Promise<DreamSourceMemoryProposal[]> {
    const rows = await prisma.memoryProposal.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: env.DREAM_MAX_MEMORY_PROPOSALS,
      select: {
        id: true,
        proposalType: true,
        content: true,
        confidence: true,
        status: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      proposalType: r.proposalType,
      content: redactPrivateData(r.content),
      confidence: r.confidence,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }
}

export const dreamContextBuilder = new DreamContextBuilder();
