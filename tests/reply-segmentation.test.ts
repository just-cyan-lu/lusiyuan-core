import test from "node:test";
import assert from "node:assert/strict";
import {
  replySegmentDelay,
  segmentReply,
  splitReplyByRules,
  validateLlmSegments,
  type ReplySegmentationOptions,
} from "../src/core/reply-segmentation.service.js";

const options: ReplySegmentationOptions = {
  mode: "final_blocks",
  llmEnabled: false,
  maxChars: 70,
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
    "好。",
    "可以。",
  ].join("\n\n");

  const segments = splitReplyByRules(reply, options);

  assert.deepEqual(segments, ["好。", "可以。"]);
  assert.equal(comparable(segments.join("")), comparable(reply));
});

test("keeps closing quotes with sentence-ending punctuation", () => {
  const reply = "“你说这一句，很有夏天的感觉…”然后我会再轻轻接一句。";

  const segments = splitReplyByRules(reply, { ...options, maxChars: 18 });

  assert.equal(segments[0], "“你说这一句，很有夏天的感觉…”");
  assert.ok(!segments.includes("”"));
  assert.equal(comparable(segments.join("")), comparable(reply));
});

test("keeps repeated sentence punctuation as separate breath marks", () => {
  const reply = "我想了一下……啊？";

  const segments = splitReplyByRules(reply, { ...options, maxChars: 8 });

  assert.deepEqual(segments, ["我想了一下…", "…", "啊？"]);
  assert.equal(comparable(segments.join("")), comparable(reply));
});

test("occasionally adds one casual split at an internal punctuation mark", async () => {
  const reply = "那我先说一下，后面再慢慢讲。";

  const result = await segmentReply(reply, options, undefined, () => 0.95);

  assert.deepEqual(result, {
    replies: ["那我先说一下，", "后面再慢慢讲。"],
    source: "rule",
  });
});

test("does not add a casual split when the 1-10 roll misses", async () => {
  const reply = "那我先说一下，后面再慢慢讲。";

  const result = await segmentReply(reply, options, undefined, () => 0.89);

  assert.deepEqual(result, { replies: [reply], source: "single" });
});

test("never casually splits structured replies", async () => {
  const reply = ["```ts", "const value = 1;", "console.log(value);", "```"].join("\n");

  const result = await segmentReply(reply, options, undefined, () => 0.95);

  assert.deepEqual(result, { replies: [reply], source: "single" });
});

test("accepts LLM segmentation only when it preserves the original reply", () => {
  const reply = "先这样。然后我们再把 Web 和 Telegram 都接上。";

  assert.deepEqual(
    validateLlmSegments(reply, ["先这样。", "然后我们再把 Web 和 Telegram 都接上。"]),
    ["先这样。", "然后我们再把 Web 和 Telegram 都接上。"]
  );
  assert.equal(
    validateLlmSegments(reply, ["先这样。", "然后我们顺便加一个新功能。"]),
    null
  );
});

test("does not clamp paragraph segments", () => {
  const reply = [
    "第一段先安抚一下情绪。",
    "第二段补充真正要点。",
    "第三段把风险说清楚。",
    "第四段给出下一步。",
    "第五段留一个自然收尾。",
  ].join("\n\n");

  const segments = splitReplyByRules(reply, { ...options, maxChars: 80 });

  assert.equal(segments.length, 5);
  assert.equal(comparable(segments.join("")), comparable(reply));
  assert.deepEqual(
    validateLlmSegments(reply, segments),
    segments
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
