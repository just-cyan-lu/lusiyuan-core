import { prisma } from "../../db/prisma.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface GetCurrentProjectStatusInput {
  includeRecentDecisions?: boolean;
}

interface GetCurrentProjectStatusOutput {
  currentVersion: string;
  completed: string[];
  inProgress: string[];
  nextCandidates: string[];
  recentDecisions: string[];
  summary: string;
}

const FIXED_VERSIONS = {
  completed: [
    "v0.1 Core API — Fastify + Prisma + OpenAI-compatible 模型接入",
    "v0.2 Telegram + 微信渠道接入",
    "v0.3 Web Chat — React + Vite 网页入口",
    "v0.4 pgvector 语义记忆检索 — SiliconFlow Qwen3-Embedding-4B",
    "v0.5 Tool & Action Layer — 安全内部工具调用",
    "v0.7 Reflection Agent — 记忆提案与人格稳定性复盘",
  ],
  inProgress: [] as string[],
  nextCandidates: [
    "v0.8 MCP 工具接入 — 文件系统、GitHub、Notion",
    "v0.9 OpenClaw Action Gateway — 高风险外部动作层",
  ],
};

async function handler(
  input: GetCurrentProjectStatusInput,
  context: ToolExecutionContext
): Promise<GetCurrentProjectStatusOutput> {
  const recentDecisions: string[] = [];

  if (input.includeRecentDecisions !== false) {
    const decisions = await prisma.memory.findMany({
      where: {
        userId: context.userId,
        type: { in: ["technical_decision", "project_context"] },
        status: "active",
      },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { content: true, summary: true },
    });
    for (const d of decisions) {
      recentDecisions.push(d.summary ?? d.content);
    }
  }

  return {
    currentVersion: "v0.7",
    completed: FIXED_VERSIONS.completed,
    inProgress: FIXED_VERSIONS.inProgress,
    nextCandidates: FIXED_VERSIONS.nextCandidates,
    recentDecisions,
    summary:
      "陆思源目前已完成核心 API、多渠道入口、网页聊天、语义记忆检索、工具调用层和 Reflection Agent，下一步计划接入 MCP 工具。",
  };
}

export const getCurrentProjectStatusTool: ToolDefinition<
  GetCurrentProjectStatusInput,
  GetCurrentProjectStatusOutput
> = {
  name: "get_current_project_status",
  description: "获取陆思源项目当前进展，包括已完成版本、进行中和下一步候选",
  riskLevel: "low",
  enabled: true,
  handler,
};
