import { prisma } from "../src/db/prisma.js";
import {
  generateAndStoreMessageEmbedding,
  shouldIndexMessageForRecall,
} from "../src/core/message-embedding.service.js";

function parseLimit(): number {
  const raw = Number.parseInt(process.argv[2] ?? "300", 10);
  if (!Number.isFinite(raw)) return 300;
  return Math.min(Math.max(raw, 1), 2000);
}

async function main() {
  const limit = parseLimit();
  const messages = await prisma.message.findMany({
    where: {
      isIntermediate: false,
      role: { in: ["user", "assistant"] },
      content: { not: "" },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  let indexed = 0;
  let skipped = 0;
  let failed = 0;
  for (const message of messages) {
    if (!shouldIndexMessageForRecall(message)) {
      skipped++;
      continue;
    }

    try {
      await generateAndStoreMessageEmbedding(message);
      indexed++;
    } catch (err) {
      failed++;
      const messageText = err instanceof Error ? err.message : String(err);
      console.warn(`[context:index] failed ${message.id}: ${messageText}`);
    }
  }

  console.log(
    `[context:index] scanned=${messages.length} indexed=${indexed} skipped=${skipped} failed=${failed}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
