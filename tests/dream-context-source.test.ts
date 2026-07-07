import test from "node:test";
import assert from "node:assert/strict";
import { classifyDreamMessageSource } from "../src/dream/dream-context-builder.js";

test("classifies normal chat as continuous private chat", () => {
  assert.deepEqual(
    classifyDreamMessageSource({
      channel: "web",
      messageMetadata: null,
      conversationMetadata: null,
    }),
    {
      sourceKind: "private_chat",
      sourcePlatform: "web",
      sourceType: null,
      continuity: "continuous",
      dreamEligible: true,
      memoryEligible: true,
      relationshipEligible: true,
    }
  );
});

test("classifies Xiaohongshu root comments as threaded platform comments", () => {
  const source = classifyDreamMessageSource({
    channel: "xiaohongshu",
    messageMetadata: {
      sourcePlatform: "xiaohongshu",
      sourceType: "comment",
      continuity: "threaded",
      useAsChatContext: false,
      dreamEligible: true,
    },
    conversationMetadata: {
      sourcePlatform: "xiaohongshu",
      continuity: "threaded",
    },
  });

  assert.equal(source.sourceKind, "platform_comment");
  assert.equal(source.continuity, "threaded");
  assert.equal(source.dreamEligible, true);
});

test("classifies Xiaohongshu direct replies as platform thread replies", () => {
  const source = classifyDreamMessageSource({
    channel: "xiaohongshu",
    messageMetadata: {
      sourcePlatform: "xiaohongshu",
      sourceType: "comment",
      continuity: "threaded",
      replyToId: "comment-1",
    },
    conversationMetadata: null,
  });

  assert.equal(source.sourceKind, "platform_thread_reply");
});
