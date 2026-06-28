import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
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

    console.log(`[tool-executor] execute called: ${toolName}`);

    const tool = toolRegistry.get(toolName);
    if (!tool) {
      console.log(`[tool-executor] tool not found: ${toolName}`);
      return {
        toolName,
        ok: false,
        error: `Unknown tool: ${toolName}`,
        blocked: false,
        durationMs: Date.now() - start,
      };
    }

    console.log(`[tool-executor] tool found: ${toolName}, enabled: ${tool.enabled}`);

    const decision = actionPolicy.canExecute(tool, context);
    console.log(`[tool-executor] policy decision: ${JSON.stringify(decision)}`);
    if (!decision.allowed) {
      console.log(`[tool-executor] tool blocked: ${toolName}, reason: ${decision.reason}`);
      await this.log({
        toolName,
        riskLevel: tool.riskLevel,
        status: "blocked",
        context,
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

    console.log(`[tool] executing ${toolName}`, JSON.stringify(input).slice(0, 200));

    try {
      output = await tool.handler(input, context);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      status = "failed";
    }

    const durationMs = Date.now() - start;

    console.log(`[tool] ${toolName} ${status} (${durationMs}ms)`, error ? `error: ${error}` : '');

    await this.log({
      toolName,
      riskLevel: tool.riskLevel,
      status,
      context,
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
    error?: string;
    blocked: boolean;
    blockReason?: string;
    durationMs: number;
  }): Promise<void> {
    if (!runtimeConfig.TOOL_CALL_LOG_ENABLED) return;

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
