import { prisma } from "../db/prisma.js";
import { buildReflectionContext } from "./reflection-context-builder.js";
import { runReflectionAnalysis } from "./reflection-report-formatter.js";
import { applyReflectionPolicy } from "./reflection-policy.js";
import { runtimeStateService } from "../runtime/runtime-state.service.js";
import type { MemoryProposalOwnership } from "./memory-proposal-ownership.js";
import type {
  CreateReflectionJobInput,
  RawMemoryProposal,
} from "./reflection.types.js";
import type {
  ReflectionJob,
  ReflectionReport,
} from "@prisma/client";

export class ReflectionService {
  async createJob(input: CreateReflectionJobInput): Promise<ReflectionJob> {
    return prisma.reflectionJob.create({
      data: {
        status: "pending",
        triggerType: input.triggerType,
        scope: input.scope,
        userId: input.userId ?? null,
        conversationId: input.conversationId ?? null,
        channel: input.channel ?? null,
        messageLimit: input.messageLimit ?? null,
        messageFrom: input.from ?? null,
        messageTo: input.to ?? null,
      },
    });
  }

  async runJob(jobId: string): Promise<ReflectionReport> {
    const job = await prisma.reflectionJob.findUniqueOrThrow({
      where: { id: jobId },
    });

    await prisma.reflectionJob.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date() },
    });

    try {
      const context = await buildReflectionContext({
        scope: job.scope as never,
        userId: job.userId ?? undefined,
        conversationId: job.conversationId ?? undefined,
        channel: job.channel ?? undefined,
        messageLimit: job.messageLimit ?? undefined,
        from: job.messageFrom ?? undefined,
        to: job.messageTo ?? undefined,
      });

      const raw = await runReflectionAnalysis(context);
      const { allowedProposals, allowedRiskFlags, allowedGrowthLogs } =
        applyReflectionPolicy(raw);

      const report = await prisma.reflectionReport.create({
        data: {
          jobId,
          summary: raw.summary,
          confidence: raw.confidence,
          rawOutput: raw as object,
        },
      });

      const ownership = await this.resolveProposalOwnership(job);
      await this.saveProposals(report.id, allowedProposals, ownership);
      await this.saveRiskFlags(report.id, allowedRiskFlags);
      await this.saveGrowthLogs(report.id, allowedGrowthLogs);

      await runtimeStateService
        .observeReflectionReport({
          reportId: report.id,
          jobId,
          summary: report.summary,
          confidence: report.confidence,
          triggerType: job.triggerType,
          userId: ownership.userId,
          conversationId: ownership.conversationId,
          channel: ownership.channel,
          proposalCount: allowedProposals.length + allowedGrowthLogs.length,
          riskCount: allowedRiskFlags.length,
          sourceMessageIds: context.messages.map((message) => message.id),
        })
        .catch((err) =>
          console.warn("[reflection] runtime event/state update failed:", err)
        );

      await prisma.reflectionJob.update({
        where: { id: jobId },
        data: { status: "completed", completedAt: new Date() },
      });

      return report;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await prisma.reflectionJob.update({
        where: { id: jobId },
        data: { status: "failed", error, completedAt: new Date() },
      });
      throw err;
    }
  }

  async runManualReflection(
    input: CreateReflectionJobInput
  ): Promise<ReflectionReport> {
    const job = await this.createJob(input);
    return this.runJob(job.id);
  }

  async getReport(reportId: string): Promise<ReflectionReport | null> {
    return prisma.reflectionReport.findUnique({ where: { id: reportId } });
  }

  async listReports(limit = 20): Promise<ReflectionReport[]> {
    return prisma.reflectionReport.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  private async saveProposals(
    reportId: string,
    proposals: RawMemoryProposal[],
    ownership: MemoryProposalOwnership
  ): Promise<void> {
    if (proposals.length === 0) return;
    await prisma.memoryProposal.createMany({
      data: proposals.map((p) => ({
        reportId,
        userId: ownership.userId ?? null,
        conversationId: ownership.conversationId ?? null,
        channel: ownership.channel ?? null,
        proposalType: p.proposalType,
        targetMemoryId: p.targetMemoryId ?? null,
        scope: p.scope,
        type: p.type,
        content: p.content,
        summary: p.summary ?? null,
        tags: p.tags ?? undefined,
        entities: p.entities ?? undefined,
        reason: p.reason,
        confidence: p.confidence,
        riskLevel: p.riskLevel,
        sourceMessageIds: p.sourceMessageIds ?? undefined,
      })),
    });
  }

  private async resolveProposalOwnership(
    job: ReflectionJob
  ): Promise<MemoryProposalOwnership> {
    let userId: string | null = null;
    let conversationId: string | null = null;
    let channel: string | null = job.channel ?? null;

    if (job.conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { id: job.conversationId },
            { externalConversationId: job.conversationId },
          ],
        },
        select: { id: true, userId: true, channel: true },
      });
      if (conversation) {
        conversationId = conversation.id;
        userId = conversation.userId;
        channel = channel ?? conversation.channel;
      }
    }

    if (!userId && job.userId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: job.userId }, { externalId: job.userId }],
        },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }

    return { userId, conversationId, channel };
  }

  private async saveRiskFlags(
    reportId: string,
    flags: { type: string; severity: string; description: string; suggestedAction?: string; relatedMessageIds?: string[] }[]
  ): Promise<void> {
    if (flags.length === 0) return;
    await prisma.reflectionRiskFlag.createMany({
      data: flags.map((f) => ({
        reportId,
        type: f.type,
        severity: f.severity,
        description: f.description,
        suggestedAction: f.suggestedAction ?? null,
        relatedMessageIds: f.relatedMessageIds ?? undefined,
      })),
    });
  }

  private async saveGrowthLogs(
    reportId: string,
    logs: { title: string; content: string; tags?: string[]; confidence: number; sourceMessageIds?: string[] }[]
  ): Promise<void> {
    if (logs.length === 0) return;
    await prisma.growthLogProposal.createMany({
      data: logs.map((g) => ({
        reportId,
        title: g.title,
        content: g.content,
        tags: g.tags ?? undefined,
        confidence: g.confidence,
        sourceMessageIds: g.sourceMessageIds ?? undefined,
      })),
    });
  }
}

export const reflectionService = new ReflectionService();
