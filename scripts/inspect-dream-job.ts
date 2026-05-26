#!/usr/bin/env tsx
// scripts/inspect-dream-job.ts — inspect a DreamJob and its results

import "dotenv/config";
import { prisma } from "../src/db/prisma.js";
import { morningBriefService } from "../src/dream/morning-brief.service.js";

const args = process.argv.slice(2);
const jobArg = args.find((a) => a.startsWith("--job="))?.split("=")[1];
const latest = args.includes("--latest");

async function main() {
  let jobId = jobArg;

  if (!jobId || latest) {
    const job = await prisma.dreamJob.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!job) {
      console.log("No DreamJobs found.");
      return;
    }
    jobId = job.id;
    console.log(`Using latest job: ${jobId}\n`);
  }

  const job = await prisma.dreamJob.findUnique({
    where: { id: jobId },
    include: {
      dailyNotes: true,
      signals: { orderBy: { confidence: "desc" } },
      diaryEntries: true,
      reports: true,
    },
  });

  if (!job) {
    console.log(`Job not found: ${jobId}`);
    return;
  }

  console.log("=== DreamJob ===");
  console.log(`ID:          ${job.id}`);
  console.log(`Status:      ${job.status}`);
  console.log(`Phase:       ${job.phase ?? "—"}`);
  console.log(`Trigger:     ${job.triggerType}`);
  console.log(`Scope:       ${job.scope}`);
  console.log(`From:        ${job.fromTime?.toISOString() ?? "—"}`);
  console.log(`To:          ${job.toTime?.toISOString() ?? "—"}`);
  console.log(`Started:     ${job.startedAt?.toISOString() ?? "—"}`);
  console.log(`Completed:   ${job.completedAt?.toISOString() ?? "—"}`);
  if (job.error) console.log(`Error:       ${job.error}`);

  if (job.dailyNotes.length > 0) {
    console.log("\n=== Daily Note ===");
    const note = job.dailyNotes[0];
    console.log(`Summary: ${note.summary}`);
    const kp = note.keyPoints as string[] | null;
    if (kp?.length) {
      console.log("Key Points:");
      kp.forEach((p) => console.log(`  - ${p}`));
    }
  }

  if (job.signals.length > 0) {
    console.log(`\n=== Dream Signals (${job.signals.length}) ===`);
    for (const s of job.signals.slice(0, 10)) {
      console.log(
        `[${s.signalType}] conf=${s.confidence.toFixed(2)} risk=${s.riskLevel}`
      );
      console.log(`  ${s.content.slice(0, 120)}`);
    }
  }

  if (job.diaryEntries.length > 0) {
    console.log("\n=== Dream Diary ===");
    const entry = job.diaryEntries[0];
    if (entry.title) console.log(`Title: ${entry.title}`);
    console.log(entry.content.slice(0, 500));
  }

  if (job.reports.length > 0) {
    console.log("\n=== Consolidation Report ===");
    const r = job.reports[0];
    console.log(`Summary:   ${r.summary}`);
    console.log(`Proposals: ${r.promotedCount}`);
    console.log(`Rejected:  ${r.rejectedCount}`);
    console.log(`Risks:     ${r.riskCount}`);
  }

  const brief = await morningBriefService.getMorningBrief(jobId);
  if (brief) {
    console.log("\n=== Morning Brief ===");
    console.log(brief.summary);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
