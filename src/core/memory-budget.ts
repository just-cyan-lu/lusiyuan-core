import { runtimeConfig } from "../config/runtime-settings.service.js";
import type { RetrievedMemory } from "./memory-reranker.js";
import type { Memory } from "@prisma/client";

export interface BudgetedMemory {
  memory: Memory;
  finalScore: number;
  text: string;
}

export function applyMemoryBudget(ranked: RetrievedMemory[]): BudgetedMemory[] {
  const topK = runtimeConfig.MEMORY_FINAL_TOP_K;
  const result: BudgetedMemory[] = [];

  for (const item of ranked) {
    if (result.length >= topK) break;

    result.push({
      memory: item.memory,
      finalScore: item.finalScore,
      text: item.memory.summary ?? item.memory.content,
    });
  }

  return result;
}
