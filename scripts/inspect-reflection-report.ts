import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

const args = process.argv.slice(2);
const reportId = args.find((a) => a.startsWith("--report="))?.split("=")[1];

async function main() {
  if (!reportId) {
    const reports = await prisma.reflectionReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, summary: true, confidence: true, createdAt: true },
    });
    console.log("\nRecent reports:");
    for (const r of reports) {
      console.log(`  ${r.id}  [${r.confidence.toFixed(2)}]  ${r.createdAt.toISOString().slice(0, 10)}  ${r.summary.slice(0, 60)}`);
    }
    return;
  }

  const report = await prisma.reflectionReport.findUnique({ where: { id: reportId } });
  if (!report) { console.error("Report not found:", reportId); process.exit(1); }

  const [proposals, risks, growthLogs] = await Promise.all([
    prisma.memoryProposal.findMany({ where: { reportId } }),
    prisma.reflectionRiskFlag.findMany({ where: { reportId } }),
    prisma.growthLogProposal.findMany({ where: { reportId } }),
  ]);

  console.log(`\n=== Reflection Report ${report.id} ===`);
  console.log(`Summary: ${report.summary}`);
  console.log(`Confidence: ${report.confidence}`);
  console.log(`Created: ${report.createdAt.toISOString()}`);

  if (proposals.length > 0) {
    console.log(`\n--- Memory Proposals (${proposals.length}) ---`);
    for (const p of proposals) {
      console.log(`  [${p.status}] ${p.proposalType} | ${p.type} | conf:${p.confidence.toFixed(2)} | risk:${p.riskLevel}`);
      console.log(`    ${p.content.slice(0, 100)}`);
    }
  }

  if (risks.length > 0) {
    console.log(`\n--- Risk Flags (${risks.length}) ---`);
    for (const r of risks) {
      console.log(`  [${r.severity}] ${r.type}: ${r.description.slice(0, 100)}`);
    }
  }

  if (growthLogs.length > 0) {
    console.log(`\n--- Growth Log Proposals (${growthLogs.length}) ---`);
    for (const g of growthLogs) {
      console.log(`  [${g.status}] ${g.title}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
