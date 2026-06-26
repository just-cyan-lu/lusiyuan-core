import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";

interface UpsertMessageEmbeddingInput {
  messageId: string;
  conversationId: string;
  embedding: number[];
  provider: string;
  model: string;
  dimensions: number;
  contentHash: string;
}

interface SearchSimilarMessagesInput {
  queryEmbedding: number[];
  userId: string;
  provider: string;
  model: string;
  dimensions: number;
  topK: number;
}

export interface SimilarMessageResult {
  messageId: string;
  conversationId: string;
  score: number;
}

export async function upsertMessageEmbedding(
  input: UpsertMessageEmbeddingInput
): Promise<void> {
  const vectorLiteral = `[${input.embedding.join(",")}]`;
  const existing = await prisma.messageEmbedding.findUnique({
    where: {
      messageId_provider_model_dimensions: {
        messageId: input.messageId,
        provider: input.provider,
        model: input.model,
        dimensions: input.dimensions,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.$executeRaw`
      UPDATE "message_embeddings"
      SET "embedding" = ${vectorLiteral}::vector,
          "contentHash" = ${input.contentHash},
          "updatedAt" = NOW()
      WHERE "id" = ${existing.id}
    `;
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "message_embeddings"
      ("id", "messageId", "conversationId", "provider", "model", "dimensions", "contentHash", "embedding", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${input.messageId}, ${input.conversationId}, ${input.provider}, ${input.model}, ${input.dimensions}, ${input.contentHash}, ${vectorLiteral}::vector, NOW(), NOW())
  `;
}

export async function searchSimilarMessages(
  input: SearchSimilarMessagesInput
): Promise<SimilarMessageResult[]> {
  const vectorLiteral = `[${input.queryEmbedding.join(",")}]`;
  const rows = await prisma.$queryRaw<
    Array<{ message_id: string; conversation_id: string; score: number }>
  >`
    SELECT
      me."messageId" AS message_id,
      me."conversationId" AS conversation_id,
      1 - (me."embedding" <=> ${vectorLiteral}::vector) AS score
    FROM "message_embeddings" me
    JOIN "chat_messages" m ON m."id" = me."messageId"
    JOIN "chat_conversations" c ON c."id" = m."conversationId"
    WHERE
      me."provider" = ${input.provider}
      AND me."model" = ${input.model}
      AND me."dimensions" = ${input.dimensions}
      AND c."userId" = ${input.userId}
      AND m."isIntermediate" = false
      AND m."role" IN ('user', 'assistant')
      AND LENGTH(BTRIM(m."content")) > 0
    ORDER BY me."embedding" <=> ${vectorLiteral}::vector
    LIMIT ${input.topK}
  `;

  return rows.map((row) => ({
    messageId: row.message_id,
    conversationId: row.conversation_id,
    score: Number(row.score),
  }));
}
