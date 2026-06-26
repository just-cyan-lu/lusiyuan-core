import { prisma } from "../src/db/prisma.js";

async function main() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS memory_embeddings_hnsw_idx
    ON "memory_embeddings"
    USING hnsw ("embedding" vector_cosine_ops)
    WHERE "embedding" IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS message_embeddings_hnsw_idx
    ON "message_embeddings"
    USING hnsw ("embedding" vector_cosine_ops)
    WHERE "embedding" IS NOT NULL
  `);
  console.log("[db] pgvector indexes are ready");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
