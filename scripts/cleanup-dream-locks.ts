#!/usr/bin/env tsx
// scripts/cleanup-dream-locks.ts — remove expired DreamLocks

import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

async function main() {
  const result = await prisma.dreamLock.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  console.log(`Cleaned up ${result.count} expired dream lock(s).`);

  const remaining = await prisma.dreamLock.findMany();
  if (remaining.length > 0) {
    console.log("\nActive locks:");
    for (const lock of remaining) {
      console.log(`  ${lock.lockKey} — expires ${lock.expiresAt.toISOString()}`);
    }
  } else {
    console.log("No active locks.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
