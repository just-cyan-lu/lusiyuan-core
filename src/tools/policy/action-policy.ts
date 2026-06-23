import { runtimeConfig } from "../../config/runtime-settings.service.js";
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

    if (!runtimeConfig.TOOLS_ENABLED) {
      return { allowed: false, requiresApproval: false, reason: "Tool layer is disabled" };
    }

    if (tool.riskLevel === "high" && !runtimeConfig.TOOLS_ALLOW_HIGH_RISK) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: "High risk tools are disabled",
      };
    }

    if (tool.riskLevel === "medium" && !runtimeConfig.TOOLS_ALLOW_MEDIUM_RISK) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: "Medium risk tools are disabled",
      };
    }

    if (tool.riskLevel === "low" && !runtimeConfig.TOOLS_AUTO_EXECUTE_LOW_RISK) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: "Low risk auto execution is disabled",
      };
    }

    return { allowed: true, requiresApproval: false };
  }
}

export const actionPolicy = new ActionPolicy();
