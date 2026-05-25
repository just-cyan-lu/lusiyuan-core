#!/usr/bin/env tsx
import "dotenv/config";
import { prisma } from "../src/db/prisma.js";
import { embeddingProvider } from "../src/embeddings/siliconflow-embedding-provider.js";
import { pgVectorMemoryIndex } from "../src/vector-index/pgvector-memory-index.js";
import { buildMemoryEmbeddingText } from "../src/embeddings/embedding-text.js";
import { createMemoryContentHash } from "../src/embeddings/content-hash.js";

async function main() {
  const memories = await prisma.memory.findMany({
    where: { status: "active" },
  });

  console.log(`Found ${memories.length} active memories to process.`);

  let skipped = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const memory of memories) {
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

    if (existing?.contentHash === contentHash) {
      skipped++;
      process.stdout.write(".");
      continue;
    }

    try {
      const embedding = await embeddingProvider.embedText(text);
      await pgVectorMemoryIndex.upsertMemoryEmbedding({
        memoryId: memory.id,
        embedding,
        provider: embeddingProvider.providerName,
        model: embeddingProvider.model,
        dimensions: embeddingProvider.dimensions,
        contentHash,
      });
      if (existing) {
        updated++;
      } else {
        created++;
      }
      process.stdout.write("+");
    } catch (err) {
      failed++;
      process.stdout.write("!");
      console.error(`\nFailed for memory ${memory.id}:`, err);
    }
  }

  console.log(
    `\n\nDone. created=${created} updated=${updated} skipped=${skipped} failed=${failed}`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
