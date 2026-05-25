#!/usr/bin/env tsx
import "dotenv/config";
import { prisma } from "../src/db/prisma.js";
import { retrieveMemories } from "../src/core/memory-retrieval.service.js";

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error("Usage: pnpm embeddings:inspect <query>");
    process.exit(1);
  }

  const userId = process.argv[3] ?? "";

  if (!userId) {
    // List available users if no userId given
    const users = await prisma.user.findMany({
      select: { id: true, externalId: true, displayName: true },
      take: 10,
    });
    console.log("No userId provided. Available users:");
    for (const u of users) {
      console.log(`  ${u.id}  (${u.externalId}) ${u.displayName ?? ""}`);
    }
    console.log('\nUsage: pnpm embeddings:inspect "<query>" <userId>');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nQuery: ${query}`);
  console.log(`UserId: ${userId}\n`);

  const results = await retrieveMemories({ userId, query });

  if (results.length === 0) {
    console.log("No memories retrieved.");
  } else {
    console.log(`Top ${results.length} memories:\n`);
    results.forEach((item, i) => {
      const m = item.memory;
      console.log(
        `${i + 1}. score=${item.finalScore.toFixed(3)} type=${m.type} scope=${(m as { scope?: string }).scope ?? "user"}`
      );
      console.log(`   ${item.text}`);
      console.log();
    });
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
