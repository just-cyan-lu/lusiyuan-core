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
const MIN_LOCAL_RELEVANCE = 0.16;

export interface MemoryRetrievalInput {
  personId: string;
  query: string;
  channel?: string;
  conversationId?: string;
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

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function cjkBigrams(text: string): string[] {
  const chunks = text.match(/[\p{Script=Han}]{2,}/gu) ?? [];
  const result: string[] = [];
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length - 1; i += 1) {
      result.push(chunk.slice(i, i + 2));
    }
  }
  return result;
}

function latinTerms(text: string): string[] {
  return text.match(/[a-z0-9_+#.-]{2,}/gi)?.map((term) => term.toLowerCase()) ?? [];
}

function queryTerms(query: string): string[] {
  return Array.from(new Set([...latinTerms(query), ...cjkBigrams(query)]));
}

function memoryText(memory: Memory): string {
  const m = memory as Memory & {
    summary?: string | null;
    tags?: unknown;
    entities?: unknown;
  };
  return [
    memory.type,
    memory.content,
    m.summary ?? "",
    Array.isArray(m.tags) ? m.tags.join(" ") : "",
    Array.isArray(m.entities) ? m.entities.join(" ") : "",
  ].join("\n");
}

export function localMemoryRelevanceScore(memory: Memory, query: string): number {
  const terms = queryTerms(query);
  if (terms.length === 0) return 0;

  const text = normalizeText(memoryText(memory));
  let hits = 0;
  for (const term of terms) {
    if (text.includes(term)) hits += 1;
  }
  return hits / Math.min(Math.max(terms.length, 1), 12);
}

function isSameConversation(memory: Memory, conversationId?: string): boolean {
  return Boolean(conversationId && memory.conversationId === conversationId);
}

function semanticThreshold(memory: Memory): number {
  const scope = (memory as Memory & { scope?: string }).scope ?? "person";
  return scope === "person" ? MIN_SEMANTIC_SCORE : MIN_GLOBAL_SEMANTIC_SCORE;
}

function shouldKeepSemantic(memory: Memory, score: number): boolean {
  return score >= semanticThreshold(memory);
}

function supplementalScore(memory: Memory, query: string, conversationId?: string): number {
  const localScore = localMemoryRelevanceScore(memory, query);
  if (isSameConversation(memory, conversationId)) return Math.max(localScore, 0.3);
  return localScore;
}

function shouldKeepImportant(memory: Memory, query: string, conversationId?: string): boolean {
  const scope = (memory as Memory & { scope?: string }).scope ?? "person";
  const score = supplementalScore(memory, query, conversationId);
  if (scope !== "person") return score >= MIN_LOCAL_RELEVANCE * 1.5;
  return score >= MIN_LOCAL_RELEVANCE || isSameConversation(memory, conversationId);
}

function shouldKeepRecent(
  memory: Memory,
  personId: string,
  query: string,
  conversationId?: string
): boolean {
  const m = memory as Memory & { personId?: string | null };
  if (m.personId !== personId) return false;
  if (isSameConversation(memory, conversationId)) return true;
  return supplementalScore(memory, query, conversationId) >= MIN_LOCAL_RELEVANCE;
}

export async function retrieveMemories(
  input: MemoryRetrievalInput
): Promise<BudgetedMemory[]> {
  const { personId, query, conversationId } = input;
  const visibleWhere = visibleMemoryWhere(personId);

  const queryEmbedding = await embeddingProvider.embedText(query);
  const similarResults = await pgVectorMemoryIndex.searchSimilarMemories({
    queryEmbedding,
    personId,
    provider: embeddingProvider.providerName,
    model: embeddingProvider.model,
    dimensions: embeddingProvider.dimensions,
    topK: runtimeConfig.MEMORY_SEMANTIC_TOP_K,
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

  const importantPool = await prisma.memory.findMany({
    where: {
      ...visibleWhere,
      id: { notIn: [...keptSemanticIds] },
      importance: { gte: 8 },
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 20,
  });
  const importantMemories = importantPool
    .filter((memory) => shouldKeepImportant(memory, query, conversationId))
    .slice(0, 5);

  const recentIds = new Set([
    ...keptSemanticIds,
    ...importantMemories.map((m) => m.id),
  ]);
  const recentPool = await prisma.memory.findMany({
    where: {
      ...visibleWhere,
      id: { notIn: [...recentIds] },
      personId,
      scope: "person",
    },
    orderBy: [{ lastMentionedAt: "desc" }, { updatedAt: "desc" }],
    take: 20,
  });
  const recentMemories = recentPool
    .filter((memory) => shouldKeepRecent(memory, personId, query, conversationId))
    .slice(0, 3);

  const seenIds = new Set<string>();
  const candidates: Array<{ memory: Memory; semanticScore: number }> = [];

  for (const memory of [
    ...semanticMemories.filter((m) => keptSemanticIds.has(m.id)),
    ...importantMemories,
    ...recentMemories,
  ]) {
    if (seenIds.has(memory.id)) continue;
    seenIds.add(memory.id);
    candidates.push({
      memory,
      semanticScore:
        scoreMap.get(memory.id) ??
        supplementalScore(memory, query, conversationId),
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

export async function retrieveMemoriesWithoutEmbedding(
  input: MemoryRetrievalInput
): Promise<BudgetedMemory[]> {
  const candidates = await prisma.memory.findMany({
    where: visibleMemoryWhere(input.personId),
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 80,
  });

  const scored = candidates
    .map((memory) => ({
      memory,
      semanticScore: supplementalScore(memory, input.query, input.conversationId),
      finalScore: 0,
    }))
    .filter((item) => {
      if (item.semanticScore >= MIN_LOCAL_RELEVANCE) return true;
      return isSameConversation(item.memory, input.conversationId);
    });

  return applyMemoryBudget(rerankMemories(scored));
}
