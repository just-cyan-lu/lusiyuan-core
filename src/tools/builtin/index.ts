import { toolRegistry } from "../tool-registry.js";
import { searchMemoriesTool } from "./search-memories.tool.js";
import { webSearchTool } from "./web-search.tool.js";
import { readPageTool } from "./read-page.tool.js";

export function registerBuiltinTools(): void {
  console.log("[tools] registering builtin tools...");
  toolRegistry.register(searchMemoriesTool);
  toolRegistry.register(webSearchTool);
  toolRegistry.register(readPageTool);
  console.log(`[tools] registered ${toolRegistry.listAll().length} tools, ${toolRegistry.listEnabled().length} enabled`);
}
