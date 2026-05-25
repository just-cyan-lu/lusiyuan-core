import { prisma } from "../../db/prisma.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface ListRecentDecisionsInput {
  limit?: number;
  topic?: string;
}

interface ListRecentDecisionsOutput {
  decisions: Array<{
    id: string;
    content: string;
    summary?: string | null;
    tags?: unknown;
    createdAt: string;
    importance: number;
  }>;
}

async function handler(
  input: ListRecentDecisionsInput,
  context: ToolExecutionContext
): Promise<ListRecentDecisionsOutput> {
  const where = {
    userId: context.userId,
    type: { in: ["technical_decision", "project_context"] },
    status: "active",
  };

  const memories = await prisma.memory.findMany({
    where,
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    take: input.limit ?? 10,
  });

  let results = memories;

  if (input.topic) {
    const topic = input.topic.toLowerCase();
    results = memories.filter(
      (m) =>
        m.content.toLowerCase().includes(topic) ||
        (m.summary && m.summary.toLowerCase().includes(topic))
    );
  }

  return {
    decisions: results.map((m) => ({
      id: m.id,
      content: m.content,
      summary: m.summary,
      tags: m.tags,
      createdAt: m.createdAt.toISOString(),
      importance: m.importance,
    })),
  };
}

export const listRecentDecisionsTool: ToolDefinition<
  ListRecentDecisionsInput,
  ListRecentDecisionsOutput
> = {
  name: "list_recent_decisions",
  description: "列出最近做过的技术决策和项目背景记忆",
  riskLevel: "low",
  enabled: true,
  handler,
};
