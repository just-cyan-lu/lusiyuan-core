import { prisma } from "../db/prisma.js";
import { env } from "../utils/env.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import { pgVectorMemoryIndex } from "../vector-index/pgvector-memory-index.js";
import { rerankMemories } from "./memory-reranker.js";
import { applyMemoryBudget } from "./memory-budget.js";
import type { BudgetedMemory } from "./memory-budget.js";
import type { Memory, Prisma } from "@prisma/client";

interface RetrievalInput {
  userId: string;
  query: string;
  channel?: string;
  conversationId?: string;
}

export async function retrieveMemories(
  input: RetrievalInput
): Promise<BudgetedMemory[]> {
  const { userId, query } = input;
  const visibleMemoryWhere = {
    status: "active",
    OR: [
      { userId },
      { userId: null, scope: { in: ["project", "global"] } },
    ],
  } satisfies Prisma.MemoryWhereInput;

  // Semantic candidates via pgvector
  const queryEmbedding = await embeddingProvider.embedText(query);
  const similarResults = await pgVectorMemoryIndex.searchSimilarMemories({
    queryEmbedding,
    userId,
    provider: embeddingProvider.providerName,
    model: embeddingProvider.model,
    dimensions: embeddingProvider.dimensions,
    topK: env.MEMORY_SEMANTIC_TOP_K,
  });

  const semanticIds = new Set(similarResults.map((r) => r.memoryId));
  const scoreMap = new Map(similarResults.map((r) => [r.memoryId, r.score]));

  // Supplemental: high-importance active memories not in semantic results
  const importantWhere = {
    ...visibleMemoryWhere,
    id: { notIn: [...semanticIds] },
  } satisfies Prisma.MemoryWhereInput;
  const importantMemories = await prisma.memory.findMany({
    where: importantWhere,
    orderBy: { importance: "desc" },
    take: 5,
  });

  // Supplemental: most recent active memories not in semantic results
  const recentIds = new Set([
    ...semanticIds,
    ...importantMemories.map((m) => m.id),
  ]);
  const recentWhere = {
    ...visibleMemoryWhere,
    id: { notIn: [...recentIds] },
  } satisfies Prisma.MemoryWhereInput;
  const recentMemories = await prisma.memory.findMany({
    where: recentWhere,
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  // Fetch full Memory records for semantic candidates
  const semanticMemories =
    semanticIds.size > 0
      ? await prisma.memory.findMany({
          where: { id: { in: [...semanticIds] } },
        })
      : [];

  // Merge and deduplicate
  const seenIds = new Set<string>();
  const candidates: Array<{ memory: Memory; semanticScore: number }> = [];

  for (const m of [
    ...semanticMemories,
    ...importantMemories,
    ...recentMemories,
  ]) {
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    candidates.push({ memory: m, semanticScore: scoreMap.get(m.id) ?? 0 });
  }

  const ranked = rerankMemories(candidates);
  const budgeted = applyMemoryBudget(ranked);

  // Update access stats (fire-and-forget)
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
