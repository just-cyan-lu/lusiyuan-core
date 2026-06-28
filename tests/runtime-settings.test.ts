import test from "node:test";
import assert from "node:assert/strict";
import { runtimeSettingDefinitions } from "../src/config/runtime-settings.registry.js";
import { runtimeConfig, runtimeSettingsService } from "../src/config/runtime-settings.service.js";
import { checkInput } from "../src/core/safety.js";
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
  const original = runtimeConfig.MEMORY_FINAL_TOP_K;
  runtimeSettingsService.withTemporaryValues({ MEMORY_FINAL_TOP_K: original + 1 }, () => {
    assert.equal(runtimeConfig.MEMORY_FINAL_TOP_K, original + 1);
  });
  assert.equal(runtimeConfig.MEMORY_FINAL_TOP_K, original);
});

test("input safety rejects empty messages only", () => {
  assert.deepEqual(checkInput("   "), {
    ok: false,
    error: "Message cannot be empty.",
  });
  assert.equal(checkInput("x".repeat(100_001)).ok, true);
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
