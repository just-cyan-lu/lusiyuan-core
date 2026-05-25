import { toolRegistry } from "../tool-registry.js";
import { getCurrentProjectStatusTool } from "./get-current-project-status.tool.js";
import { searchMemoriesTool } from "./search-memories.tool.js";
import { createDraftTool } from "./create-draft.tool.js";
import { listRecentDecisionsTool } from "./list-recent-decisions.tool.js";
import { summarizeRecentConversationTool } from "./summarize-recent-conversation.tool.js";

export function registerBuiltinTools(): void {
  toolRegistry.register(getCurrentProjectStatusTool);
  toolRegistry.register(searchMemoriesTool);
  toolRegistry.register(createDraftTool);
  toolRegistry.register(listRecentDecisionsTool);
  toolRegistry.register(summarizeRecentConversationTool);
}
