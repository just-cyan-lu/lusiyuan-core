import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeToolAccessMode,
  toolAccessState,
} from "../src/tools/tool-access.js";

test("normalizes supported tool access mode aliases", () => {
  assert.equal(normalizeToolAccessMode(undefined, "on"), "on");
  assert.equal(normalizeToolAccessMode("owner-only", "on"), "owner_only");
  assert.equal(normalizeToolAccessMode("owner only", "on"), "owner_only");
  assert.equal(normalizeToolAccessMode("OFF", "on"), "off");
});

test("rejects unsupported tool access modes", () => {
  assert.throws(
    () => normalizeToolAccessMode("private", "on", "TOOL_TEST_MODE"),
    /Invalid TOOL_TEST_MODE/
  );
});

test("builds enabled and owner-only state from tool access mode", () => {
  assert.deepEqual(toolAccessState("off"), {
    enabled: false,
    ownerOnly: false,
    accessMode: "off",
  });
  assert.deepEqual(toolAccessState("owner_only"), {
    enabled: true,
    ownerOnly: true,
    accessMode: "owner_only",
  });
  assert.deepEqual(toolAccessState("on", false), {
    enabled: false,
    ownerOnly: false,
    accessMode: "on",
  });
});
