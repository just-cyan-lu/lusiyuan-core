// dream.service.ts — orchestrates the full Dream Cycle

import { prisma } from "../db/prisma.js";
import { env } from "../utils/env.js";
import { dreamLockService } from "./dream-lock.service.js";
import { dreamContextBuilder } from "./dream-context-builder.js";
import { dailyNoteService } from "./daily-note.service.js";
import { dreamSignalExtractor } from "./dream-signal-extractor.js";
import { dreamDiaryWriter } from "./dream-diary-writer.js";
import { dreamConsolidator } from "./dream-consolidator.js";
import type { MemoryProposalOwnership } from "../reflection/memory-proposal-ownership.js";
import type {
  CreateDreamJobInput,
  RunDailyDreamInput,
  DreamRunResult,
} from "./dream.types.js";

const LOCK_KEY = "dream:daily";

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

  async runJob(jobId: string): Promise<DreamRunResult> {
    const job = await prisma.dreamJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`DreamJob not found: ${jobId}`);

    const from = job.fromTime ?? new Date(Date.now() - env.DREAM_DEFAULT_LOOKBACK_HOURS * 3600_000);
    const to = job.toTime ?? new Date();

    return this.executeJob(
      jobId,
      from,
      to,
      job.userId ?? undefined,
      job.conversationId ?? undefined,
      job.channel ?? undefined
    );
  }

  async runDailyDream(input: RunDailyDreamInput = {}): Promise<DreamRunResult> {
    if (!env.DREAM_ENABLED) {
      throw new Error("Dream Cycle is disabled (DREAM_ENABLED=false)");
    }

    const lockKey = input.userId ? `dream:user:${input.userId}` : LOCK_KEY;
    const acquired = await dreamLockService.acquire(lockKey, "dream-service");
    if (!acquired) {
      throw new Error("Dream Cycle is already running. Try again later.");
    }

    const lookbackHours = input.lookbackHours ?? env.DREAM_DEFAULT_LOOKBACK_HOURS;
    const to = new Date();
    const from = new Date(to.getTime() - lookbackHours * 3600_000);

    const job = await this.createJob({
      triggerType: input.triggerType ?? "manual",
      scope: "daily",
      userId: input.userId,
      fromTime: from,
      toTime: to,
    });

    try {
      const result = await this.executeJob(job.id, from, to, input.userId);
      await dreamLockService.release(lockKey);
      return result;
    } catch (err) {
      await dreamLockService.release(lockKey);
      throw err;
    }
  }

  private async executeJob(
    jobId: string,
    from: Date,
    to: Date,
    userId?: string,
    conversationId?: string,
    channel?: string
  ): Promise<DreamRunResult> {
    // Mark running
    await prisma.dreamJob.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date(), phase: "intake" },
    });

    try {
      // ── Phase 1: Intake ──────────────────────────────────────────────────
      await this.setPhase(jobId, "intake");
      const context = await dreamContextBuilder.build({
        from,
        to,
        userId,
        conversationId,
      });

      const totalEvents = Object.values(context.sourceStats).reduce((a, b) => a + b, 0);
      if (totalEvents < env.DREAM_MIN_SOURCE_EVENTS) {
        await prisma.dreamJob.update({
          where: { id: jobId },
          data: {
            status: "completed",
            completedAt: new Date(),
            phase: "skipped",
            metadata: { reason: "not_enough_events", totalEvents },
          },
        });
        return { jobId, status: "completed", signalCount: 0, proposalCount: 0, riskCount: 0 };
      }

      // ── Phase 2: Light Sleep — DailyNote ─────────────────────────────────
      await this.setPhase(jobId, "light_sleep");
      const dailyNote = env.DREAM_LIGHT_ENABLED
        ? await dailyNoteService.generateDailyNote(context, jobId)
        : null;

      if (!dailyNote) {
        await this.completeJob(jobId, "light_sleep_skipped");
        return { jobId, status: "completed", signalCount: 0, proposalCount: 0, riskCount: 0 };
      }

      // ── Phase 3: REM Sleep — DreamSignals ────────────────────────────────
      await this.setPhase(jobId, "rem_sleep");
      const signals = env.DREAM_REM_ENABLED
        ? await dreamSignalExtractor.extractSignals({ context, dailyNote, jobId })
        : [];

      // ── Phase 4: Dream Diary ──────────────────────────────────────────────
      await this.setPhase(jobId, "dream_diary");
      const diaryEntry = env.DREAM_DIARY_ENABLED
        ? await dreamDiaryWriter.writeDiary({ dailyNote, signals, jobId })
        : null;

      // ── Phase 5: Deep Sleep — Consolidation ──────────────────────────────
      await this.setPhase(jobId, "deep_sleep");

      // Create a synthetic ReflectionJob + ReflectionReport so MemoryProposal
      // FK constraints are satisfied (they require a reportId).
      const syntheticJob = await prisma.reflectionJob.create({
        data: {
          status: "completed",
          triggerType: "dream",
          scope: "daily",
          userId: userId ?? null,
          conversationId: conversationId ?? null,
          channel: channel ?? null,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
      const syntheticReport = await prisma.reflectionReport.create({
        data: {
          jobId: syntheticJob.id,
          summary: `Dream Cycle ${jobId} — Deep Sleep`,
          confidence: 0.8,
          rawOutput: {},
          metadata: {
            dreamJobId: jobId,
            phase: "deep_sleep",
          },
        },
      });

      const ownership = await this.resolveProposalOwnership({
        userId,
        conversationId,
        channel,
      });

      const consolidation = env.DREAM_DEEP_ENABLED
        ? await dreamConsolidator.consolidate({
            signals,
            dailyNote,
            diaryEntry,
            jobId,
            dreamReflectionReportId: syntheticReport.id,
            ownership,
          })
        : null;

      // ── Complete ──────────────────────────────────────────────────────────
      await this.completeJob(jobId, "completed");

      return {
        jobId,
        status: "completed",
        dailyNoteId: dailyNote.id,
        diaryEntryId: diaryEntry?.id,
        signalCount: signals.length,
        proposalCount: consolidation?.memoryProposals.length ?? 0,
        riskCount: consolidation?.riskFlags.length ?? 0,
      };
    } catch (err) {
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
