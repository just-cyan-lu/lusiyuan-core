// dream-signal-extractor.ts — REM Sleep phase: extract DreamSignals

import { prisma } from "../db/prisma.js";
import { dreamModelProvider } from "../core/model-provider.js";
import { DREAM_SIGNAL_SYSTEM_PROMPT } from "./dream-prompts.js";
import { filterSignals, computeSignalScore } from "./dream-policy.js";
import type { DreamContext, RawDreamSignal } from "./dream.types.js";
import type { DailyNote, DreamSignal } from "@prisma/client";

export class DreamSignalExtractor {
  async extractSignals(input: {
    context: DreamContext;
    dailyNote: DailyNote;
    jobId?: string;
    signal?: AbortSignal;
  }): Promise<DreamSignal[]> {
    const { context, dailyNote, jobId, signal } = input;

    const userContent = this.buildUserContent(context, dailyNote);

    const raw = await dreamModelProvider.chatJson<RawDreamSignal[]>(
      [
        { role: "system", content: DREAM_SIGNAL_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { signal }
    );

    const rawSignals = Array.isArray(raw) ? raw : [];
    const filtered = filterSignals(rawSignals);

    if (filtered.length === 0) return [];

    const signals = await Promise.all(
      filtered.map((s) =>
        prisma.dreamSignal.create({
          data: {
            jobId: jobId ?? null,
            signalType: s.signalType,
            content: s.content,
            summary: s.summary ?? null,
            confidence: s.confidence,
            strength: computeSignalScore(s),
            riskLevel: s.riskLevel,
            sourceTypes: s.sourceTypes ?? [],
            sourceIds: s.sourceIds ?? [],
            evidenceCount: s.evidenceCount,
            tags: s.tags ?? [],
            entities: s.entities ?? [],
          },
        })
      )
    );

    return signals;
  }

  private buildUserContent(context: DreamContext, dailyNote: DailyNote): string {
    const lines: string[] = [
      `## Daily Note 摘要`,
      dailyNote.summary,
      ``,
    ];

    const keyPoints = dailyNote.keyPoints as string[] | null;
    if (keyPoints && keyPoints.length > 0) {
      lines.push(`## 今日要点`);
      for (const kp of keyPoints) lines.push(`- ${kp}`);
      lines.push("");
    }

    if (context.messages.length > 0) {
      lines.push(`## 消息样本（最近 20 条）`);
      for (const m of context.messages.slice(-20)) {
        lines.push(
          `[${m.id}][${m.role}][${m.sourceKind ?? "unknown"}][${m.continuity ?? "unknown"}] ${m.content.slice(0, 150)}`
        );
      }
      lines.push("");
    }

    if (context.memories.length > 0) {
      lines.push(`## 现有记忆（最近 10 条）`);
      for (const m of context.memories.slice(0, 10)) {
        lines.push(`[${m.id}][${m.type}] ${m.content.slice(0, 120)}`);
      }
      lines.push("");
    }

    lines.push(`## 来源统计`);
    lines.push(JSON.stringify(context.sourceStats));

    return lines.join("\n");
  }
}

export const dreamSignalExtractor = new DreamSignalExtractor();
