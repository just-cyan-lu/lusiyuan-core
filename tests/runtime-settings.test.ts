import test from "node:test";
import assert from "node:assert/strict";
import { runtimeSettingDefinitions } from "../src/config/runtime-settings.registry.js";
import { runtimeConfig, runtimeSettingsService } from "../src/config/runtime-settings.service.js";
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
