import test from "node:test";
import assert from "node:assert/strict";
import { shouldIndexMessageForRecall } from "../src/core/message-embedding.service.js";

test("does not index platform interaction mirrors for chat recall", () => {
  assert.equal(
    shouldIndexMessageForRecall({
      role: "user",
      content: "评论区互动内容",
      isIntermediate: false,
      metadata: { useAsChatContext: false, sourcePlatform: "xiaohongshu" },
    }),
    false
  );
});

test("indexes normal user and assistant chat messages", () => {
  assert.equal(
    shouldIndexMessageForRecall({
      role: "assistant",
      content: "普通聊天内容",
      isIntermediate: false,
    }),
    true
  );
});
