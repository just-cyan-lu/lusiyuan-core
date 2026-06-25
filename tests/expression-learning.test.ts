import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpressionLearningRetrievalWhere,
  buildExpressionLearningEmbeddingText,
  deriveExpressionOwnerAction,
  normalizeExpressionLearningAnalysis,
} from "../src/expression-learning/expression-learning.service.js";
import { buildExpressionLearningTrainingExport } from "../src/expression-learning/expression-learning-training-records.js";
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

test("retrieval scope separates global, platform, scene, and private lessons", () => {
  assert.deepEqual(
    buildExpressionLearningRetrievalWhere({
      platform: "xiaohongshu",
      scene: "comment_reply",
    }),
    {
      status: "active",
      OR: [
        { scope: "global" },
        { platform: "xiaohongshu", scope: "platform" },
        { platform: "xiaohongshu", scene: "comment_reply", scope: "scene" },
      ],
    }
  );
});

test("training export keeps raw materials and a supervised sample", () => {
  const exported = buildExpressionLearningTrainingExport({
    id: "record-1",
    sourceType: "practice_question",
    platform: "chat",
    scene: "web_chat",
    scope: "scene",
    status: "completed",
    contextText: "朋友说：我今天真的很累。",
    draftText: "那你早点睡。",
    finalText: "听起来今天真的消耗很大，先不用急着解释，能休息就先歇一会儿。",
    outcome: "sent",
    ownerAction: "owner_taught",
    ownerNote: "不要急着给建议，先接住情绪。",
    reasonText: null,
    generatedQuestion: {
      contextText: "朋友说：我今天真的很累。",
      teachingFocus: "安抚",
      tags: ["情绪陪伴"],
    },
    generatedDraft: { draftText: "那你早点睡。", referenceExampleIds: ["example-old"] },
    analysisSnapshot: null,
    exportPayload: null,
    rawPayload: { request: { focus: "安抚" } },
    exampleId: "example-1",
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
    updatedAt: new Date("2026-06-25T00:00:01.000Z"),
    example: null,
  });

  assert.equal(exported.schema, "lusiyuan.expression_learning.training.v1");
  assert.equal(exported.record_id, "record-1");
  assert.equal(exported.supervised_sample.preferred_response, "听起来今天真的消耗很大，先不用急着解释，能休息就先歇一会儿。");
  assert.equal(exported.prompt_material.generated_question.teachingFocus, "安抚");
  assert.deepEqual(exported.supervised_sample.messages, [
    { role: "user", content: "朋友说：我今天真的很累。" },
    { role: "assistant", content: "听起来今天真的消耗很大，先不用急着解释，能休息就先歇一会儿。" },
  ]);
});

test("uses a controlled Xiaohongshu post type vocabulary", () => {
  assert.equal(normalizeXiaohongshuPostType("technical"), "technical");
  assert.equal(normalizeXiaohongshuPostType("随便写的类型"), "daily");
});
