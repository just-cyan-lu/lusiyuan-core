import "dotenv/config";
import { reflectionService } from "../src/reflection/reflection.service.js";
import { runtimeSettingsService } from "../src/config/runtime-settings.service.js";

const args = process.argv.slice(2);
const conversationId = args.find((a) => a.startsWith("--conversation="))?.split("=")[1];
const scope = args.find((a) => a.startsWith("--scope="))?.split("=")[1] ?? "conversation";
const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "80", 10);
const daily = args.includes("--daily");

async function main() {
  await runtimeSettingsService.initialize();
  console.log("Running reflection...");
  const report = await reflectionService.runManualReflection({
    scope: (daily ? "daily" : scope) as never,
    triggerType: "manual",
    conversationId,
    messageLimit: limit,
  });

  console.log(`\nReport ID: ${report.id}`);
  console.log(`Summary: ${report.summary}`);
  console.log(`Confidence: ${report.confidence}`);
  console.log(`\nRun 'pnpm reflection:inspect --report=${report.id}' to see full details.`);
}

main().catch((err) => {
  console.error("Reflection failed:", err);
  process.exit(1);
});
