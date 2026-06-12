import { toolRegistry } from "../tool-registry.js";
import { searchMemoriesTool } from "./search-memories.tool.js";
import { summarizeRecentConversationTool } from "./summarize-recent-conversation.tool.js";
import { webSearchTool } from "./web-search.tool.js";
import { readPageTool } from "./read-page.tool.js";
import { sendIntermediateMessageTool } from "./send-intermediate-message.js";

export function registerBuiltinTools(): void {
  console.log("[tools] registering builtin tools...");
  toolRegistry.register(searchMemoriesTool);
  toolRegistry.register(summarizeRecentConversationTool);
  toolRegistry.register(webSearchTool);
  toolRegistry.register(readPageTool);
  toolRegistry.register(sendIntermediateMessageTool);
  console.log(`[tools] registered ${toolRegistry.listAll().length} tools, ${toolRegistry.listEnabled().length} enabled`);
}
