// daily-note.service.ts — Light Sleep phase: generate DailyNote from DreamContext

import { prisma } from "../db/prisma.js";
import { modelProvider } from "../core/model-provider.js";
import { DAILY_NOTE_SYSTEM_PROMPT } from "./dream-prompts.js";
import type { DreamContext, DailyNoteContent } from "./dream.types.js";
import type { DailyNote } from "@prisma/client";

export class DailyNoteService {
  async generateDailyNote(
    context: DreamContext,
    jobId?: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<DailyNote> {
    const userContent = this.buildUserContent(context);

    const raw = await modelProvider.chatJson<DailyNoteContent>(
      [
        { role: "system", content: DAILY_NOTE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { signal: options.signal }
    );

    const content: DailyNoteContent = {
      summary: raw.summary ?? "（无摘要）",
      keyPoints: Array.isArray(raw.keyPoints) ? raw.keyPoints : [],
      possibleSignals: Array.isArray(raw.possibleSignals) ? raw.possibleSignals : [],
      risks: Array.isArray(raw.risks) ? raw.risks : [],
      openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions : [],
      sourceStats: context.sourceStats,
    };

    const note = await prisma.dailyNote.create({
      data: {
        jobId: jobId ?? null,
        date: context.range.from,
        scope: "daily",
        summary: content.summary,
        keyPoints: content.keyPoints,
        sourceStats: content.sourceStats,
        riskSummary: content.risks.length > 0 ? { risks: content.risks } : undefined,
      },
    });

    return note;
  }

  private buildUserContent(context: DreamContext): string {
    const lines: string[] = [
      `时间范围：${context.range.from.toISOString()} 至 ${context.range.to.toISOString()}`,
      ``,
      `## 来源统计`,
      JSON.stringify(context.sourceStats, null, 2),
      ``,
    ];

    if (context.messages.length > 0) {
      lines.push(`## 最近消息（${context.messages.length} 条）`);
      for (const m of context.messages.slice(-40)) {
        lines.push(`[${m.role}] ${m.content.slice(0, 200)}`);
      }
      lines.push("");
    }

    if (context.memories.length > 0) {
      lines.push(`## 最近记忆（${context.memories.length} 条）`);
      for (const m of context.memories.slice(0, 20)) {
        lines.push(`[${m.type}] ${m.content.slice(0, 150)}`);
      }
      lines.push("");
    }

    if (context.memoryProposals.length > 0) {
      lines.push(`## 最近记忆提案（${context.memoryProposals.length} 条）`);
      for (const p of context.memoryProposals.slice(0, 10)) {
        lines.push(`[${p.proposalType}/${p.status}] ${p.content.slice(0, 150)}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }
}

export const dailyNoteService = new DailyNoteService();
