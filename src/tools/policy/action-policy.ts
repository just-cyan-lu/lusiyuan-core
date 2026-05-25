import { env } from "../../utils/env.js";
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

    if (tool.riskLevel === "high") {
      return {
        allowed: false,
        requiresApproval: true,
        reason: "High risk tools are disabled in v0.5",
      };
    }

    if (tool.riskLevel === "medium" && !env.TOOLS_ALLOW_MEDIUM_RISK) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: "Medium risk tools are disabled",
      };
    }

    if (!env.TOOLS_ENABLED) {
      return { allowed: false, requiresApproval: false, reason: "Tool layer is disabled" };
    }

    return { allowed: true, requiresApproval: false };
  }
}

export const actionPolicy = new ActionPolicy();
