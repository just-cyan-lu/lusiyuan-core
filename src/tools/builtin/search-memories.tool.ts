import { memoryService } from "../../core/memory.service.js";
import { runtimeConfig } from "../../config/runtime-settings.service.js";
import { toolAccessState } from "../tool-access.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface SearchMemoriesInput {
  query: string;
  limit?: number;
}

interface SearchMemoriesOutput {
  memories: Array<{
    id: string;
    scope: string;
    type: string;
    content: string;
    summary?: string | null;
    importance: number;
  }>;
}

async function handler(
  input: SearchMemoriesInput,
  context: ToolExecutionContext
): Promise<SearchMemoriesOutput> {
  const query = input.query.slice(0, 500);
  const budgeted = await memoryService.retrieveRelevantMemories(
    context.userId,
    query
  );

  return {
    memories: budgeted.slice(0, input.limit ?? 8).map((b) => ({
      id: b.memory.id,
      scope: (b.memory as { scope?: string }).scope ?? "user",
      type: b.memory.type,
      content: b.memory.content,
      summary: (b.memory as { summary?: string | null }).summary,
      importance: b.memory.importance,
    })),
  };
}

export const searchMemoriesTool: ToolDefinition<
  SearchMemoriesInput,
  SearchMemoriesOutput
> = {
  name: "search_memories",
  description: "根据 query 语义搜索陆思源长期记忆",
  riskLevel: "low",
  enabled: true,
  runtimeAccess: () => toolAccessState(runtimeConfig.TOOL_SEARCH_MEMORIES_MODE),
  handler,
};
