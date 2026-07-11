import { toolRegistry } from "../tool-registry.js";
import { searchMemoriesTool } from "./search-memories.tool.js";
import { webSearchTool } from "./web-search.tool.js";
import { readPageTool } from "./read-page.tool.js";
import { queryHomeStateTool } from "./query-home-state.tool.js";
import { controlHomeTool } from "./control-home.tool.js";

export function registerBuiltinTools(): void {
  console.log("[tools] registering builtin tools...");
  toolRegistry.register(searchMemoriesTool);
  toolRegistry.register(webSearchTool);
  toolRegistry.register(readPageTool);
  toolRegistry.register(queryHomeStateTool);
  toolRegistry.register(controlHomeTool);
  console.log(`[tools] registered ${toolRegistry.listAll().length} tools, ${toolRegistry.listEnabled().length} enabled`);
}
