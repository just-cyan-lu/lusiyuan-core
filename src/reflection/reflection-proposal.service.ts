import { prisma } from "../db/prisma.js";
import { memoryService } from "../core/memory.service.js";
import { env } from "../utils/env.js";
import {
  resolveMemoryProposalUserId,
  type MemoryProposalUserLookup,
} from "./memory-proposal-user-resolver.js";
import type { MemoryProposal } from "@prisma/client";

export class ReflectionProposalService {
  async listProposals(opts: {
    status?: string;
    reportId?: string;
    limit?: number;
  } = {}): Promise<MemoryProposal[]> {
    return prisma.memoryProposal.findMany({
      where: {
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.reportId ? { reportId: opts.reportId } : {}),
      },
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      take: opts.limit ?? 50,
    });
  }

  async approveProposal(proposalId: string, reviewerId: string): Promise<MemoryProposal> {
    const proposal = await prisma.memoryProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    if (proposal.status !== "pending") {
      throw new Error(`Proposal is already ${proposal.status}`);
    }
    return prisma.memoryProposal.update({
      where: { id: proposalId },
      data: { status: "approved", reviewedBy: reviewerId, reviewedAt: new Date() },
    });
  }

  async rejectProposal(
    proposalId: string,
    reviewerId: string,
    reason?: string
  ): Promise<MemoryProposal> {
    const proposal = await prisma.memoryProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    if (proposal.status !== "pending" && proposal.status !== "approved") {
      throw new Error(`Cannot reject proposal with status: ${proposal.status}`);
    }
    return prisma.memoryProposal.update({
      where: { id: proposalId },
      data: {
        status: "rejected",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        metadata: reason ? { rejectReason: reason } : undefined,
      },
    });
  }

  async applyProposal(proposalId: string, reviewerId: string): Promise<MemoryProposal> {
    const proposal = await prisma.memoryProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    if (proposal.status !== "approved") {
      throw new Error(`Proposal must be approved before applying (current: ${proposal.status})`);
    }
    if (proposal.riskLevel === "high" && !env.REFLECTION_AUTO_APPLY) {
      throw new Error("High-risk proposals cannot be applied without REFLECTION_AUTO_APPLY=true");
    }
    return applyService.apply(proposal, reviewerId);
  }
}

// ── Apply logic (inline to avoid circular import) ─────────────────────────────

class ReflectionApplyServiceImpl {
  async apply(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    switch (proposal.proposalType) {
      case "create_memory":
        return this.applyCreate(proposal, reviewerId);
      case "update_memory":
        return this.applyUpdate(proposal, reviewerId);
      case "supersede_memory":
        return this.applySupersede(proposal, reviewerId);
      case "archive_memory":
        return this.applyArchive(proposal, reviewerId);
      default:
        throw new Error(`Unknown proposalType: ${proposal.proposalType}`);
    }
  }

  private async applyCreate(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    const userId = await this.resolveMemoryUserId(proposal);

    const memory = await prisma.memory.create({
      data: {
        userId,
        type: proposal.type,
        scope: proposal.scope,
        content: proposal.content,
        summary: proposal.summary ?? null,
        importance: Math.round(proposal.confidence * 10),
        confidence: proposal.confidence,
        status: "active",
        source: "reflection",
        tags: proposal.tags ?? undefined,
        entities: proposal.entities ?? undefined,
      },
    });

    if (env.MEMORY_RETRIEVAL_ENABLED) {
      memoryService.generateAndStoreEmbedding(memory).catch((err) =>
        console.warn("Reflection embedding failed:", err)
      );
    }

    return prisma.memoryProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        appliedMemoryId: memory.id,
      },
    });
  }

  private async applyUpdate(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    if (!proposal.targetMemoryId) throw new Error("update_memory requires targetMemoryId");

    const memory = await prisma.memory.update({
      where: { id: proposal.targetMemoryId },
      data: {
        content: proposal.content,
        summary: proposal.summary ?? undefined,
        confidence: proposal.confidence,
        tags: proposal.tags ?? undefined,
        entities: proposal.entities ?? undefined,
      },
    });

    if (env.MEMORY_RETRIEVAL_ENABLED) {
      memoryService.generateAndStoreEmbedding(memory).catch((err) =>
        console.warn("Reflection embedding update failed:", err)
      );
    }

    return prisma.memoryProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        appliedMemoryId: memory.id,
      },
    });
  }

  private async applySupersede(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    if (!proposal.targetMemoryId) throw new Error("supersede_memory requires targetMemoryId");

    await prisma.memory.update({
      where: { id: proposal.targetMemoryId },
      data: { status: "superseded" },
    });

    let newMemoryId: string | null = null;
    if (proposal.content) {
      const userId = await this.resolveMemoryUserId(proposal);
      const newMemory = await prisma.memory.create({
        data: {
          userId,
          type: proposal.type,
          scope: proposal.scope,
          content: proposal.content,
          summary: proposal.summary ?? null,
          importance: Math.round(proposal.confidence * 10),
          confidence: proposal.confidence,
          status: "active",
          source: "reflection",
          tags: proposal.tags ?? undefined,
          entities: proposal.entities ?? undefined,
        },
      });
      newMemoryId = newMemory.id;
      if (env.MEMORY_RETRIEVAL_ENABLED) {
        memoryService.generateAndStoreEmbedding(newMemory).catch((err) =>
          console.warn("Reflection supersede embedding failed:", err)
        );
      }
    }

    return prisma.memoryProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        appliedMemoryId: newMemoryId,
      },
    });
  }

  private async applyArchive(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    if (!proposal.targetMemoryId) throw new Error("archive_memory requires targetMemoryId");

    await prisma.memory.update({
      where: { id: proposal.targetMemoryId },
      data: { status: "archived" },
    });

    return prisma.memoryProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        appliedMemoryId: proposal.targetMemoryId,
      },
    });
  }

  private async resolveMemoryUserId(proposal: MemoryProposal): Promise<string | null> {
    const lookup: MemoryProposalUserLookup = {
      findTargetMemoryUserId: async (memoryId) => {
        const target = await prisma.memory.findUnique({
          where: { id: memoryId },
          select: { userId: true },
        });
        return target?.userId ?? null;
      },
      findSourceMessageUserId: async (messageIds) => {
        const sourceMessage = await prisma.message.findFirst({
          where: { id: { in: messageIds } },
          select: {
            conversation: {
              select: { userId: true },
            },
          },
        });
        return sourceMessage?.conversation.userId ?? null;
      },
      findReportJobScope: async (reportId) => {
        const report = await prisma.reflectionReport.findUnique({
          where: { id: reportId },
          select: {
            job: {
              select: {
                userId: true,
                conversationId: true,
              },
            },
          },
        });
        return report?.job ?? null;
      },
      findUserInternalId: async (idOrExternalId) => {
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ id: idOrExternalId }, { externalId: idOrExternalId }],
          },
          select: { id: true },
        });
        return user?.id ?? null;
      },
      findConversationUserId: async (idOrExternalId) => {
        const conversation = await prisma.conversation.findFirst({
          where: {
            OR: [
              { id: idOrExternalId },
              { externalConversationId: idOrExternalId },
            ],
          },
          select: { userId: true },
        });
        return conversation?.userId ?? null;
      },
    };

    return resolveMemoryProposalUserId(proposal, lookup);
  }
}

const applyService = new ReflectionApplyServiceImpl();
export const reflectionProposalService = new ReflectionProposalService();
