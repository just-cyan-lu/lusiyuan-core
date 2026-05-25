import { prisma } from "../db/prisma.js";
import { env } from "../utils/env.js";
import { retrieveMemories } from "./memory-retrieval.service.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import { pgVectorMemoryIndex } from "../vector-index/pgvector-memory-index.js";
import { buildMemoryEmbeddingText } from "../embeddings/embedding-text.js";
import { createMemoryContentHash } from "../embeddings/content-hash.js";
import type { Memory } from "@prisma/client";
import type { NewMemory } from "../types/memory.js";
import type { BudgetedMemory } from "./memory-budget.js";

export interface MemoryService {
  searchRelevantMemories(userId: string, query: string): Promise<Memory[]>;
  retrieveRelevantMemories(userId: string, query: string): Promise<BudgetedMemory[]>;
  createMemories(userId: string, memories: NewMemory[]): Promise<void>;
  listUserMemories(userId: string): Promise<Memory[]>;
}

class PrismaMemoryService implements MemoryService {
  async searchRelevantMemories(userId: string, _query: string): Promise<Memory[]> {
    return prisma.memory.findMany({
      where: { userId },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 8,
    });
  }

  async retrieveRelevantMemories(userId: string, query: string): Promise<BudgetedMemory[]> {
    if (!env.MEMORY_RETRIEVAL_ENABLED) {
      const memories = await this.searchRelevantMemories(userId, query);
      return memories.map((m) => ({
        memory: m,
        finalScore: m.importance / 10,
        text: m.content,
      }));
    }
    return retrieveMemories({ userId, query });
  }

  async createMemories(userId: string, memories: NewMemory[]): Promise<void> {
    if (memories.length === 0) return;

    for (const m of memories) {
      const created = await prisma.memory.create({
        data: {
          userId,
          type: m.type,
          scope: m.scope ?? "user",
          content: m.content,
          summary: m.summary ?? null,
          importance: m.importance,
          confidence: m.confidence ?? 0.8,
          status: m.status ?? "active",
          source: m.source ?? null,
          tags: m.tags ?? undefined,
          entities: m.entities ?? undefined,
          channel: m.channel ?? null,
          conversationId: m.conversationId ?? null,
        },
      });

      if (env.MEMORY_RETRIEVAL_ENABLED) {
        this.generateAndStoreEmbedding(created).catch((err) =>
          console.warn("Background embedding write failed:", err)
        );
      }
    }
  }

  async listUserMemories(userId: string): Promise<Memory[]> {
    return prisma.memory.findMany({
      where: { userId },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    });
  }

  private async generateAndStoreEmbedding(memory: Memory): Promise<void> {
    const text = buildMemoryEmbeddingText(memory);
    const contentHash = createMemoryContentHash(text);

    const existing = await prisma.memoryEmbedding.findUnique({
      where: {
        memoryId_provider_model_dimensions: {
          memoryId: memory.id,
          provider: embeddingProvider.providerName,
          model: embeddingProvider.model,
          dimensions: embeddingProvider.dimensions,
        },
      },
      select: { contentHash: true },
    });

    if (existing?.contentHash === contentHash) return;

    const embedding = await embeddingProvider.embedText(text);
    await pgVectorMemoryIndex.upsertMemoryEmbedding({
      memoryId: memory.id,
      embedding,
      provider: embeddingProvider.providerName,
      model: embeddingProvider.model,
      dimensions: embeddingProvider.dimensions,
      contentHash,
    });
  }
}

export const memoryService: MemoryService = new PrismaMemoryService();
