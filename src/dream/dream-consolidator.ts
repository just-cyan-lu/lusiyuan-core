// dream-consolidator.ts — Deep Sleep phase: generate MemoryProposals from signals

import { prisma } from "../db/prisma.js";
import { modelProvider } from "../core/model-provider.js";
import { DEEP_CONSOLIDATION_SYSTEM_PROMPT } from "./dream-prompts.js";
import { filterProposals } from "./dream-policy.js";
import type { MemoryProposalOwnership } from "../memory/memory-proposal-ownership.js";
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
  MemoryProposal,
  GrowthLogProposal,
  MemoryRiskFlag,
  DreamConsolidationReport,
  Prisma,
} from "@prisma/client";

export interface DreamConsolidationResult {
  report: DreamConsolidationReport;
  memoryProposals: MemoryProposal[];
  growthLogProposals: GrowthLogProposal[];
  riskFlags: MemoryRiskFlag[];
}

export class DreamConsolidator {
  async consolidate(input: {
    signals: DreamSignal[];
    dailyNote: DailyNote;
    diaryEntry?: DreamDiaryEntry | null;
    jobId?: string;
    ownership?: MemoryProposalOwnership;
    signal?: AbortSignal;
  }): Promise<DreamConsolidationResult> {
    const { signals, dailyNote, diaryEntry, jobId, ownership, signal } = input;

    const userContent = this.buildUserContent(signals, dailyNote);

    const raw = await modelProvider.chatJson<RawConsolidationOutput>(
      [
        { role: "system", content: DEEP_CONSOLIDATION_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { signal }
    );

    const rawProposals: RawConsolidationProposal[] = Array.isArray(raw.memoryProposals)
      ? raw.memoryProposals
      : [];
    const rawGrowthLogs: RawConsolidationGrowthLog[] = Array.isArray(raw.growthLogProposals)
      ? raw.growthLogProposals
      : [];
    const rawRiskFlags: RawConsolidationRiskFlag[] = Array.isArray(raw.riskFlags)
      ? raw.riskFlags
      : [];

    const filteredProposals = filterProposals(rawProposals);
    const summary = `Deep Sleep 完成。生成 ${filteredProposals.length} 条记忆提案，${rawGrowthLogs.length} 条成长日志，${rawRiskFlags.length} 个风险标记。`;
    const report = await this.createReport({
      jobId,
      summary,
      candidateCount: signals.length,
      promotedCount: filteredProposals.length,
      rejectedCount: rawProposals.length - filteredProposals.length,
      riskCount: rawRiskFlags.length,
      rawOutput: raw as unknown as Prisma.InputJsonValue,
      metadata: {
        dailyNoteId: dailyNote.id,
        diaryEntryId: diaryEntry?.id ?? null,
        sourceSignalIds: signals.map((signal) => signal.id),
      },
    });

    // Write memory proposals
    const memoryProposals: MemoryProposal[] = [];
    for (const p of filteredProposals) {
      const mp = await prisma.memoryProposal.create({
        data: {
          reportId: report.id,
          userId: ownership?.userId ?? null,
          conversationId: ownership?.conversationId ?? null,
          channel: ownership?.channel ?? null,
          proposalType: p.proposalType,
          targetMemoryId: p.targetMemoryId ?? null,
          scope: p.scope,
          type: p.type,
          content: p.content,
          summary: p.summary ?? null,
          tags: p.tags ?? [],
          entities: p.entities ?? [],
          reason: p.reason,
          confidence: p.confidence,
          riskLevel: p.riskLevel,
          sourceMessageIds: p.sourceMessageIds ?? [],
          status: "pending",
        },
      });
      memoryProposals.push(mp);
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

    const proposalIds = memoryProposals.map((p) => p.id);
    const finalReport = await prisma.dreamConsolidationReport.update({
      where: { id: report.id },
      data: {
        summary: `Deep Sleep 完成。生成 ${memoryProposals.length} 条记忆提案，${growthLogProposals.length} 条成长日志，${riskFlags.length} 个风险标记。`,
        promotedCount: memoryProposals.length,
        riskCount: riskFlags.length,
        generatedProposalIds: proposalIds,
      },
    });

    return { report: finalReport, memoryProposals, growthLogProposals, riskFlags };
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
        generatedProposalIds: [],
        rawOutput: input.rawOutput,
        metadata: input.metadata,
      },
    });
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
