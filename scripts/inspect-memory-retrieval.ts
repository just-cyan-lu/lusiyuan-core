#!/usr/bin/env tsx
import "dotenv/config";
import { prisma } from "../src/db/prisma.js";
import { retrieveMemories } from "../src/core/memory-retrieval.service.js";
import { runtimeSettingsService } from "../src/config/runtime-settings.service.js";
import { relationshipStateService } from "../src/runtime/relationship-state.service.js";

async function main() {
  await runtimeSettingsService.initialize();
  const query = process.argv[2];
  if (!query) {
    console.error("Usage: pnpm embeddings:inspect <query> <personId|userExternalId>");
    process.exit(1);
  }

  const ownerId = process.argv[3] ?? "";

  if (!ownerId) {
    const people = await prisma.personIdentity.findMany({
      select: {
        id: true,
        label: true,
        identityLinks: {
          select: {
            user: { select: { externalId: true, displayName: true } },
          },
          take: 3,
        },
      },
      take: 10,
    });
    console.log("No personId provided. Available identities:");
    for (const person of people) {
      const users = person.identityLinks
        .map((link) => link.user.displayName ?? link.user.externalId)
        .join(", ");
      console.log(`  ${person.id}  ${person.label ?? ""}  ${users}`);
    }
    console.log('\nUsage: pnpm embeddings:inspect "<query>" <personId|userExternalId>');
    await prisma.$disconnect();
    return;
  }

  const person = await prisma.personIdentity.findFirst({
    where: {
      OR: [
        { id: ownerId },
        { label: ownerId },
        { identityLinks: { some: { user: { externalId: ownerId } } } },
      ],
    },
    select: { id: true, label: true },
  });
  const user = person
    ? null
    : await prisma.user.findFirst({
        where: { OR: [{ id: ownerId }, { externalId: ownerId }] },
        select: { id: true },
      });
  const personId = person?.id ?? (user ? (await relationshipStateService.getOrCreate(user.id)).personId : null);
  if (!personId) {
    throw new Error(`Identity not found: ${ownerId}`);
  }

  console.log(`\nQuery: ${query}`);
  console.log(`PersonId: ${personId}\n`);

  const results = await retrieveMemories({ personId, query });

  if (results.length === 0) {
    console.log("No memories retrieved.");
  } else {
    console.log(`Top ${results.length} memories:\n`);
    results.forEach((item, i) => {
      const m = item.memory;
      console.log(
        `${i + 1}. score=${item.finalScore.toFixed(3)} type=${m.type} scope=${(m as { scope?: string }).scope ?? "person"}`
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
