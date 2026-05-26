#!/usr/bin/env tsx
// scripts/inspect-dream-diary.ts — view dream diary entries

import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

const args = process.argv.slice(2);
const latest = args.includes("--latest");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? parseInt(limitArg, 10) : 5;

async function main() {
  const entries = await prisma.dreamDiaryEntry.findMany({
    where: { status: "active" },
    orderBy: { date: "desc" },
    take: limit,
  });

  if (entries.length === 0) {
    console.log("No dream diary entries found.");
    return;
  }

  for (const entry of entries) {
    console.log("─".repeat(60));
    console.log(`Date:       ${entry.date.toLocaleDateString("zh-CN")}`);
    if (entry.title) console.log(`Title:      ${entry.title}`);
    console.log(`Visibility: ${entry.visibility}`);
    console.log(`Grounded:   ${entry.grounded}`);
    console.log("");
    console.log(entry.content);
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
