#!/usr/bin/env tsx
// scripts/run-dream.ts — manually trigger a Dream Cycle

import "dotenv/config";
import { dreamService } from "../src/dream/dream.service.js";
import { runtimeSettingsService } from "../src/config/runtime-settings.service.js";

const args = process.argv.slice(2);
const userId = args.find((a) => a.startsWith("--user-id="))?.split("=")[1];

async function main() {
  await runtimeSettingsService.initialize();
  console.log("Starting Dream Cycle...");

  const result = await dreamService.runDailyDream({
    triggerType: "manual",
    userId,
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
