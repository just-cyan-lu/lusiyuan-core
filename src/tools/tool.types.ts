export type ToolRiskLevel = "low" | "medium" | "high";

export interface ToolExecutionContext {
  userId: string;
  channel: string;
  conversationId?: string;
  messageId?: string;
  isOwner: boolean;
  requestId?: string;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  ownerOnly?: boolean;
  enabled: boolean;
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
