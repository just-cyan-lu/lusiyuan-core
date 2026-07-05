// dream-diary-writer.ts — Dream Diary phase: generate DreamDiaryEntry

import { prisma } from "../db/prisma.js";
import { modelProvider } from "../core/model-provider.js";
import { loadPersona, type PersonaContent } from "../core/persona-loader.js";
import { DREAM_DIARY_SYSTEM_PROMPT } from "./dream-prompts.js";
import type { RawDreamDiaryEntry } from "./dream.types.js";
import type { DailyNote, DreamSignal, DreamDiaryEntry } from "@prisma/client";

export class DreamDiaryWriter {
  async writeDiary(input: {
    dailyNote: DailyNote;
    signals: DreamSignal[];
    jobId?: string;
    signal?: AbortSignal;
  }): Promise<DreamDiaryEntry | null> {
    const { dailyNote, signals, jobId, signal } = input;
    const persona = await loadPersona();
    const userContent = this.buildUserContent(dailyNote, signals, persona);

    const raw = await modelProvider.chatJson<RawDreamDiaryEntry>(
      [
        { role: "system", content: DREAM_DIARY_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { signal }
    );

    const title = raw.title ?? null;
    let content = raw.content ?? "";

    // Safety: reject diary entries that contain pretend-human content
    // DISABLED: Allow Lu Siyuan to write as if she's a real person in diary
    // if (containsPretendHumanContent(content)) {
    //   console.warn("[DreamDiaryWriter] Diary content failed safety check, skipping.");
    //   return null;
    // }

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
        visibility: "internal",
      },
    });

    return entry;
  }

  private buildUserContent(
    dailyNote: DailyNote,
    signals: DreamSignal[],
    persona: PersonaContent
  ): string {
    const lines: string[] = [
      `## 陆思源核心卡`,
      persona.runtimeCore.slice(0, 1200),
      ``,
      `## 长设定圣经摘要`,
      persona.personality.slice(0, 1000),
      ``,
      `## 接话规则`,
      persona.conversationBehavior.slice(0, 1000),
      ``,
      `## 语气样本`,
      persona.samples
        .map((sample) => sample.content)
        .join("\n\n")
        .slice(0, 1600),
      ``,
      `## 边界切片`,
      persona.slices
        .filter((slice) => slice.category === "boundary")
        .map((slice) => slice.content)
        .join("\n\n")
        .slice(0, 900),
      ``,
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
      `请基于以上材料，写一篇陆思源自己会写出来的梦境日记。内容只能来自今日摘要和今日信号；风格参考核心卡、接话规则和语气样本。`
    );

    return lines.join("\n");
  }
}

export const dreamDiaryWriter = new DreamDiaryWriter();
