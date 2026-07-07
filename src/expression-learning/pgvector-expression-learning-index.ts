import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

interface UpsertInput {
  exampleId: string;
  embedding: number[];
  provider: string;
  model: string;
  dimensions: number;
  contentHash: string;
}

interface SearchInput {
  embedding: number[];
  provider: string;
  model: string;
  dimensions: number;
  scenes: string[];
  limit: number;
}

export async function upsertExpressionLearningEmbedding(input: UpsertInput): Promise<void> {
  const vectorLiteral = `[${input.embedding.join(",")}]`;
  const existing = await prisma.expressionLearningEmbedding.findUnique({
    where: {
      exampleId_provider_model_dimensions: {
        exampleId: input.exampleId,
        provider: input.provider,
        model: input.model,
        dimensions: input.dimensions,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.$executeRaw`
      UPDATE "expression_learning_embeddings"
      SET "embedding" = ${vectorLiteral}::vector,
          "contentHash" = ${input.contentHash},
          "updatedAt" = NOW()
      WHERE "id" = ${existing.id}
    `;
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "expression_learning_embeddings"
      ("id", "exampleId", "provider", "model", "dimensions", "contentHash", "embedding", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${input.exampleId}, ${input.provider}, ${input.model}, ${input.dimensions}, ${input.contentHash}, ${vectorLiteral}::vector, NOW(), NOW())
  `;
}

export async function searchExpressionLearningEmbeddings(input: SearchInput) {
  const vectorLiteral = `[${input.embedding.join(",")}]`;
  const scenes = input.scenes.length > 0 ? input.scenes : ["general"];
  const sceneList = Prisma.join(scenes);
  const rows = await prisma.$queryRaw<Array<{ example_id: string; score: number }>>`
    SELECT
      ele."exampleId" AS example_id,
      1 - (ele."embedding" <=> ${vectorLiteral}::vector) AS score
    FROM "expression_learning_embeddings" ele
    JOIN "expression_learning_examples" e ON e."id" = ele."exampleId"
    WHERE
      ele."provider" = ${input.provider}
      AND ele."model" = ${input.model}
      AND ele."dimensions" = ${input.dimensions}
      AND e."status" = 'active'
      AND e."scene" IN (${sceneList})
    ORDER BY ele."embedding" <=> ${vectorLiteral}::vector
    LIMIT ${input.limit}
  `;

  return rows.map((row) => ({ exampleId: row.example_id, score: Number(row.score) }));
}
