// dream-diary-writer.ts — Dream Diary phase: generate DreamDiaryEntry

import { prisma } from "../db/prisma.js";
import { modelProvider } from "../core/model-provider.js";
import { DREAM_DIARY_SYSTEM_PROMPT } from "./dream-prompts.js";
import { containsPretendHumanContent } from "./dream-policy.js";
import { env } from "../utils/env.js";
import type { RawDreamDiaryEntry } from "./dream.types.js";
import type { DailyNote, DreamSignal, DreamDiaryEntry } from "@prisma/client";

export class DreamDiaryWriter {
  async writeDiary(input: {
    dailyNote: DailyNote;
    signals: DreamSignal[];
    jobId?: string;
  }): Promise<DreamDiaryEntry | null> {
    if (!env.DREAM_DIARY_ENABLED) return null;

    const { dailyNote, signals, jobId } = input;
    const userContent = this.buildUserContent(dailyNote, signals);

    const raw = await modelProvider.chatJson<RawDreamDiaryEntry>([
      { role: "system", content: DREAM_DIARY_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);

    const title = raw.title ?? null;
    let content = raw.content ?? "";

    // Safety: reject diary entries that contain pretend-human content
    if (containsPretendHumanContent(content)) {
      console.warn("[DreamDiaryWriter] Diary content failed safety check, skipping.");
      return null;
    }

    // Enforce character limit
    if (content.length > env.DREAM_DIARY_MAX_CHARS) {
      content = content.slice(0, env.DREAM_DIARY_MAX_CHARS);
    }

    const sourceSignalIds = signals.map((s) => s.id);

    const entry = await prisma.dreamDiaryEntry.create({
      data: {
        jobId: jobId ?? null,
        date: dailyNote.date,
        title,
        content,
        style: "lusiyuan_inner_diary",
        grounded: true,
        sourceSignalIds,
        visibility: env.DREAM_DIARY_VISIBILITY,
      },
    });

    return entry;
  }

  private buildUserContent(dailyNote: DailyNote, signals: DreamSignal[]): string {
    const lines: string[] = [
      `## 今日摘要`,
      dailyNote.summary,
      ``,
    ];

    const keyPoints = dailyNote.keyPoints as string[] | null;
    if (keyPoints && keyPoints.length > 0) {
      lines.push(`## 今日要点`);
      for (const kp of keyPoints) lines.push(`- ${kp}`);
      lines.push("");
    }

    if (signals.length > 0) {
      lines.push(`## 今日信号（${signals.length} 个）`);
      for (const s of signals.slice(0, 8)) {
        lines.push(`[${s.signalType}] ${s.content.slice(0, 120)}`);
      }
      lines.push("");
    }

    lines.push(
      `请基于以上材料，写一篇陆思源风格的梦境日记。记住：可以用比喻，但不能编造真实世界经历，不能说自己是真人。`
    );

    return lines.join("\n");
  }
}

export const dreamDiaryWriter = new DreamDiaryWriter();
