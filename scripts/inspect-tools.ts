import { registerBuiltinTools } from "../tools/builtin/index.js";
import { toolRegistry } from "../tools/tool-registry.js";

registerBuiltinTools();

const tools = toolRegistry.listAll();
console.log(`\nRegistered tools (${tools.length}):\n`);
for (const t of tools) {
  const flags = [
    t.enabled ? "enabled" : "disabled",
    t.riskLevel,
    t.ownerOnly ? "owner-only" : null,
  ]
    .filter(Boolean)
    .join(" | ");
  console.log(`  ${t.name.padEnd(36)} [${flags}]`);
  console.log(`    ${t.description}`);
  console.log();
}
