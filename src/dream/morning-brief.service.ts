// morning-brief.service.ts — Morning Brief: summary after Dream Cycle completes

import { prisma } from "../db/prisma.js";
import type { MorningBrief } from "./dream.types.js";

export class MorningBriefService {
  async getMorningBrief(jobId: string): Promise<MorningBrief | null> {
    const job = await prisma.dreamJob.findUnique({
      where: { id: jobId },
      include: {
        dailyNotes: { take: 1, orderBy: { createdAt: "desc" } },
        diaryEntries: { take: 1, orderBy: { createdAt: "desc" } },
        signals: {
          where: { status: "active" },
          orderBy: { confidence: "desc" },
          take: 5,
        },
        reports: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!job) return null;

    const report = job.reports[0];
    const proposalCount = report?.promotedCount ?? 0;
    const riskCount = report?.riskCount ?? 0;

    const topSignals = job.signals.map((s) => ({
      signalType: s.signalType,
      content: s.content.slice(0, 100),
      confidence: s.confidence,
    }));

    const summary = [
      `Dream Cycle 完成（${job.completedAt?.toLocaleString("zh-CN") ?? "进行中"}）`,
      ``,
      `生成：`,
      `- ${job.dailyNotes.length} 篇 Daily Note`,
      `- ${job.diaryEntries.length} 篇 Dream Diary`,
      `- ${job.signals.length} 个 Dream Signal`,
      `- ${proposalCount} 条记忆/关系变更`,
      `- ${riskCount} 个风险标记`,
    ].join("\n");

    return {
      jobId,
      completedAt: job.completedAt ?? new Date(),
      dailyNoteId: job.dailyNotes[0]?.id,
      diaryEntryId: job.diaryEntries[0]?.id,
      signalCount: job.signals.length,
      proposalCount,
      riskCount,
      topSignals,
      summary,
    };
  }
}

export const morningBriefService = new MorningBriefService();
