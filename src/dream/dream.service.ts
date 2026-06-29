// dream.service.ts — orchestrates the full Dream Cycle

import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { dreamLockService } from "./dream-lock.service.js";
import { dreamContextBuilder } from "./dream-context-builder.js";
import { dailyNoteService } from "./daily-note.service.js";
import { dreamSignalExtractor } from "./dream-signal-extractor.js";
import { dreamDiaryWriter } from "./dream-diary-writer.js";
import { dreamConsolidator } from "./dream-consolidator.js";
import { dreamRelationshipAffinityOrganizer } from "./dream-relationship-affinity-organizer.js";
import { runtimeStateService } from "../runtime/runtime-state.service.js";
import {
  isTaskCancellationError,
  throwIfTaskCancelled,
} from "../runtime/running-task-registry.js";
import type { MemoryProposalOwnership } from "../memory/memory-proposal-ownership.js";
import type {
  CreateDreamJobInput,
  RunDailyDreamInput,
  DreamRunResult,
} from "./dream.types.js";

const LOCK_KEY = "dream:daily";
export const INITIAL_DREAM_FROM_TIME = new Date(0);

export function resolveContinuousDreamFromTime(
  previous: { toTime: Date | null } | null | undefined
): Date {
  return previous?.toTime ?? INITIAL_DREAM_FROM_TIME;
}

export class DreamService {
  async createJob(input: CreateDreamJobInput) {
    return prisma.dreamJob.create({
      data: {
        status: "pending",
        triggerType: input.triggerType,
        scope: input.scope,
        userId: input.userId ?? null,
        conversationId: input.conversationId ?? null,
        channel: input.channel ?? null,
        fromTime: input.fromTime ?? null,
        toTime: input.toTime ?? null,
      },
    });
  }

  async runJob(jobId: string, options: { signal?: AbortSignal } = {}): Promise<DreamRunResult> {
    const acquired = await dreamLockService.acquire(LOCK_KEY, "dream-service");
    if (!acquired) return this.currentRunningDreamResult();

    const job = await prisma.dreamJob.findUnique({ where: { id: jobId } });
    try {
      if (!job) throw new Error(`DreamJob not found: ${jobId}`);

      const to = job.toTime ?? new Date();
      const from = job.fromTime ?? (await this.resolveContinuousFromTime({
        userId: job.userId ?? undefined,
        before: to,
        excludeJobId: jobId,
      }));

      if (!job.fromTime || !job.toTime) {
        await prisma.dreamJob.update({
          where: { id: jobId },
          data: { fromTime: from, toTime: to },
        });
      }

      return await this.executeJob(
        jobId,
        from,
        to,
        job.userId ?? undefined,
        job.conversationId ?? undefined,
        job.channel ?? undefined,
        options.signal
      );
    } finally {
      await dreamLockService.release(LOCK_KEY);
    }
  }

  async runDailyDream(input: RunDailyDreamInput = {}): Promise<DreamRunResult> {
    if (!runtimeConfig.DREAM_ENABLED) {
      throw new Error("Dream Cycle is disabled in Admin runtime settings");
    }

    const acquired = await dreamLockService.acquire(LOCK_KEY, "dream-service");
    if (!acquired) return this.currentRunningDreamResult();

    const to = new Date();
    const from = await this.resolveContinuousFromTime({
      userId: input.userId,
      before: to,
    });

    const job = await this.createJob({
      triggerType: input.triggerType ?? "manual",
      scope: "daily",
      userId: input.userId,
      fromTime: from,
      toTime: to,
    });

    try {
      const result = await this.executeJob(job.id, from, to, input.userId, undefined, undefined, input.signal);
      return result;
    } catch (err) {
      throw err;
    } finally {
      await dreamLockService.release(LOCK_KEY);
    }
  }

