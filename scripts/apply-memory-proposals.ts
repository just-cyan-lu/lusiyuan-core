import "dotenv/config";
import { reflectionProposalService } from "../src/reflection/reflection-proposal.service.js";
import { prisma } from "../src/db/prisma.js";

const args = process.argv.slice(2);
const proposalId = args.find((a) => a.startsWith("--proposal="))?.split("=")[1];
const applyAll = args.includes("--approved");
const reviewerId = args.find((a) => a.startsWith("--reviewer="))?.split("=")[1] ?? "script";

async function main() {
  if (applyAll) {
    const approved = await prisma.memoryProposal.findMany({
      where: { status: "approved" },
    });
    if (approved.length === 0) {
      console.log("No approved proposals to apply.");
      return;
    }
    console.log(`Applying ${approved.length} approved proposals...`);
    for (const p of approved) {
      try {
        await reflectionProposalService.applyProposal(p.id, reviewerId);
        console.log(`  ✓ Applied: ${p.id} (${p.proposalType})`);
      } catch (err) {
        console.error(`  ✗ Failed: ${p.id} —`, err instanceof Error ? err.message : err);
      }
    }
    return;
  }

  if (!proposalId) {
    const pending = await prisma.memoryProposal.findMany({
      where: { status: "pending" },
      orderBy: [{ confidence: "desc" }],
      take: 20,
    });
    console.log(`\nPending proposals (${pending.length}):`);
    for (const p of pending) {
      console.log(`  ${p.id}  [${p.proposalType}]  conf:${p.confidence.toFixed(2)}  ${p.content.slice(0, 80)}`);
    }
    console.log("\nUsage:");
    console.log("  pnpm reflection:apply --proposal=<id>   apply one proposal");
    console.log("  pnpm reflection:apply --approved        apply all approved proposals");
    return;
  }

  await reflectionProposalService.applyProposal(proposalId, reviewerId);
  console.log(`Applied proposal: ${proposalId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
