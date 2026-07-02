import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import { pgVectorMemoryIndex } from "../vector-index/pgvector-memory-index.js";
import { rerankMemories } from "./memory-reranker.js";
import { applyMemoryBudget } from "./memory-budget.js";
import type { BudgetedMemory } from "./memory-budget.js";
import type { Memory, Prisma } from "@prisma/client";

const GLOBAL_SCOPES = ["project", "global", "topic"];
const MIN_SEMANTIC_SCORE = 0.28;
const MIN_GLOBAL_SEMANTIC_SCORE = 0.34;
const SEMANTIC_CANDIDATE_MULTIPLIER = 4;
const SEMANTIC_CANDIDATE_MIN = 24;

export interface MemoryRetrievalInput {
  personId: string;
  query: string;
}

function visibleMemoryWhere(personId: string): Prisma.MemoryWhereInput {
  return {
    status: "active",
    OR: [
      { personId, scope: "person" },
      { personId: null, scope: { in: GLOBAL_SCOPES } },
    ],
  };
}

function semanticThreshold(memory: Memory): number {
  const scope = (memory as Memory & { scope?: string }).scope ?? "person";
  return scope === "person" ? MIN_SEMANTIC_SCORE : MIN_GLOBAL_SEMANTIC_SCORE;
}

function shouldKeepSemantic(memory: Memory, score: number): boolean {
  return score >= semanticThreshold(memory);
}

function semanticCandidateCount(): number {
  return Math.max(
    SEMANTIC_CANDIDATE_MIN,
    runtimeConfig.MEMORY_FINAL_TOP_K * SEMANTIC_CANDIDATE_MULTIPLIER
  );
}

export async function retrieveMemories(
  input: MemoryRetrievalInput
): Promise<BudgetedMemory[]> {
  const { personId, query } = input;
  const visibleWhere = visibleMemoryWhere(personId);

  const queryEmbedding = await embeddingProvider.embedText(query);
  const similarResults = await pgVectorMemoryIndex.searchSimilarMemories({
    queryEmbedding,
    personId,
    provider: embeddingProvider.providerName,
    model: embeddingProvider.model,
    dimensions: embeddingProvider.dimensions,
    topK: semanticCandidateCount(),
  });

  const semanticIds = new Set(similarResults.map((r) => r.memoryId));
  const scoreMap = new Map(similarResults.map((r) => [r.memoryId, r.score]));

  const semanticMemories =
    semanticIds.size > 0
      ? await prisma.memory.findMany({
          where: { ...visibleWhere, id: { in: [...semanticIds] } },
        })
      : [];

  const keptSemanticIds = new Set(
    semanticMemories
      .filter((memory) => shouldKeepSemantic(memory, scoreMap.get(memory.id) ?? 0))
      .map((memory) => memory.id)
  );

  const seenIds = new Set<string>();
  const candidates: Array<{ memory: Memory; semanticScore: number }> = [];

  for (const memory of semanticMemories.filter((m) => keptSemanticIds.has(m.id))) {
    if (seenIds.has(memory.id)) continue;
    seenIds.add(memory.id);
    candidates.push({
      memory,
      semanticScore: scoreMap.get(memory.id) ?? 0,
    });
  }

  const ranked = rerankMemories(candidates);
  const budgeted = applyMemoryBudget(ranked);

  const accessedIds = budgeted.map((b) => b.memory.id);
  if (accessedIds.length > 0) {
    prisma.memory
      .updateMany({
        where: { id: { in: accessedIds } },
        data: {
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 },
        } satisfies Prisma.MemoryUpdateManyMutationInput,
      })
      .catch((err) => console.warn("Failed to update memory access stats:", err));
  }

  return budgeted;
}
