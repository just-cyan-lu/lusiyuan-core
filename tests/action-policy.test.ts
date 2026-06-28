import test from "node:test";
import assert from "node:assert/strict";
import { actionPolicy } from "../src/tools/policy/action-policy.js";
import type { ToolDefinition, ToolExecutionContext } from "../src/tools/tool.types.js";

const enabledTool: ToolDefinition<unknown, unknown> = {
  name: "enabled_test_tool",
  description: "test tool",
  riskLevel: "low",
  enabled: true,
  handler: async () => ({}),
};

const ownerContext: ToolExecutionContext = {
  userId: "user_test",
  channel: "test",
  isOwner: true,
};

const nonOwnerContext: ToolExecutionContext = {
  ...ownerContext,
  isOwner: false,
};

test("allows enabled tools", () => {
  const decision = actionPolicy.canExecute(enabledTool, ownerContext);
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresApproval, false);
});

test("blocks disabled tools", () => {
  const decision = actionPolicy.canExecute(
    { ...enabledTool, enabled: false },
    ownerContext
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, false);
  assert.equal(decision.reason, "Tool is disabled");
});

test("blocks owner-only tools for non-owner contexts", () => {
  const decision = actionPolicy.canExecute(
    { ...enabledTool, ownerOnly: true },
    nonOwnerContext
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, false);
  assert.equal(decision.reason, "Owner only");
});
