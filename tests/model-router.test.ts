import test from "node:test";
import assert from "node:assert/strict";
import { getModelPurposeAssignments } from "../src/core/model-provider.js";
import { runtimeSettingsService } from "../src/config/runtime-settings.service.js";

test("routes chat, Dream, and expression learning to independent providers", () => {
  runtimeSettingsService.withTemporaryValues(
    {
      DEFAULT_MODEL_PROVIDER: "openai",
      CHAT_MODEL_PROVIDER: "minimax",
      DREAM_MODEL_PROVIDER: "custom",
      EXPRESSION_LEARNING_MODEL_PROVIDER: "custom",
    },
    () => {
      assert.deepEqual(getModelPurposeAssignments(), {
        default: "openai",
        chat: "minimax",
        dream: "custom",
        "expression-learning": "custom",
      });
    }
  );
});
