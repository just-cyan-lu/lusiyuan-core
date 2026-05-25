import { env } from "../utils/env.js";
import type { RetrievedMemory } from "./memory-reranker.js";
import type { Memory } from "@prisma/client";

export interface BudgetedMemory {
  memory: Memory;
  finalScore: number;
  text: string;
}

const TYPE_MAX: Record<string, number> = {
  boundary: 3,
  core: 3,
  technical_decision: 4,
  project_context: 4,
  user_preference: 3,
  relationship: 2,
  growth_event: 2,
};

export function applyMemoryBudget(ranked: RetrievedMemory[]): BudgetedMemory[] {
  const topK = env.MEMORY_FINAL_TOP_K;
  const maxChars = env.MEMORY_MAX_TOTAL_CHARS;

  const typeCounts: Record<string, number> = {};
  const result: BudgetedMemory[] = [];
  let totalChars = 0;

  for (const item of ranked) {
    if (result.length >= topK) break;

    const type = item.memory.type;
    const typeLimit = TYPE_MAX[type] ?? 2;
    if ((typeCounts[type] ?? 0) >= typeLimit) continue;

    const m = item.memory as Memory & { summary?: string | null };
    const raw = m.summary ?? item.memory.content;
    const text = raw.length > 200 ? raw.slice(0, 197) + "..." : raw;

    if (totalChars + text.length > maxChars) break;

    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    totalChars += text.length;
    result.push({ memory: item.memory, finalScore: item.finalScore, text });
  }

  return result;
}
