import { toolRegistry } from "../tool-registry.js";
import { getCurrentProjectStatusTool } from "./get-current-project-status.tool.js";
import { searchMemoriesTool } from "./search-memories.tool.js";
import { createDraftTool } from "./create-draft.tool.js";
import { listRecentDecisionsTool } from "./list-recent-decisions.tool.js";
import { summarizeRecentConversationTool } from "./summarize-recent-conversation.tool.js";
import { webSearchTool } from "./web-search.tool.js";
import { readPageTool } from "./read-page.tool.js";
import {
  syncExternalInboxTool,
  listExternalInboxTool,
} from "./external-inbox.tool.js";

export function registerBuiltinTools(): void {
  console.log("[tools] registering builtin tools...");
  toolRegistry.register(getCurrentProjectStatusTool);
  toolRegistry.register(searchMemoriesTool);
  toolRegistry.register(createDraftTool);
  toolRegistry.register(listRecentDecisionsTool);
  toolRegistry.register(summarizeRecentConversationTool);
  toolRegistry.register(webSearchTool);
  toolRegistry.register(readPageTool);
  toolRegistry.register(syncExternalInboxTool);
  toolRegistry.register(listExternalInboxTool);
  console.log(`[tools] registered ${toolRegistry.listAll().length} tools, ${toolRegistry.listEnabled().length} enabled`);
}
