import test from "node:test";
import assert from "node:assert/strict";
import { runtimeSettingDefinitions } from "../src/config/runtime-settings.registry.js";
import { runtimeConfig, runtimeSettingsService } from "../src/config/runtime-settings.service.js";
import { hasRemainingToolRounds } from "../src/core/chat.service.js";
import { checkInput } from "../src/core/safety.js";
import { runWithOptionalTimeout } from "../src/tools/tool-executor.js";
import { toolRegistry } from "../src/tools/tool-registry.js";
import "../src/init.js";

test("runtime settings registry never contains bootstrap secrets", () => {
  const keys = Object.keys(runtimeSettingDefinitions);
  for (const forbidden of [
    "DATABASE_URL",
    "ADMIN_API_TOKEN",
    "ADMIN_DATABASE_CLEAR_PASSWORD",
    "OWNER_USER_IDS",
    "OPENAI_API_KEY",
    "TELEGRAM_BOT_TOKEN",
  ]) {
    assert.equal(keys.includes(forbidden), false, `${forbidden} must stay outside database settings`);
  }
});

test("temporary runtime values are visible immediately and restored", () => {
  const original = runtimeConfig.TOOL_TIMEOUT_MS;
  runtimeSettingsService.withTemporaryValues({ TOOL_TIMEOUT_MS: original + 1 }, () => {
    assert.equal(runtimeConfig.TOOL_TIMEOUT_MS, original + 1);
  });
  assert.equal(runtimeConfig.TOOL_TIMEOUT_MS, original);
});

test("message length limit can be disabled with zero", () => {
  runtimeSettingsService.withTemporaryValues(
    { MAX_MESSAGE_LENGTH: 0 },
    () => assert.equal(checkInput("x".repeat(100_001)).ok, true)
  );
  runtimeSettingsService.withTemporaryValues(
    { MAX_MESSAGE_LENGTH: 3 },
    () => assert.deepEqual(checkInput("xxxx"), {
      ok: false,
      error: "Message too long. Maximum 3 characters allowed.",
    })
  );
});

test("registered tool access resolves from current runtime settings", () => {
  runtimeSettingsService.withTemporaryValues(
    { TOOL_SEARCH_MEMORIES_MODE: "off", MEMORY_RETRIEVAL_ENABLED: true },
    () => assert.equal(toolRegistry.get("search_memories")?.enabled, false)
  );
  runtimeSettingsService.withTemporaryValues(
    { TOOL_SEARCH_MEMORIES_MODE: "on", MEMORY_RETRIEVAL_ENABLED: true },
    () => assert.equal(toolRegistry.get("search_memories")?.enabled, true)
  );
});

test("tool call round limit can be disabled with zero", () => {
  assert.equal(hasRemainingToolRounds(0, 3), true);
  assert.equal(hasRemainingToolRounds(2, 3), true);
  assert.equal(hasRemainingToolRounds(3, 3), false);
  assert.equal(hasRemainingToolRounds(99, 0), true);
});

test("tool timeout can be disabled with zero", async () => {
  const output = await runWithOptionalTimeout(async () => "ok", 0);
  assert.equal(output, "ok");
  await assert.rejects(
    runWithOptionalTimeout(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return "late";
      },
      1
    ),
    /Tool timeout/
  );
});
