import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMiniMaxMetadata,
  buildMiniMaxRequestFields,
  extractMiniMaxMessageMetadata,
  isMiniMaxM3Model,
  isMiniMaxProvider,
} from "../src/core/minimax-provider.js";

test("detects MiniMax provider and M3 model case-insensitively", () => {
  assert.equal(isMiniMaxProvider("minimax"), true);
  assert.equal(isMiniMaxProvider("MiniMax"), true);
  assert.equal(isMiniMaxProvider("openai"), false);

  assert.equal(isMiniMaxM3Model("MiniMax-M3"), true);
  assert.equal(isMiniMaxM3Model(" minimax-m3 "), true);
  assert.equal(isMiniMaxM3Model("MiniMax-M2.7"), false);
});

test("builds MiniMax-M3 request fields from runtime options", () => {
  assert.deepEqual(
    buildMiniMaxRequestFields("minimax", "MiniMax-M3", {
      thinkingType: "adaptive",
      reasoningSplit: false,
      maxCompletionTokens: 8192,
    }),
    {
      thinking: { type: "adaptive" },
      reasoning_split: false,
      max_completion_tokens: 8192,
    }
  );
});

test("does not add MiniMax-M3 fields to other providers or older models", () => {
  const options = {
    thinkingType: "adaptive" as const,
    reasoningSplit: true,
    maxCompletionTokens: 8192,
  };

  assert.deepEqual(buildMiniMaxRequestFields("openai", "MiniMax-M3", options), {});
  assert.deepEqual(buildMiniMaxRequestFields("minimax", "MiniMax-M2.7", options), {});
});

test("extracts and reapplies MiniMax reasoning metadata", () => {
  const metadata = extractMiniMaxMessageMetadata({
    reasoning_content: "thinking text",
    reasoning_details: [{ type: "reasoning.text", index: 0 }],
    audio_content: "",
    name: "MiniMax AI",
  });

  assert.deepEqual(metadata, {
    reasoningContent: "thinking text",
    reasoningDetails: [{ type: "reasoning.text", index: 0 }],
    audioContent: "",
    name: "MiniMax AI",
  });

  const message: Record<string, unknown> = {};
  applyMiniMaxMetadata(message, { minimax: metadata });

  assert.deepEqual(message, {
    reasoning_content: "thinking text",
    reasoning_details: [{ type: "reasoning.text", index: 0 }],
    audio_content: "",
    name: "MiniMax AI",
  });
});
