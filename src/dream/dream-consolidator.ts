// dream-consolidator.ts — Deep Sleep phase: write global/project/topic memories from signals

import { prisma } from "../db/prisma.js";
import { dreamModelProvider } from "../core/model-provider.js";
import { memoryService } from "../core/memory.service.js";
import { DEEP_CONSOLIDATION_SYSTEM_PROMPT } from "./dream-prompts.js";
import { filterProposals } from "./dream-policy.js";
import { buildMemoryReinforcement } from "../memory/memory-lifecycle.js";
import type {
  RawConsolidationOutput,
  RawConsolidationProposal,
  RawConsolidationGrowthLog,
  RawConsolidationRiskFlag,
} from "./dream.types.js";
import type {
  DailyNote,
  DreamSignal,
  DreamDiaryEntry,
  Memory,
  GrowthLogProposal,
  MemoryRiskFlag,
  DreamConsolidationReport,
  Prisma,
} from "@prisma/client";

export interface DreamConsolidationResult {
  report: DreamConsolidationReport;
  memories: Memory[];
  growthLogProposals: GrowthLogProposal[];
  riskFlags: MemoryRiskFlag[];
}

export class DreamConsolidator {
  async consolidate(input: {
    signals: DreamSignal[];
    dailyNote: DailyNote;
    diaryEntry?: DreamDiaryEntry | null;
    jobId?: string;
    signal?: AbortSignal;
  }): Promise<DreamConsolidationResult> {
    const { signals, dailyNote, diaryEntry, jobId, signal } = input;

    const userContent = this.buildUserContent(signals, dailyNote);

    const raw = await dreamModelProvider.chatJson<RawConsolidationOutput>(
      [
        { role: "system", content: DEEP_CONSOLIDATION_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { signal }
    );

    const rawMemoryChanges: RawConsolidationProposal[] = Array.isArray(raw.memoryChanges)
      ? raw.memoryChanges
      : [];
    const rawGrowthLogs: RawConsolidationGrowthLog[] = Array.isArray(raw.growthLogProposals)
      ? raw.growthLogProposals
      : [];
    const rawRiskFlags: RawConsolidationRiskFlag[] = Array.isArray(raw.riskFlags)
      ? raw.riskFlags
      : [];

    const filteredMemoryChanges = filterProposals(rawMemoryChanges);
    const summary = `Deep Sleep 完成。准备写入 ${filteredMemoryChanges.length} 条记忆，${rawGrowthLogs.length} 条成长日志，${rawRiskFlags.length} 个风险标记。`;
    const report = await this.createReport({
      jobId,
      summary,
      candidateCount: signals.length,
      promotedCount: filteredMemoryChanges.length,
      rejectedCount: rawMemoryChanges.length - filteredMemoryChanges.length,
      riskCount: rawRiskFlags.length,
      rawOutput: raw as unknown as Prisma.InputJsonValue,
      metadata: {
        dailyNoteId: dailyNote.id,
        diaryEntryId: diaryEntry?.id ?? null,
        sourceSignalIds: signals.map((signal) => signal.id),
      },
    });

    const memories: Memory[] = [];
    for (const change of filteredMemoryChanges) {
      const memory = await this.applyMemoryChange(change);
      if (!memory) continue;
      memories.push(memory);
      if (memory.status === "active") {
        memoryService.generateAndStoreEmbedding(memory).catch((err) =>
          console.warn("[dream] deep memory embedding failed:", err)
        );
      }
    }

    // Write growth log proposals
    const growthLogProposals: GrowthLogProposal[] = [];
    for (const g of rawGrowthLogs) {
      const glp = await prisma.growthLogProposal.create({
        data: {
          reportId: report.id,
          title: g.title,
          content: g.content,
          tags: g.tags ?? [],
          confidence: g.confidence,
          sourceMessageIds: g.sourceMessageIds ?? [],
          status: "pending",
        },
      });
      growthLogProposals.push(glp);
    }

    // Write risk flags
    const riskFlags: MemoryRiskFlag[] = [];
    for (const rf of rawRiskFlags) {
      const flag = await prisma.memoryRiskFlag.create({
        data: {
          reportId: report.id,
          type: rf.type,
          severity: rf.severity,
          description: rf.description,
          suggestedAction: rf.suggestedAction ?? null,
          relatedMessageIds: rf.relatedMessageIds ?? [],
          status: "open",
        },
      });
      riskFlags.push(flag);
    }

    const memoryIds = memories.map((memory) => memory.id);
    const finalReport = await prisma.dreamConsolidationReport.update({
      where: { id: report.id },
      data: {
        summary: `Deep Sleep 完成。写入 ${memories.length} 条记忆，${growthLogProposals.length} 条成长日志，${riskFlags.length} 个风险标记。`,
        promotedCount: memories.length,
        riskCount: riskFlags.length,
        metadata: {
          dailyNoteId: dailyNote.id,
          diaryEntryId: diaryEntry?.id ?? null,
          sourceSignalIds: signals.map((signal) => signal.id),
          generatedMemoryIds: memoryIds,
        },
      },
    });

    return { report: finalReport, memories, growthLogProposals, riskFlags };
  }

  private async createReport(input: {
    jobId: string | undefined;
    summary: string;
    candidateCount: number;
    promotedCount: number;
    rejectedCount: number;
    riskCount: number;
    rawOutput: Prisma.InputJsonValue;
    metadata: Prisma.InputJsonValue;
  }): Promise<DreamConsolidationReport> {
    return prisma.dreamConsolidationReport.create({
      data: {
        jobId: input.jobId ?? null,
        summary: input.summary,
        phase: "deep_sleep",
        candidateCount: input.candidateCount,
        promotedCount: input.promotedCount,
        rejectedCount: input.rejectedCount,
        riskCount: input.riskCount,
        rawOutput: input.rawOutput,
        metadata: input.metadata,
      },
    });
  }

  private async applyMemoryChange(change: RawConsolidationProposal): Promise<Memory | null> {
    const scope = ["project", "global", "topic"].includes(change.scope) ? change.scope : "topic";
    const now = new Date();
    const sourceMessageIds = Array.isArray(change.sourceMessageIds)
      ? change.sourceMessageIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (change.proposalType === "create_memory") {
      const lifecycle = buildMemoryReinforcement({
        scope,
        proposedTier: "mid",
        sourceDayKeys: [now.toISOString().slice(0, 10)],
        lastMentionedAt: now,
        now,
      });
      return prisma.memory.create({
        data: {
          personId: null,
          scope,
          type: change.type,
          tier: lifecycle.tier,
          tierMentionCount: lifecycle.tierMentionCount,
          tierEnteredAt: lifecycle.tierEnteredAt,
          content: change.content,
          summary: change.summary ?? null,
          status: "active",
          sourceMessageIds,
          mentionDayKeys: lifecycle.mentionDayKeys,
          lastMentionedAt: lifecycle.lastMentionedAt,
        },
      });
    }

    if (!change.targetMemoryId) return null;
    const target = await prisma.memory.findFirst({
      where: {
        id: change.targetMemoryId,
        personId: null,
        scope,
      },
    });
    if (!target) return null;

    if (change.proposalType === "archive_memory") {
      return prisma.memory.update({
        where: { id: target.id },
        data: { status: "archived" },
      });
    }

    if (change.proposalType === "supersede_memory") {
      await prisma.memory.update({
        where: { id: target.id },
        data: { status: "superseded" },
      });
      const lifecycle = buildMemoryReinforcement({
        scope,
        proposedTier: target.tier,
        sourceDayKeys: [now.toISOString().slice(0, 10)],
        lastMentionedAt: now,
        now,
      });
      return prisma.memory.create({
        data: {
          personId: null,
          scope,
          type: change.type,
          tier: lifecycle.tier,
          tierMentionCount: lifecycle.tierMentionCount,
          tierEnteredAt: lifecycle.tierEnteredAt,
          content: change.content,
          summary: change.summary ?? null,
          status: "active",
          sourceMessageIds,
          mentionDayKeys: lifecycle.mentionDayKeys,
          lastMentionedAt: lifecycle.lastMentionedAt,
        },
      });
    }

    const lifecycle = buildMemoryReinforcement({
      existing: target,
      scope,
      proposedTier: target.tier,
      sourceDayKeys: [now.toISOString().slice(0, 10)],
      lastMentionedAt: now,
      now,
    });
    return prisma.memory.update({
      where: { id: target.id },
      data: {
        type: change.type,
        tier: lifecycle.tier,
        tierMentionCount: lifecycle.tierMentionCount,
        tierEnteredAt: lifecycle.tierEnteredAt,
        content: change.content,
        summary: change.summary ?? null,
        sourceMessageIds: Array.from(new Set([
          ...this.stringArray(target.sourceMessageIds),
          ...sourceMessageIds,
        ])),
        mentionDayKeys: lifecycle.mentionDayKeys,
        lastMentionedAt: lifecycle.lastMentionedAt,
      },
    });
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  }

  private buildUserContent(signals: DreamSignal[], dailyNote: DailyNote): string {
    const lines: string[] = [
      `## Daily Note 摘要`,
      dailyNote.summary,
      ``,
      `## Dream Signals（${signals.length} 个）`,
    ];

    for (const s of signals) {
      lines.push(
        `[${s.id}][${s.signalType}][confidence=${s.confidence.toFixed(2)}][risk=${s.riskLevel}] ${s.content}`
      );
      if (s.sourceIds) {
        lines.push(`  来源: ${JSON.stringify(s.sourceIds)}`);
      }
    }

    return lines.join("\n");
  }
}

export const dreamConsolidator = new DreamConsolidator();
