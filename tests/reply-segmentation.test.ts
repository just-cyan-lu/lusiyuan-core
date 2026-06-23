import test from "node:test";
import assert from "node:assert/strict";
import {
  splitReplyByRules,
  validateLlmSegments,
  type ReplySegmentationOptions,
} from "../src/core/reply-segmentation.service.js";

const options: ReplySegmentationOptions = {
  mode: "final_blocks",
  llmEnabled: false,
  minChars: 20,
  maxChars: 70,
  maxCount: 4,
  delayMinMs: 0,
  delayMaxMs: 0,
};

function comparable(text: string): string {
  return text.replace(/[\s\u200b-\u200d\ufeff]/g, "");
}

test("splits prose into natural reply bubbles", () => {
  const reply =
    "嗯，我懂。这个功能最重要的不是把一段话机械切开，而是让每条消息都有完整语气。先给一个短反应，再把真正的信息分两三步说完，会更像人在聊天。";

  const segments = splitReplyByRules(reply, options);

  assert.ok(segments.length > 1);
  assert.ok(segments.length <= options.maxCount);
  assert.equal(segments[0], "嗯，我懂。");
  assert.equal(comparable(segments.join("")), comparable(reply));
});

test("keeps structured replies as a single message", () => {
  const reply = [
    "```ts",
    "const value = 1;",
    "console.log(value);",
    "```",
    "这段代码需要保持连续。",
  ].join("\n");

  assert.deepEqual(splitReplyByRules(reply, options), [reply]);
});

test("accepts LLM segmentation only when it preserves the original reply", () => {
  const reply = "先这样。然后我们再把 Web 和 Telegram 都接上。";

  assert.deepEqual(
    validateLlmSegments(reply, ["先这样。", "然后我们再把 Web 和 Telegram 都接上。"], options),
    ["先这样。", "然后我们再把 Web 和 Telegram 都接上。"]
  );
  assert.equal(
    validateLlmSegments(reply, ["先这样。", "然后我们顺便加一个新功能。"], options),
    null
  );
});