  private async executeJob(
    jobId: string,
    from: Date,
    to: Date,
    userId?: string,
    conversationId?: string,
    channel?: string,
    signal?: AbortSignal
  ): Promise<DreamRunResult> {
    // Mark running
    await prisma.dreamJob.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date(), phase: "intake" },
    });

    try {
      throwIfTaskCancelled(signal);
      // ── Phase 1: Intake ──────────────────────────────────────────────────
      await this.setPhase(jobId, "intake");
      const context = await dreamContextBuilder.build({
        from,
        to,
        userId,
        conversationId,
      });
      throwIfTaskCancelled(signal);

      // ── Phase 2: Light Sleep — DailyNote ─────────────────────────────────
      await this.setPhase(jobId, "light_sleep");
      const dailyNote = await dailyNoteService.generateDailyNote(context, jobId, { signal });
      throwIfTaskCancelled(signal);

      if (!dailyNote) {
        await this.completeJob(jobId, "light_sleep_skipped");
        return { jobId, status: "completed", signalCount: 0, proposalCount: 0, riskCount: 0 };
      }

      // ── Phase 3: REM Sleep — DreamSignals ────────────────────────────────
      await this.setPhase(jobId, "rem_sleep");
      const signals = await dreamSignalExtractor.extractSignals({ context, dailyNote, jobId, signal });
      throwIfTaskCancelled(signal);

      // ── Phase 4: Dream Diary ──────────────────────────────────────────────
      await this.setPhase(jobId, "dream_diary");
      const diaryEntry = await dreamDiaryWriter.writeDiary({ dailyNote, signals, jobId, signal });
      throwIfTaskCancelled(signal);

      // ── Phase 5: Deep Sleep — Consolidation ──────────────────────────────
      await this.setPhase(jobId, "deep_sleep");

      const ownership = await this.resolveProposalOwnership({
        userId,
        conversationId,
        channel,
      });

      const consolidation = await dreamConsolidator.consolidate({
        signals,
        dailyNote,
        diaryEntry,
        jobId,
        ownership,
        signal,
      });
      throwIfTaskCancelled(signal);

      // ── Phase 6: Relationship Affinity — evidence-based auto update ───────
      await this.setPhase(jobId, "relationship_affinity");
      const relationshipAffinity = await dreamRelationshipAffinityOrganizer.organize({
        context,
        reportId: consolidation.report.id,
        jobId,
        signal,
      });
      throwIfTaskCancelled(signal);

      // ── Complete ──────────────────────────────────────────────────────────
      await this.completeJob(jobId, "completed");

      await runtimeStateService
        .observeDreamCycle({
          jobId,
          status: "completed",
          phase: "completed",
          summary: dailyNote.summary,
          dailyNoteId: dailyNote.id,
          diaryEntryId: diaryEntry?.id,
          signalCount: signals.length,
          proposalCount: (consolidation?.memoryProposals.length ?? 0) +
            relationshipAffinity.proposalCount,
          riskCount: consolidation?.riskFlags.length ?? 0,
          userId,
          conversationId,
          channel,
          sourceMessageIds: context.messages.map((message) => message.id),
        })
        .catch((err) =>
          console.warn("[dream] runtime event/state update failed:", err)
        );

      return {
        jobId,
        status: "completed",
        dailyNoteId: dailyNote.id,
        diaryEntryId: diaryEntry?.id,
        signalCount: signals.length,
        proposalCount: (consolidation?.memoryProposals.length ?? 0) +
          relationshipAffinity.proposalCount,
        riskCount: consolidation?.riskFlags.length ?? 0,
      };
    } catch (err) {
      if (isTaskCancellationError(err, signal)) {
        await prisma.dreamJob.update({
          where: { id: jobId },
          data: { status: "cancelled", completedAt: new Date(), error: "Task cancelled" },
        });
        return {
          jobId,
          status: "cancelled",
          signalCount: 0,
          proposalCount: 0,
          riskCount: 0,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      await prisma.dreamJob.update({
        where: { id: jobId },
        data: { status: "failed", completedAt: new Date(), error: message },
      });
      throw err;
    }
  }

  private async setPhase(jobId: string, phase: string) {
    await prisma.dreamJob.update({ where: { id: jobId }, data: { phase } });
  }

  private async completeJob(jobId: string, phase: string) {
    await prisma.dreamJob.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date(), phase },
    });
  }

  private async resolveContinuousFromTime(input: {
    userId?: string;
    before: Date;
    excludeJobId?: string;
  }): Promise<Date> {
    const previous = await prisma.dreamJob.findFirst({
      where: {
        status: "completed",
        phase: "completed",
        scope: "daily",
        userId: input.userId ?? null,
        toTime: { not: null, lt: input.before },
        ...(input.excludeJobId ? { id: { not: input.excludeJobId } } : {}),
      },
      orderBy: { toTime: "desc" },
      select: { toTime: true },
    });
    return resolveContinuousDreamFromTime(previous);
  }

  private async currentRunningDreamResult(): Promise<DreamRunResult> {
    const running = await prisma.dreamJob.findFirst({
      where: { status: "running" },
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    return {
      jobId: running?.id ?? "dream:running",
      status: "running",
      signalCount: 0,
      proposalCount: 0,
      riskCount: 0,
    };
  }

  private async resolveProposalOwnership(input: {
    userId?: string;
    conversationId?: string;
    channel?: string;
  }): Promise<MemoryProposalOwnership> {
    let userId: string | null = null;
    let conversationId: string | null = null;
    let channel: string | null = input.channel ?? null;

    if (input.conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { id: input.conversationId },
            { externalConversationId: input.conversationId },
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

    if (!userId && input.userId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: input.userId }, { externalId: input.userId }],
        },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }

    return { userId, conversationId, channel };
  }

  async getDreamReport(jobId: string) {
    return prisma.dreamConsolidationReport.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listDiaryEntries(input: { limit?: number; visibility?: string } = {}) {
    return prisma.dreamDiaryEntry.findMany({
      where: {
        status: "active",
        ...(input.visibility ? { visibility: input.visibility } : {}),
      },
      orderBy: { date: "desc" },
      take: input.limit ?? 20,
    });
  }
}

export const dreamService = new DreamService();
