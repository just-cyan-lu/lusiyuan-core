import type { ToolAccessMode } from "./tool-access.js";

export type ToolRiskLevel = "low" | "medium" | "high";

export interface ToolExecutionContext {
  userId: string;
  channel: string;
  conversationId?: string;
  messageId?: string;
  isOwner: boolean;
  requestId?: string;
  signal?: AbortSignal;
}

export interface ToolParametersSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  /** JSON Schema for the tool's input parameters, passed directly to the LLM. */
  parameters?: ToolParametersSchema;
  riskLevel: ToolRiskLevel;
  ownerOnly?: boolean;
  accessMode?: ToolAccessMode;
  enabled: boolean;
  runtimeAccess?: () => {
    enabled: boolean;
    ownerOnly: boolean;
    accessMode: ToolAccessMode;
  };
  handler: ToolHandler<TInput, TOutput>;
}

export type ToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolExecutionContext
) => Promise<TOutput>;

export interface ToolExecutionResult<TOutput = unknown> {
  toolName: string;
  ok: boolean;
  output?: TOutput;
  error?: string;
  blocked?: boolean;
  blockReason?: string;
  durationMs: number;
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}
