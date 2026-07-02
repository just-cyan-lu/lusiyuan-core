import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import {
  retrieveMemories,
  type MemoryRetrievalInput,
} from "./memory-retrieval.service.js";
import { relationshipStateService } from "../runtime/relationship-state.service.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import { pgVectorMemoryIndex } from "../vector-index/pgvector-memory-index.js";
import { buildMemoryEmbeddingText } from "../embeddings/embedding-text.js";
import { createMemoryContentHash } from "../embeddings/content-hash.js";
import { buildMemoryReinforcement } from "../memory/memory-lifecycle.js";
import type { Memory } from "@prisma/client";
import type { NewMemory } from "../types/memory.js";
import type { BudgetedMemory } from "./memory-budget.js";

const memoryTierRank: Record<string, number> = {
  temp: 0,
  short: 1,
  mid: 2,
  long: 3,
};

export interface MemoryService {
  retrieveRelevantMemories(input: MemoryRetrievalInput): Promise<BudgetedMemory[]>;
  createMemories(personId: string, memories: NewMemory[]): Promise<Memory[]>;
  listPersonMemories(personId: string): Promise<Memory[]>;
  listUserMemories(userId: string): Promise<Memory[]>;
  generateAndStoreEmbedding(memory: Memory): Promise<void>;
}

class PrismaMemoryService implements MemoryService {
  async retrieveRelevantMemories(input: MemoryRetrievalInput): Promise<BudgetedMemory[]> {
    if (!runtimeConfig.MEMORY_RETRIEVAL_ENABLED) {
      return [];
    }
    return retrieveMemories(input);
  }

  async createMemories(personId: string, memories: NewMemory[]): Promise<Memory[]> {
    if (memories.length === 0) return [];

    const created: Memory[] = [];
    for (const m of memories) {
      const now = new Date();
      const lifecycle = buildMemoryReinforcement({
        scope: m.scope ?? "person",
        proposedTier: m.tier,
        sourceDayKeys:
          m.mentionDayKeys ??
          (m.lastMentionedAt
            ? [m.lastMentionedAt.toISOString().slice(0, 10)]
            : [now.toISOString().slice(0, 10)]),
        lastMentionedAt: m.lastMentionedAt ?? now,
        now,
      });
      const memory = await prisma.memory.create({
        data: {
          personId,
          type: m.type,
          scope: m.scope ?? "person",
          tier: lifecycle.tier,
          tierMentionCount: m.tierMentionCount ?? lifecycle.tierMentionCount,
          tierEnteredAt: m.tierEnteredAt ?? lifecycle.tierEnteredAt,
          content: m.content,
          summary: m.summary ?? null,
          status: m.status ?? "active",
          sourceMessageIds: m.sourceMessageIds ?? undefined,
          mentionDayKeys: lifecycle.mentionDayKeys,
          lastMentionedAt: lifecycle.lastMentionedAt,
        },
      });
      created.push(memory);

      if (runtimeConfig.MEMORY_RETRIEVAL_ENABLED) {
        this.generateAndStoreEmbedding(memory).catch((err) =>
          console.warn("Background embedding write failed:", err)
        );
      }
    }

    return created;
  }

  async listPersonMemories(personId: string): Promise<Memory[]> {
    const memories = await prisma.memory.findMany({
      where: { personId },
      orderBy: [{ updatedAt: "desc" }],
    });
    return memories.sort((a, b) => {
      const tierDelta = (memoryTierRank[b.tier] ?? 0) - (memoryTierRank[a.tier] ?? 0);
      if (tierDelta !== 0) return tierDelta;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }

  async listUserMemories(userId: string): Promise<Memory[]> {
    const relationship = await relationshipStateService.getOrCreate(userId);
    return this.listPersonMemories(relationship.personId);
  }

  async generateAndStoreEmbedding(memory: Memory): Promise<void> {
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
