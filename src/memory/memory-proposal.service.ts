import { prisma } from "../db/prisma.js";
import { memoryService } from "../core/memory.service.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import {
  resolveMemoryProposalPersonId,
  type MemoryProposalPersonLookup,
} from "./memory-proposal-person-resolver.js";
import { relationshipStateService } from "../runtime/relationship-state.service.js";
import { Prisma } from "@prisma/client";
import type { Memory, MemoryProposal } from "@prisma/client";

type MemoryRollbackSnapshot = Pick<
  Memory,
  | "id"
  | "content"
  | "summary"
  | "confidence"
  | "tags"
  | "entities"
  | "status"
  | "tier"
  | "strength"
  | "riskLevel"
>;

function metadataObject(metadata: Prisma.JsonValue | null): Prisma.JsonObject {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Prisma.JsonObject)
    : {};
}

function mergeMetadata(
  proposal: MemoryProposal,
  data: Prisma.JsonObject
): Prisma.InputJsonObject {
  return {
    ...metadataObject(proposal.metadata),
    ...data,
  };
}

function snapshotMemory(memory: MemoryRollbackSnapshot): Prisma.JsonObject {
  return {
    id: memory.id,
    content: memory.content,
    summary: memory.summary,
    confidence: memory.confidence,
    tags: memory.tags,
    entities: memory.entities,
    status: memory.status,
    tier: memory.tier,
    strength: memory.strength,
    riskLevel: memory.riskLevel,
  } as Prisma.JsonObject;
}

function readRollback(metadata: Prisma.JsonValue | null): Prisma.JsonObject | null {
  const rollback = metadataObject(metadata).rollback;
  return rollback && typeof rollback === "object" && !Array.isArray(rollback)
    ? (rollback as Prisma.JsonObject)
    : null;
}

