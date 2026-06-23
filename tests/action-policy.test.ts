import test from "node:test";
import assert from "node:assert/strict";
import { actionPolicy } from "../src/tools/policy/action-policy.js";
import type { ToolDefinition, ToolExecutionContext } from "../src/tools/tool.types.js";
import { runtimeSettingsService } from "../src/config/runtime-settings.service.js";

const lowRiskTool: ToolDefinition<unknown, unknown> = {
  name: "low_risk_test_tool",
  description: "test tool",
  riskLevel: "low",
  enabled: true,
  handler: async () => ({}),
};

const context: ToolExecutionContext = {
  userId: "user_test",
  channel: "test",
  isOwner: true,
};

function withToolPolicy(
  patch: { TOOLS_ENABLED: boolean; TOOLS_AUTO_EXECUTE_LOW_RISK: boolean },
  fn: () => void
) {
  runtimeSettingsService.withTemporaryValues(patch, fn);
}

test("allows low risk tools when automatic low risk execution is enabled", () => {
  withToolPolicy({ TOOLS_ENABLED: true, TOOLS_AUTO_EXECUTE_LOW_RISK: true }, () => {
    const decision = actionPolicy.canExecute(lowRiskTool, context);
    assert.equal(decision.allowed, true);
    assert.equal(decision.requiresApproval, false);
  });
});

test("blocks low risk tools when automatic low risk execution is disabled", () => {
  withToolPolicy({ TOOLS_ENABLED: true, TOOLS_AUTO_EXECUTE_LOW_RISK: false }, () => {
    const decision = actionPolicy.canExecute(lowRiskTool, context);
    assert.equal(decision.allowed, false);
    assert.equal(decision.requiresApproval, true);
    assert.equal(decision.reason, "Low risk auto execution is disabled");
  });
});

test("global tool layer disabled takes precedence over low risk auto execution", () => {
  withToolPolicy({ TOOLS_ENABLED: false, TOOLS_AUTO_EXECUTE_LOW_RISK: false }, () => {
    const decision = actionPolicy.canExecute(lowRiskTool, context);
    assert.equal(decision.allowed, false);
    assert.equal(decision.requiresApproval, false);
    assert.equal(decision.reason, "Tool layer is disabled");
  });
});
