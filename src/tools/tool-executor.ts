import { prisma } from "../db/prisma.js";
import { env } from "../utils/env.js";
import { toolRegistry } from "./tool-registry.js";
import { actionPolicy } from "./policy/action-policy.js";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from "./tool.types.js";

interface ExecuteInput {
  toolName: string;
  input: unknown;
  context: ToolExecutionContext;
}

export class ToolExecutor {
  async execute(req: ExecuteInput): Promise<ToolExecutionResult> {
    const { toolName, input, context } = req;
    const start = Date.now();

    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return {
        toolName,
        ok: false,
        error: `Unknown tool: ${toolName}`,
        blocked: false,
        durationMs: Date.now() - start,
      };
    }

    const decision = actionPolicy.canExecute(tool, context);
    if (!decision.allowed) {
      await this.log({
        toolName,
        riskLevel: tool.riskLevel,
        status: "blocked",
        context,
        input,
        blocked: true,
        blockReason: decision.reason,
        durationMs: Date.now() - start,
      });
      return {
        toolName,
        ok: false,
        blocked: true,
        blockReason: decision.reason,
        durationMs: Date.now() - start,
      };
    }

    let output: unknown;
    let error: string | undefined;
    let status = "success";

    try {
      const timeoutMs = env.TOOL_TIMEOUT_MS;
      output = await Promise.race([
        tool.handler(input, context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Tool timeout")), timeoutMs)
        ),
      ]);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      status = "failed";
    }

    const durationMs = Date.now() - start;

    await this.log({
      toolName,
      riskLevel: tool.riskLevel,
      status,
      context,
      input: env.TOOL_LOG_INPUT_OUTPUT ? input : null,
      output: env.TOOL_LOG_INPUT_OUTPUT ? output : null,
      error,
      blocked: false,
      durationMs,
    });

    if (error) {
      return { toolName, ok: false, error, durationMs };
    }
    return { toolName, ok: true, output, durationMs };
  }

  private async log(params: {
    toolName: string;
    riskLevel: string;
    status: string;
    context: ToolExecutionContext;
    input?: unknown;
    output?: unknown;
    error?: string;
    blocked: boolean;
    blockReason?: string;
    durationMs: number;
  }): Promise<void> {
    prisma.toolCallLog
      .create({
        data: {
          toolName: params.toolName,
          riskLevel: params.riskLevel,
          status: params.status,
          userId: params.context.userId,
          conversationId: params.context.conversationId,
          messageId: params.context.messageId,
          channel: params.context.channel,
          input: params.input ? (params.input as object) : undefined,
          output: params.output ? (params.output as object) : undefined,
          error: params.error,
          blocked: params.blocked,
          blockReason: params.blockReason,
          durationMs: params.durationMs,
        },
      })
      .catch((err) => console.warn("ToolCallLog write failed:", err));
  }
}

export const toolExecutor = new ToolExecutor();
