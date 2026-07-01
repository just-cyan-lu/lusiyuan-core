import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import {
  retrieveMemories,
  retrieveMemoriesWithoutEmbedding,
  type MemoryRetrievalInput,
} from "./memory-retrieval.service.js";
import { relationshipStateService } from "../runtime/relationship-state.service.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import { pgVectorMemoryIndex } from "../vector-index/pgvector-memory-index.js";
import { buildMemoryEmbeddingText } from "../embeddings/embedding-text.js";
import { createMemoryContentHash } from "../embeddings/content-hash.js";
import type { Memory } from "@prisma/client";
import type { NewMemory } from "../types/memory.js";
import type { BudgetedMemory } from "./memory-budget.js";

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
      return retrieveMemoriesWithoutEmbedding(input);
    }
    return retrieveMemories(input);
  }

  async createMemories(personId: string, memories: NewMemory[]): Promise<Memory[]> {
    if (memories.length === 0) return [];

    const created: Memory[] = [];
    for (const m of memories) {
      const memory = await prisma.memory.create({
        data: {
          personId,
          type: m.type,
          scope: m.scope ?? "person",
          tier: m.tier ?? "short",
          strength: m.strength ?? 1,
          riskLevel: m.riskLevel ?? "low",
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
          sourceMessageIds: m.sourceMessageIds ?? undefined,
          sourceConversationIds: m.sourceConversationIds ?? undefined,
          sourceUserIds: m.sourceUserIds ?? undefined,
          mentionDayKeys: m.mentionDayKeys ?? undefined,
          lastMentionedAt: m.lastMentionedAt ?? null,
          nextReviewAt: m.nextReviewAt ?? null,
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
    return prisma.memory.findMany({
      where: { personId },
      orderBy: [{ tier: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
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
