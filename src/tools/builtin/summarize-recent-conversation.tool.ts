import { prisma } from "../../db/prisma.js";
import { modelProvider } from "../../core/model-provider.js";
import { env } from "../../utils/env.js";
import { toolAccessState } from "../tool-access.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface SummarizeRecentConversationInput {
  conversationId?: string;
  limit?: number;
  focus?: string;
}

interface SummarizeRecentConversationOutput {
  summary: string;
  keyPoints: string[];
  possibleMemories: string[];
  decisions: string[];
  openQuestions: string[];
}

async function handler(
  input: SummarizeRecentConversationInput,
  context: ToolExecutionContext
): Promise<SummarizeRecentConversationOutput> {
  const conversationId = input.conversationId ?? context.conversationId;
  const limit = input.limit ?? 20;

  const where = conversationId
    ? { conversationId }
    : { userId: context.userId };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { role: true, content: true, createdAt: true },
  });

  if (messages.length === 0) {
    return {
      summary: "No messages found.",
      keyPoints: [],
      possibleMemories: [],
      decisions: [],
      openQuestions: [],
    };
  }

  const transcript = messages
    .reverse()
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n");

  const focusInstruction = input.focus
    ? `特别关注与"${input.focus}"相关的内容。`
    : "";

  const result = await modelProvider.chatJson<SummarizeRecentConversationOutput>([
    {
      role: "system",
      content: `你是一个对话分析助手，负责提炼对话要点。${focusInstruction}
请返回 JSON，格式：
{
  "summary": "2-3句话的整体概述",
  "keyPoints": ["关键点1", "关键点2"],
  "possibleMemories": ["值得长期记住的事实1", "值得长期记住的事实2"],
  "decisions": ["明确做出的决定1"],
  "openQuestions": ["未解决的问题1"]
}`,
    },
    {
      role: "user",
      content: `请分析以下对话：\n\n${transcript.slice(0, 6000)}`,
    },
  ]);

  return {
    summary: result.summary ?? "",
    keyPoints: result.keyPoints ?? [],
    possibleMemories: result.possibleMemories ?? [],
    decisions: result.decisions ?? [],
    openQuestions: result.openQuestions ?? [],
  };
}

export const summarizeRecentConversationTool: ToolDefinition<
  SummarizeRecentConversationInput,
  SummarizeRecentConversationOutput
> = {
  name: "summarize_recent_conversation",
  description: "总结最近的对话内容，提炼关键点、可能的记忆和未解决问题",
  riskLevel: "low",
  ...toolAccessState(env.TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE),
  handler,
};
