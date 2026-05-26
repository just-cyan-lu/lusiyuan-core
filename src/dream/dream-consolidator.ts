// dream-consolidator.ts — Deep Sleep phase: generate MemoryProposals from signals

import { prisma } from "../db/prisma.js";
import { modelProvider } from "../core/model-provider.js";
import { DEEP_CONSOLIDATION_SYSTEM_PROMPT } from "./dream-prompts.js";
import { filterProposals } from "./dream-policy.js";
import { env } from "../utils/env.js";
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
  ReflectionRiskFlag,
  DreamConsolidationReport,
} from "@prisma/client";

export interface DreamConsolidationResult {
  report: DreamConsolidationReport;
  memoryProposals: MemoryProposal[];
  growthLogProposals: GrowthLogProposal[];
  riskFlags: ReflectionRiskFlag[];
}

export class DreamConsolidator {
  async consolidate(input: {
    signals: DreamSignal[];
    dailyNote: DailyNote;
    diaryEntry?: DreamDiaryEntry | null;
    jobId?: string;
    dreamReflectionReportId: string;
  }): Promise<DreamConsolidationResult> {
    const { signals, dailyNote, jobId, dreamReflectionReportId } = input;

    if (!env.DREAM_DEEP_ENABLED) {
      const emptyReport = await this.createReport(jobId, "", 0, 0, 0, 0, []);
      return { report: emptyReport, memoryProposals: [], growthLogProposals: [], riskFlags: [] };
    }

    const userContent = this.buildUserContent(signals, dailyNote);

    const raw = await modelProvider.chatJson<RawConsolidationOutput>([
      { role: "system", content: DEEP_CONSOLIDATION_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);

    const rawProposals: RawConsolidationProposal[] = Array.isArray(raw.memoryProposals)
      ? raw.memoryProposals
      : [];
    const rawGrowthLogs: RawConsolidationGrowthLog[] = Array.isArray(raw.growthLogProposals)
      ? raw.growthLogProposals
      : [];
    const rawRiskFlags: RawConsolidationRiskFlag[] = Array.isArray(raw.riskFlags)
      ? raw.riskFlags
      : [];

    const filteredProposals = filterProposals(rawProposals).slice(
      0,
      env.DREAM_MAX_PROPOSALS_PER_RUN
    );

    // Write memory proposals
    const memoryProposals: MemoryProposal[] = [];
    if (env.DREAM_ALLOW_MEMORY_PROPOSALS) {
      for (const p of filteredProposals) {
        const mp = await prisma.memoryProposal.create({
          data: {
            reportId: dreamReflectionReportId,
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
    }

    // Write growth log proposals
    const growthLogProposals: GrowthLogProposal[] = [];
    if (env.DREAM_ALLOW_GROWTH_LOG_PROPOSALS) {
      for (const g of rawGrowthLogs.slice(0, 5)) {
        const glp = await prisma.growthLogProposal.create({
          data: {
            reportId: dreamReflectionReportId,
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
    }

    // Write risk flags
    const riskFlags: ReflectionRiskFlag[] = [];
    for (const rf of rawRiskFlags.slice(0, 10)) {
      const flag = await prisma.reflectionRiskFlag.create({
        data: {
          reportId: dreamReflectionReportId,
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
    const report = await this.createReport(
      jobId,
      `Deep Sleep 完成。生成 ${memoryProposals.length} 条记忆提案，${growthLogProposals.length} 条成长日志，${riskFlags.length} 个风险标记。`,
      signals.length,
      memoryProposals.length,
      rawProposals.length - filteredProposals.length,
      riskFlags.length,
      proposalIds
    );

    return { report, memoryProposals, growthLogProposals, riskFlags };
  }

  private async createReport(
    jobId: string | undefined,
    summary: string,
    candidateCount: number,
    promotedCount: number,
    rejectedCount: number,
    riskCount: number,
    proposalIds: string[]
  ): Promise<DreamConsolidationReport> {
    return prisma.dreamConsolidationReport.create({
      data: {
        jobId: jobId ?? null,
        summary,
        phase: "deep_sleep",
        candidateCount,
        promotedCount,
        rejectedCount,
        riskCount,
        generatedProposalIds: proposalIds,
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
