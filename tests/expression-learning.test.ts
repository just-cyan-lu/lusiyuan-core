import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpressionLearningEmbeddingText,
  deriveExpressionOwnerAction,
  normalizeExpressionLearningAnalysis,
} from "../src/expression-learning/expression-learning.service.js";
import { normalizeXiaohongshuPostType } from "../src/platforms/xiaohongshu/xiaohongshu-account.service.js";

test("distinguishes owner-written, edited, accepted, and skipped decisions", () => {
  assert.equal(deriveExpressionOwnerAction(null, "谢谢你呀", "sent"), "owner_written");
  assert.equal(deriveExpressionOwnerAction("谢谢你呀", "谢谢你呀", "sent"), "accepted_draft");
  assert.equal(deriveExpressionOwnerAction("非常感谢你的支持", "嘿嘿，谢谢你", "sent"), "edited_draft");
  assert.equal(deriveExpressionOwnerAction("谢谢", null, "skipped"), "skipped");
});

test("normalizes incomplete LLM analysis into a usable lesson", () => {
  const result = normalizeExpressionLearningAnalysis(
    { tags: ["简短", 123, "评论区"], confidence: 2 },
    { outcome: "sent", ownerAction: "edited_draft" }
  );

  assert.match(result.lesson, /owner/);
  assert.deepEqual(result.tags, ["简短", "评论区"]);
  assert.equal(result.confidence, 0.98);
});

test("embedding text includes both the original draft and final owner decision", () => {
  const text = buildExpressionLearningEmbeddingText({
    platform: "xiaohongshu",
    scene: "comment_reply",
    contextText: "评论：你是怎么做出来的？",
    draftText: "这是通过很多技术组合完成的。",
    finalText: "一点点搭起来的，之后慢慢讲。",
    outcome: "sent",
    lesson: "技术评论先回答一个重点，不展开教程。",
    strategy: "简短回答并保留后续空间。",
    tone: "轻松",
    avoidances: ["长篇科普"],
    tags: ["技术问题"],
  });

  assert.match(text, /原草稿/);
  assert.match(text, /最终回复/);
  assert.match(text, /长篇科普/);
});

test("uses a controlled Xiaohongshu post type vocabulary", () => {
  assert.equal(normalizeXiaohongshuPostType("technical"), "technical");
  assert.equal(normalizeXiaohongshuPostType("随便写的类型"), "daily");
});