export class MemoryProposalService {
  async listProposals(opts: {
    status?: string;
    reportId?: string;
    personId?: string;
    riskLevel?: string;
    proposalType?: string;
    scope?: string;
    type?: string;
    query?: string;
    limit?: number;
    from?: Date;
    to?: Date;
  } = {}): Promise<MemoryProposal[]> {
    const q = opts.query?.trim();
    return prisma.memoryProposal.findMany({
      where: {
        ...(opts.status && opts.status !== "all" ? { status: opts.status } : {}),
        ...(opts.reportId ? { reportId: opts.reportId } : {}),
        ...(opts.personId ? { personId: opts.personId } : {}),
        ...(opts.riskLevel && opts.riskLevel !== "all" ? { riskLevel: opts.riskLevel } : {}),
        ...(opts.proposalType && opts.proposalType !== "all"
          ? { proposalType: opts.proposalType }
          : {}),
        ...(opts.scope && opts.scope !== "all" ? { scope: opts.scope } : {}),
        ...(opts.type && opts.type !== "all" ? { type: opts.type } : {}),
        ...(q
          ? {
              OR: [
                { id: { contains: q, mode: "insensitive" } },
                { reportId: { contains: q, mode: "insensitive" } },
                { personId: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { reason: { contains: q, mode: "insensitive" } },
                { targetMemoryId: { contains: q, mode: "insensitive" } },
                { appliedMemoryId: { contains: q, mode: "insensitive" } },
                { conversationId: { contains: q, mode: "insensitive" } },
                { channel: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(opts.from || opts.to
          ? { createdAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
          : {}),
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
        metadata: reason ? mergeMetadata(proposal, { rejectReason: reason }) : undefined,
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
    return applyService.apply(proposal, reviewerId);
  }

  async applyProposalGlobally(proposalId: string, reviewerId: string): Promise<MemoryProposal> {
    const proposal = await prisma.memoryProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    if (proposal.status !== "approved") {
      throw new Error(`Proposal must be approved before applying globally (current: ${proposal.status})`);
    }
    return applyService.applyGlobal(proposal, reviewerId);
  }

  async revokeProposal(proposalId: string, reviewerId: string): Promise<MemoryProposal> {
    const proposal = await prisma.memoryProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });

    if (proposal.status === "approved") {
      return prisma.memoryProposal.update({
        where: { id: proposal.id },
        data: {
          status: "pending",
          reviewedBy: null,
          reviewedAt: null,
          metadata: mergeMetadata(proposal, {
            lastRevokedAt: new Date().toISOString(),
            lastRevokedBy: reviewerId,
            lastRevokedStatus: "approved",
          }),
        },
      });
    }

    if (proposal.status !== "applied") {
      throw new Error(`Cannot revoke proposal with status: ${proposal.status}`);
    }

    return applyService.revoke(proposal, reviewerId);
  }
}

// ── Apply logic (inline to avoid circular import) ─────────────────────────────

class MemoryProposalApplyServiceImpl {
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

  async applyGlobal(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    const memory = await prisma.memory.create({
      data: {
        personId: null,
        type: proposal.type,
        scope: "global",
        tier: proposal.tier,
        strength: proposal.strength,
        riskLevel: proposal.riskLevel,
        content: proposal.content,
        summary: proposal.summary ?? null,
        importance: Math.round(proposal.confidence * 10),
        confidence: proposal.confidence,
        status: "active",
        source: "memory_proposal_global",
        tags: proposal.tags ?? undefined,
        entities: proposal.entities ?? undefined,
        channel: proposal.channel ?? null,
        conversationId: proposal.conversationId ?? null,
        sourceMessageIds: proposal.sourceMessageIds ?? undefined,
        sourceConversationIds: proposal.sourceConversationIds ?? undefined,
        sourceUserIds: proposal.sourceUserIds ?? undefined,
        metadata: {
          sourceProposalId: proposal.id,
          sourceReportId: proposal.reportId,
          applyMode: "global",
        },
      },
    });

    if (runtimeConfig.MEMORY_RETRIEVAL_ENABLED) {
      memoryService.generateAndStoreEmbedding(memory).catch((err) =>
        console.warn("Memory proposal global embedding failed:", err)
      );
    }

    return prisma.memoryProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        appliedMemoryId: memory.id,
        metadata: mergeMetadata(proposal, {
          applyMode: "global",
          rollback: {
            type: "create_memory",
            appliedMemoryId: memory.id,
          },
        }),
      },
    });
  }

  async revoke(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    const rollback = readRollback(proposal.metadata);
    const rollbackType = typeof rollback?.type === "string" ? rollback.type : proposal.proposalType;

    switch (rollbackType) {
      case "create_memory":
        await this.revokeCreatedMemory(proposal);
        break;
      case "update_memory":
        await this.revokeUpdatedMemory(proposal, rollback);
        break;
      case "supersede_memory":
        await this.revokeSupersededMemory(proposal, rollback);
        break;
      case "archive_memory":
        await this.revokeArchivedMemory(proposal, rollback);
        break;
      default:
        throw new Error(`Cannot revoke unknown proposalType: ${proposal.proposalType}`);
    }

    return prisma.memoryProposal.update({
      where: { id: proposal.id },
      data: {
        status: "approved",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        appliedMemoryId: null,
        metadata: mergeMetadata(proposal, {
          lastRevokedAt: new Date().toISOString(),
          lastRevokedBy: reviewerId,
          lastRevokedStatus: "applied",
          previousAppliedMemoryId: proposal.appliedMemoryId,
        }),
      },
    });
  }

  private async applyCreate(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    const personId = await this.resolveMemoryPersonId(proposal);

    const memory = await prisma.memory.create({
      data: {
        personId,
        type: proposal.type,
        scope: proposal.scope,
        tier: proposal.tier,
        strength: proposal.strength,
        riskLevel: proposal.riskLevel,
        content: proposal.content,
        summary: proposal.summary ?? null,
        importance: Math.round(proposal.confidence * 10),
        confidence: proposal.confidence,
        status: "active",
        source: "memory_proposal",
        tags: proposal.tags ?? undefined,
        entities: proposal.entities ?? undefined,
        channel: proposal.channel ?? null,
        conversationId: proposal.conversationId ?? null,
        sourceMessageIds: proposal.sourceMessageIds ?? undefined,
        sourceConversationIds: proposal.sourceConversationIds ?? undefined,
        sourceUserIds: proposal.sourceUserIds ?? undefined,
        metadata: {
          sourceProposalId: proposal.id,
          sourceReportId: proposal.reportId,
          applyMode: proposal.scope,
        },
      },
    });

    if (runtimeConfig.MEMORY_RETRIEVAL_ENABLED) {
      memoryService.generateAndStoreEmbedding(memory).catch((err) =>
        console.warn("Memory proposal embedding failed:", err)
      );
    }

    return prisma.memoryProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        appliedMemoryId: memory.id,
        metadata: mergeMetadata(proposal, {
          applyMode: proposal.scope,
          rollback: {
            type: "create_memory",
            appliedMemoryId: memory.id,
          },
        }),
      },
    });
  }

  private async applyUpdate(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    if (!proposal.targetMemoryId) throw new Error("update_memory requires targetMemoryId");

    const before = await prisma.memory.findUniqueOrThrow({
      where: { id: proposal.targetMemoryId },
    });

    const memory = await prisma.memory.update({
      where: { id: proposal.targetMemoryId },
      data: {
        content: proposal.content,
        summary: proposal.summary ?? undefined,
        tier: proposal.tier,
        strength: proposal.strength,
        riskLevel: proposal.riskLevel,
        confidence: proposal.confidence,
        tags: proposal.tags ?? undefined,
        entities: proposal.entities ?? undefined,
        sourceMessageIds: proposal.sourceMessageIds ?? undefined,
        sourceConversationIds: proposal.sourceConversationIds ?? undefined,
        sourceUserIds: proposal.sourceUserIds ?? undefined,
      },
    });

    if (runtimeConfig.MEMORY_RETRIEVAL_ENABLED) {
      memoryService.generateAndStoreEmbedding(memory).catch((err) =>
        console.warn("Memory proposal embedding update failed:", err)
      );
    }

    return prisma.memoryProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        appliedMemoryId: memory.id,
        metadata: mergeMetadata(proposal, {
          applyMode: proposal.scope,
          rollback: {
            type: "update_memory",
            targetMemory: snapshotMemory(before),
          },
        }),
      },
    });
  }

  private async applySupersede(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    if (!proposal.targetMemoryId) throw new Error("supersede_memory requires targetMemoryId");

    const before = await prisma.memory.findUniqueOrThrow({
      where: { id: proposal.targetMemoryId },
    });

    await prisma.memory.update({
      where: { id: proposal.targetMemoryId },
      data: { status: "superseded" },
    });

    let newMemoryId: string | null = null;
    if (proposal.content) {
      const personId = await this.resolveMemoryPersonId(proposal);
      const newMemory = await prisma.memory.create({
        data: {
          personId,
          type: proposal.type,
          scope: proposal.scope,
          tier: proposal.tier,
          strength: proposal.strength,
          riskLevel: proposal.riskLevel,
          content: proposal.content,
          summary: proposal.summary ?? null,
          importance: Math.round(proposal.confidence * 10),
          confidence: proposal.confidence,
          status: "active",
          source: "memory_proposal",
          tags: proposal.tags ?? undefined,
          entities: proposal.entities ?? undefined,
          channel: proposal.channel ?? null,
          conversationId: proposal.conversationId ?? null,
          sourceMessageIds: proposal.sourceMessageIds ?? undefined,
          sourceConversationIds: proposal.sourceConversationIds ?? undefined,
          sourceUserIds: proposal.sourceUserIds ?? undefined,
          metadata: {
            sourceProposalId: proposal.id,
            sourceReportId: proposal.reportId,
            applyMode: proposal.scope,
          },
        },
      });
      newMemoryId = newMemory.id;
      if (runtimeConfig.MEMORY_RETRIEVAL_ENABLED) {
        memoryService.generateAndStoreEmbedding(newMemory).catch((err) =>
          console.warn("Memory proposal supersede embedding failed:", err)
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
        metadata: mergeMetadata(proposal, {
          applyMode: proposal.scope,
          rollback: {
            type: "supersede_memory",
            targetMemory: snapshotMemory(before),
            appliedMemoryId: newMemoryId,
          },
        }),
      },
    });
  }

  private async applyArchive(proposal: MemoryProposal, reviewerId: string): Promise<MemoryProposal> {
    if (!proposal.targetMemoryId) throw new Error("archive_memory requires targetMemoryId");

    const before = await prisma.memory.findUniqueOrThrow({
      where: { id: proposal.targetMemoryId },
    });

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
        metadata: mergeMetadata(proposal, {
          applyMode: proposal.scope,
          rollback: {
            type: "archive_memory",
            targetMemory: snapshotMemory(before),
          },
        }),
      },
    });
  }

  private async revokeCreatedMemory(proposal: MemoryProposal): Promise<void> {
    if (!proposal.appliedMemoryId) {
      throw new Error("Applied memory id is missing");
    }
    await prisma.memory.update({
      where: { id: proposal.appliedMemoryId },
      data: { status: "archived" },
    });
  }

  private async revokeUpdatedMemory(
    proposal: MemoryProposal,
    rollback: Prisma.JsonObject | null
  ): Promise<void> {
    const targetMemory = rollback?.targetMemory;
    if (!targetMemory || typeof targetMemory !== "object" || Array.isArray(targetMemory)) {
      throw new Error("Cannot revoke update_memory without rollback snapshot");
    }
    await this.restoreMemory(targetMemory as Prisma.JsonObject);
  }

  private async revokeSupersededMemory(
    proposal: MemoryProposal,
    rollback: Prisma.JsonObject | null
  ): Promise<void> {
    const targetMemory = rollback?.targetMemory;
    if (!targetMemory || typeof targetMemory !== "object" || Array.isArray(targetMemory)) {
      throw new Error("Cannot revoke supersede_memory without rollback snapshot");
    }
    await this.restoreMemory(targetMemory as Prisma.JsonObject);
    if (proposal.appliedMemoryId) {
      await prisma.memory.update({
        where: { id: proposal.appliedMemoryId },
        data: { status: "archived" },
      });
    }
  }

  private async revokeArchivedMemory(
    _proposal: MemoryProposal,
    rollback: Prisma.JsonObject | null
  ): Promise<void> {
    const targetMemory = rollback?.targetMemory;
    if (!targetMemory || typeof targetMemory !== "object" || Array.isArray(targetMemory)) {
      throw new Error("Cannot revoke archive_memory without rollback snapshot");
    }
    await this.restoreMemory(targetMemory as Prisma.JsonObject);
  }

  private async restoreMemory(snapshot: Prisma.JsonObject): Promise<void> {
    if (typeof snapshot.id !== "string") {
      throw new Error("Invalid memory rollback snapshot");
    }
    await prisma.memory.update({
      where: { id: snapshot.id },
      data: {
        content: typeof snapshot.content === "string" ? snapshot.content : undefined,
        summary: typeof snapshot.summary === "string" ? snapshot.summary : null,
        confidence: typeof snapshot.confidence === "number" ? snapshot.confidence : undefined,
        tags: snapshot.tags ?? undefined,
        entities: snapshot.entities ?? undefined,
        status: typeof snapshot.status === "string" ? snapshot.status : "active",
        tier: typeof snapshot.tier === "string" ? snapshot.tier : undefined,
        strength: typeof snapshot.strength === "number" ? snapshot.strength : undefined,
        riskLevel: typeof snapshot.riskLevel === "string" ? snapshot.riskLevel : undefined,
      },
    });
  }

  private async resolveMemoryPersonId(proposal: MemoryProposal): Promise<string | null> {
    const lookup: MemoryProposalPersonLookup = {
      findTargetMemoryPersonId: async (memoryId) => {
        const target = await prisma.memory.findUnique({
          where: { id: memoryId },
          select: { personId: true },
        });
        return target?.personId ?? null;
      },
      findSourceMessagePersonId: async (messageIds) => {
        const sourceMessage = await prisma.message.findFirst({
          where: { id: { in: messageIds } },
          select: {
            conversation: {
              select: {
                userId: true,
                user: {
                  select: {
                    identityLink: { select: { personId: true } },
                  },
                },
              },
            },
          },
        });
        if (!sourceMessage) return null;
        return sourceMessage.conversation.user.identityLink?.personId ??
          (await relationshipStateService.getOrCreate(sourceMessage.conversation.userId)).personId;
      },
      findReportJobScope: async (reportId) => {
        const report = await prisma.dreamConsolidationReport.findUnique({
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
      findPersonId: async (id) => {
        const person = await prisma.personIdentity.findUnique({
          where: { id },
          select: { id: true },
        });
        return person?.id ?? null;
      },
      findUserPersonId: async (idOrExternalId) => {
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ id: idOrExternalId }, { externalId: idOrExternalId }],
          },
          select: {
            id: true,
            identityLink: { select: { personId: true } },
          },
        });
        if (!user) return null;
        return user.identityLink?.personId ??
          (await relationshipStateService.getOrCreate(user.id)).personId;
      },
      findConversationPersonId: async (idOrExternalId) => {
        const conversation = await prisma.conversation.findFirst({
          where: {
            OR: [
              { id: idOrExternalId },
              { externalConversationId: idOrExternalId },
            ],
          },
          select: {
            userId: true,
            user: {
              select: {
                identityLink: { select: { personId: true } },
              },
            },
          },
        });
        if (!conversation) return null;
        return conversation.user.identityLink?.personId ??
          (await relationshipStateService.getOrCreate(conversation.userId)).personId;
      },
    };

    return resolveMemoryProposalPersonId(proposal, lookup);
  }
}

const applyService = new MemoryProposalApplyServiceImpl();
export const memoryProposalService = new MemoryProposalService();
