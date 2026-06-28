import type {
  ToolDefinition,
  ToolExecutionContext,
  PolicyDecision,
} from "../tool.types.js";

export class ActionPolicy {
  canExecute(
    tool: ToolDefinition,
    context: ToolExecutionContext
  ): PolicyDecision {
    if (!tool.enabled) {
      return { allowed: false, requiresApproval: false, reason: "Tool is disabled" };
    }

    if (tool.ownerOnly && !context.isOwner) {
      return { allowed: false, requiresApproval: false, reason: "Owner only" };
    }

    return { allowed: true, requiresApproval: false };
  }
}

export const actionPolicy = new ActionPolicy();
