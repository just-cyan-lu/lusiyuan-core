import test from "node:test";
import assert from "node:assert/strict";
import {
  replySegmentDelay,
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

test("splits natural paragraphs even when each paragraph is short", () => {
  const reply = [
    "这种感觉其实挺真实的，就是脑子里先转一下，发个泡，然后内容慢慢成型。",
    "你想让我聊点什么？还是就看看效果就行？",
  ].join("\n\n");

  const segments = splitReplyByRules(reply, options);

  assert.ok(segments.length >= 2);
  assert.equal(segments[0], "这种感觉其实挺真实的，就是脑子里先转一下，发个泡，然后内容慢慢成型。");
  assert.equal(comparable(segments.join("")), comparable(reply));
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

test("calculates reply delay from readable character count", () => {
  const delayOptions: ReplySegmentationOptions = {
    ...options,
    delayMinMs: 600,
    delayMaxMs: 3200,
  };

  assert.equal(replySegmentDelay(0, "第一条立即发", delayOptions, () => 0.5), 0);
  assert.equal(replySegmentDelay(1, "短句。", delayOptions, () => 0.5), 600);
  assert.equal(
    replySegmentDelay(1, "这是一条稍微长一点的回复，会根据字数多等一小会。", delayOptions, () => 0.5),
    1032
  );
  assert.equal(
    replySegmentDelay(1, "很长".repeat(200), delayOptions, () => 0.5),
    3200
  );
});

test("adds bounded jitter to reply delay", () => {
  const delayOptions: ReplySegmentationOptions = {
    ...options,
    delayMinMs: 0,
    delayMaxMs: 5000,
  };

  assert.equal(replySegmentDelay(1, "这句话有十个字左右。", delayOptions, () => 0), 480);
  assert.equal(replySegmentDelay(1, "这句话有十个字左右。", delayOptions, () => 1), 800);
});
