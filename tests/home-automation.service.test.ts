import test from "node:test";
import assert from "node:assert/strict";
import { HomeAutomationService } from "../src/home-automation/home-automation.service.js";
import type { HomeAssistantClientLike } from "../src/home-automation/home-assistant-client.js";
import type { ToolExecutionContext } from "../src/tools/tool.types.js";

const context: ToolExecutionContext = {
  userId: "owner",
  channel: "test",
  conversationId: "conversation-1",
  messageId: "message-1",
  isOwner: true,
};

test("Home Automation service reuses a repeated control action", async () => {
  let calls = 0;
  const client: HomeAssistantClientLike = {
    getState: async () => ({ entity_id: "light.living_room", state: "on", attributes: {} }),
    listStates: async () => [],
    callService: async () => {
      calls += 1;
      return [{ entity_id: "light.living_room", state: "on" }];
    },
  };
  const service = new HomeAutomationService(() => client);

  const input = {
    domain: "light",
    action: "turn_on",
    target: { entity_id: ["light.living_room"] },
  };
  const first = await service.control(input, context);
  const second = await service.control(input, context);
  assert.equal(first.reused, undefined);
  assert.equal(second.reused, true);

  assert.equal(calls, 1);
});

test("Home Automation service limits only HA state changes per message", async () => {
  let calls = 0;
  const client: HomeAssistantClientLike = {
    getState: async () => ({ entity_id: "light.living_room", state: "on", attributes: {} }),
    listStates: async () => [],
    callService: async () => {
      calls += 1;
      return {};
    },
  };
  const service = new HomeAutomationService(() => client);

  await service.control({
    domain: "light",
    action: "turn_on",
    target: { entity_id: ["light.living_room"] },
  }, context);
  await service.control({
    domain: "light",
    action: "turn_off",
    target: { entity_id: ["light.living_room"] },
  }, context);
  await assert.rejects(
    service.control({
      domain: "light",
      action: "toggle",
      target: { entity_id: ["light.living_room"] },
    }, context),
    /状态变更次数已达上限/
  );

  assert.equal(calls, 2);
});

test("Home Automation service limits total HA calls per message", async () => {
  let calls = 0;
  const client: HomeAssistantClientLike = {
    getState: async () => {
      calls += 1;
      return { entity_id: "light.living_room", state: "on", attributes: {} };
    },
    listStates: async () => [],
    callService: async () => ({}),
  };
  const service = new HomeAutomationService(() => client);
  const queryContext = { ...context, messageId: "message-query-budget" };

  await service.queryState({ entity_id: "light.living_room" }, queryContext);
  await service.queryState({ entity_id: "light.living_room" }, queryContext);
  await service.queryState({ entity_id: "light.living_room" }, queryContext);
  await assert.rejects(
    service.queryState({ entity_id: "light.living_room" }, queryContext),
    /调用次数已达上限/
  );

  assert.equal(calls, 3);
});

test("Home Automation service rejects domains outside the configured scope", async () => {
  const client: HomeAssistantClientLike = {
    getState: async () => ({ entity_id: "light.living_room", state: "on", attributes: {} }),
    listStates: async () => [],
    callService: async () => ({}),
  };
  const service = new HomeAutomationService(() => client);

  await assert.rejects(
    service.control({ domain: "lock", action: "unlock" }, context),
    /domain 未启用/
  );
});
