import { prisma } from "../db/prisma.js";
import { randomUUID } from "crypto";
import type {
  VectorMemoryIndex,
  UpsertEmbeddingInput,
  SearchSimilarInput,
  SimilarMemoryResult,
} from "./vector-memory-index.js";

export class PgVectorMemoryIndex implements VectorMemoryIndex {
  async upsertMemoryEmbedding(input: UpsertEmbeddingInput): Promise<void> {
    const { memoryId, embedding, provider, model, dimensions, contentHash } = input;
    const vectorLiteral = `[${embedding.join(",")}]`;

    const existing = await prisma.memoryEmbedding.findUnique({
      where: { memoryId_provider_model_dimensions: { memoryId, provider, model, dimensions } },
      select: { id: true },
    });

    if (existing) {
      await prisma.$executeRaw`
        UPDATE "memory_embeddings"
        SET "embedding" = ${vectorLiteral}::vector,
            "contentHash" = ${contentHash},
            "updatedAt" = NOW()
        WHERE "id" = ${existing.id}
      `;
    } else {
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "memory_embeddings" ("id", "memoryId", "provider", "model", "dimensions", "contentHash", "embedding", "createdAt", "updatedAt")
        VALUES (${id}, ${memoryId}, ${provider}, ${model}, ${dimensions}, ${contentHash}, ${vectorLiteral}::vector, NOW(), NOW())
      `;
    }
  }

  async searchSimilarMemories(input: SearchSimilarInput): Promise<SimilarMemoryResult[]> {
    const { queryEmbedding, personId, provider, model, dimensions, topK } = input;
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;

    const rows = await prisma.$queryRaw<Array<{ memory_id: string; score: number }>>`
      SELECT
        me."memoryId"  AS memory_id,
        1 - (me."embedding" <=> ${vectorLiteral}::vector) AS score
      FROM "memory_embeddings" me
      JOIN "memories" m ON m."id" = me."memoryId"
      WHERE
        me."provider"   = ${provider}
        AND me."model"      = ${model}
        AND me."dimensions" = ${dimensions}
        AND m."status"      = 'active'
        AND (
          (m."personId" IS NULL AND m."scope" IN ('project', 'global', 'topic'))
          OR (m."personId" = ${personId} AND m."scope" = 'person')
        )
      ORDER BY me."embedding" <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `;

    return rows.map((r) => ({ memoryId: r.memory_id, score: Number(r.score) }));
  }

  async deleteMemoryEmbedding(
    memoryId: string,
    provider: string,
    model: string,
    dimensions: number
  ): Promise<void> {
    await prisma.memoryEmbedding.deleteMany({
      where: { memoryId, provider, model, dimensions },
    });
  }
}

export const pgVectorMemoryIndex = new PgVectorMemoryIndex();
