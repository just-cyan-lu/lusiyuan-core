import "../src/init.js";
import { runtimeSettingsService } from "../src/config/runtime-settings.service.js";
import { toolRegistry } from "../src/tools/tool-registry.js";

async function main() {
  await runtimeSettingsService.initialize();
  const tools = toolRegistry.listAll();
  console.log(`\nRegistered tools (${tools.length}):\n`);
  for (const tool of tools) {
    const flags = [
      tool.enabled ? "enabled" : "disabled",
      tool.riskLevel,
      tool.ownerOnly ? "owner-only" : null,
    ].filter(Boolean).join(" | ");
    console.log(`  ${tool.name.padEnd(36)} [${flags}]`);
    console.log(`    ${tool.description}`);
    console.log();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
