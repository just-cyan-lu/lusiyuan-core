#!/usr/bin/env tsx
// scripts/run-dream.ts — manually trigger a Dream Cycle

import "dotenv/config";
import { dreamService } from "../src/dream/dream.service.js";

const args = process.argv.slice(2);
const daily = args.includes("--daily");
const fromArg = args.find((a) => a.startsWith("--from="))?.split("=")[1];
const toArg = args.find((a) => a.startsWith("--to="))?.split("=")[1];
const hoursArg = args.find((a) => a.startsWith("--hours="))?.split("=")[1];

async function main() {
  console.log("Starting Dream Cycle...");

  const lookbackHours = hoursArg ? parseInt(hoursArg, 10) : undefined;

  const result = await dreamService.runDailyDream({
    triggerType: "manual",
    lookbackHours,
  });

  console.log("\n✓ Dream Cycle completed");
  console.log(`  Job ID:        ${result.jobId}`);
  console.log(`  Status:        ${result.status}`);
  console.log(`  Daily Note:    ${result.dailyNoteId ?? "—"}`);
  console.log(`  Diary Entry:   ${result.diaryEntryId ?? "—"}`);
  console.log(`  Signals:       ${result.signalCount}`);
  console.log(`  Proposals:     ${result.proposalCount}`);
  console.log(`  Risk Flags:    ${result.riskCount}`);
}

main().catch((err) => {
  console.error("Dream Cycle failed:", err);
  process.exit(1);
});
