import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpressionLearningRetrievalWhere,
  buildExpressionLearningEmbeddingText,
  deriveExpressionOwnerAction,
  normalizeExpressionLearningAnalysis,
} from "../src/expression-learning/expression-learning.service.js";
import { buildExpressionLearningDialogueContext } from "../src/expression-learning/expression-learning-dialogues.js";
import {
  buildExpressionLearningTrainingExport,
  buildExpressionLearningTrainingRecordWhere,
} from "../src/expression-learning/expression-learning-training-records.js";
import { normalizeXiaohongshuPostType } from "../src/platforms/xiaohongshu/xiaohongshu-account.service.js";
import {
  formatExpressionLearningRules,
  normalizeExpressionLearningRuleCandidate,
} from "../src/expression-learning/expression-learning-rules.js";
import {
  buildExpressionLearningDistillationWhere,
  normalizeExpressionLearningDistillationCandidates,
} from "../src/expression-learning/expression-learning-distillation.js";
import {
  extractExpressionLearningRuleBlock,
  hashExpressionLearningRuleBlock,
  inspectExpressionLearningRulePublication,
  removeExpressionLearningRuleBlock,
  renderExpressionLearningRuleBlock,
  upsertExpressionLearningRuleBlock,
} from "../src/expression-learning/expression-learning-publication.js";

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
    scene: "reply",
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

test("retrieval includes general lessons and the current scene", () => {
  assert.deepEqual(
    buildExpressionLearningRetrievalWhere({
      scene: "reply",
    }),
    {
      status: "active",
      scene: { in: ["general", "reply"] },
    }
  );
});

test("general retrieval is not duplicated", () => {
  assert.deepEqual(
    buildExpressionLearningRetrievalWhere({
      scene: "general",
    }),
    {
      status: "active",
      scene: { in: ["general"] },
    }
  );
});

test("distills an explicit global avoidance without losing its source coverage", () => {
  const candidate = normalizeExpressionLearningRuleCandidate({
    ruleText: "不要使用 🤝 表情，它会让表达显得老气。",
    kind: "avoid",
    scope: "global",
    scene: "reply",
    strength: "hard",
    coverage: "partial",
    reason: "owner 明确要求一定不要使用。",
  }, {
    scene: "reply",
    lesson: "公开回复要简短自然。",
    strategy: "少用过时表情。",
    ownerNote: "🤝 太老气，一定不要使用。",
  });

  assert.equal(candidate.scope, "global");
  assert.equal(candidate.scene, null);
  assert.equal(candidate.strength, "hard");
  assert.equal(candidate.coverage, "partial");
});

test("formats active rules as higher-priority prompt instructions", () => {
  const text = formatExpressionLearningRules([{
    ruleText: "不要使用 🤝 表情。",
    kind: "avoid",
    scope: "global",
    scene: null,
    strength: "hard",
  } as never]);

  assert.match(text, /优先于后面的相似经验/);
  assert.match(text, /必须遵守\/全局\/avoid/);
});

test("batch distillation filters examples by organization state", () => {
  assert.deepEqual(buildExpressionLearningDistillationWhere({
    scene: "reply",
    organization: "unorganized",
  }), {
    scene: "reply",
    ruleEvidences: { none: {} },
  });
  assert.deepEqual(buildExpressionLearningDistillationWhere({
    organization: "partial",
  }), {
    AND: [
      { ruleEvidences: { some: { coverage: "partial" } } },
      { ruleEvidences: { none: { coverage: "full" } } },
    ],
  });
});

test("batch distillation deduplicates candidates and matches existing rules", () => {
  const candidates = normalizeExpressionLearningDistillationCandidates({
    value: {
      candidates: [
        {
          ruleText: "不要使用 🤝 表情。",
          kind: "avoid",
          scope: "global",
          strength: "hard",
          coverage: "partial",
          sourceExampleIds: ["example-1"],
          matchType: "new",
        },
        {
          ruleText: "不要使用🤝表情",
          kind: "avoid",
          scope: "global",
          strength: "hard",
          coverage: "full",
          sourceExampleIds: ["example-2"],
          matchType: "new",
        },
      ],
    },
    examples: [
      { id: "example-1", scene: "reply", lesson: "不用老气表情", ownerNote: null },
      { id: "example-2", scene: "chat", lesson: "不用老气表情", ownerNote: null },
    ],
    existingRules: [{ id: "rule-1", ruleText: "不要使用 🤝 表情" }],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.matchType, "duplicate");
  assert.equal(candidates[0]?.matchedRuleId, "rule-1");
  assert.deepEqual(candidates[0]?.sourceExampleIds, ["example-1", "example-2"]);
  assert.equal(candidates[0]?.coverage, "partial");
});

test("marks split rules as partial coverage even when the model says full", () => {
  const candidates = normalizeExpressionLearningDistillationCandidates({
    value: { candidates: [
      { ruleText: "不要使用老气表情", sourceExampleIds: ["example-1"], coverage: "full" },
      { ruleText: "回复保持简短", sourceExampleIds: ["example-1"], coverage: "full" },
    ] },
    examples: [{ id: "example-1", scene: "reply", lesson: "简短且不用老气表情", ownerNote: null }],
    existingRules: [],
  });
  assert.deepEqual(candidates.map((candidate) => candidate.coverage), ["partial", "partial"]);
});

test("does not propose evidence already linked to the matched rule", () => {
  const candidates = normalizeExpressionLearningDistillationCandidates({
    value: { candidates: [{
      ruleText: "回复保持简短",
      sourceExampleIds: ["old-evidence", "new-evidence"],
      matchType: "duplicate",
      matchedRuleId: "rule-1",
    }] },
    examples: [
      {
        id: "old-evidence",
        scene: "reply",
        lesson: "简短回复",
        ownerNote: null,
        ruleEvidences: [{ ruleId: "rule-1", relation: "supports" }],
      },
      { id: "new-evidence", scene: "chat", lesson: "简短回复", ownerNote: null, ruleEvidences: [] },
    ],
    existingRules: [{ id: "rule-1", ruleText: "回复保持简短" }],
  });
  assert.deepEqual(candidates[0]?.sourceExampleIds, ["new-evidence"]);
});

test("publishes managed expression rule blocks without rewriting surrounding markdown", () => {
  const rule = { id: "rule-1", ruleText: "不要使用老气表情。", kind: "avoid", strength: "hard" };
  const block = renderExpressionLearningRuleBlock(rule as never);
  const content = upsertExpressionLearningRuleBlock("# 表达规则\n", rule.id, block);
  assert.equal(extractExpressionLearningRuleBlock(content, rule.id), block);
  assert.match(content, /必须遵守 · 避免/);
  assert.equal(removeExpressionLearningRuleBlock(content, rule.id), "# 表达规则\n");
});

test("detects synced, outdated, and manually modified markdown rules", () => {
  const base = {
    id: "rule-1",
    ruleText: "不要使用老气表情。",
    kind: "avoid",
    strength: "hard",
    publishedAt: new Date(),
    publishedPath: "persona/expression_rules.md",
  };
  const block = renderExpressionLearningRuleBlock(base as never);
  const publishedContentHash = hashExpressionLearningRuleBlock(block);
  assert.equal(inspectExpressionLearningRulePublication(
    { ...base, publishedContentHash } as never,
    `# 规则\n\n${block}\n`
  ).state, "synced");
  assert.equal(inspectExpressionLearningRulePublication(
    { ...base, ruleText: "不要使用任何老气表情。", publishedContentHash } as never,
    `# 规则\n\n${block}\n`
  ).state, "outdated");
  assert.equal(inspectExpressionLearningRulePublication(
    { ...base, publishedContentHash } as never,
    `# 规则\n\n${block.replace("老气", "过时")}\n`
  ).state, "file_modified");
});

test("training export keeps raw materials and a supervised sample", () => {
  const exported = buildExpressionLearningTrainingExport({
    id: "record-1",
    sourceType: "practice_question",
    scene: "chat",
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

test("dismissed training questions export as rejected question feedback", () => {
  const exported = buildExpressionLearningTrainingExport({
    id: "record-bad-question",
    sourceType: "practice_question",
    scene: "chat",
    status: "dismissed",
    contextText: "私设一个陆思源认识八年的朋友。",
    draftText: null,
    finalText: null,
    outcome: null,
    ownerAction: null,
    ownerNote: "违背人设，关系背景不能凭空编。",
    reasonText: "违背人设，关系背景不能凭空编。",
    generatedQuestion: {
      contextText: "私设一个陆思源认识八年的朋友。",
      teachingFocus: "朋友祝贺",
      tags: ["坏题"],
    },
    generatedDraft: null,
    analysisSnapshot: null,
    exportPayload: null,
    rawPayload: null,
    exampleId: null,
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
    updatedAt: new Date("2026-06-25T00:00:01.000Z"),
    example: null,
  });

  assert.equal(exported.supervised_sample.task, "rejected_question");
  assert.equal(exported.owner_decision.owner_note, "违背人设，关系背景不能凭空编。");
});

test("training record filters include exercise source and local created date range", () => {
  const where = buildExpressionLearningTrainingRecordWhere({
    sourceType: "exercise",
    status: "open",
    createdFrom: "2026-07-08",
    createdTo: "2026-07-09",
  });

  assert.deepEqual(where.sourceType, {
    in: ["practice_question", "practice_answer", "manual_teaching"],
  });
  assert.equal(where.status, "question_generated");
  assert.ok(where.createdAt && typeof where.createdAt === "object");
  assert.equal(
    (where.createdAt as { gte: Date }).gte.toISOString(),
    new Date(2026, 6, 8, 0, 0, 0, 0).toISOString()
  );
  assert.equal(
    (where.createdAt as { lte: Date }).lte.toISOString(),
    new Date(2026, 6, 9, 23, 59, 59, 999).toISOString()
  );
});

test("dialogue learning context uses the upstream path and current user turn", () => {
  const context = buildExpressionLearningDialogueContext({
    dialogueCase: {
      scene: "chat",
      title: "朋友失落时的连续回应",
      trainingFocus: "先接住，再轻轻追问",
      rootContextText: "朋友考试失利，语气有点自嘲。",
    },
    turns: [
      {
        id: "turn-1",
        parentTurnId: null,
        branchLabel: null,
        userText: "算了，我就是不适合这个专业。",
        draftText: "别这么想。",
        finalText: "先别急着给自己判死刑，今天真的很难受也正常。",
        outcome: "sent",
        ownerNote: null,
        sortOrder: 0,
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
      },
      {
        id: "turn-2",
        parentTurnId: "turn-1",
        branchLabel: "对方继续自嘲",
        userText: "哈哈，可能我脑子真的不太行。",
        draftText: null,
        finalText: null,
        outcome: null,
        ownerNote: null,
        sortOrder: 0,
        createdAt: new Date("2026-07-10T00:01:00.000Z"),
      },
    ],
    turn: {
      id: "turn-2",
      parentTurnId: "turn-1",
      branchLabel: "对方继续自嘲",
      userText: "哈哈，可能我脑子真的不太行。",
      draftText: null,
      finalText: null,
      outcome: null,
      ownerNote: null,
      sortOrder: 0,
      createdAt: new Date("2026-07-10T00:01:00.000Z"),
    },
  });

  assert.match(context, /朋友考试失利/);
  assert.match(context, /先别急着给自己判死刑/);
  assert.match(context, /对方继续自嘲/);
  assert.match(context, /哈哈，可能我脑子真的不太行/);
  assert.doesNotMatch(context, /别这么想。/);
});

test("uses a controlled Xiaohongshu post type vocabulary", () => {
  assert.equal(normalizeXiaohongshuPostType("technical"), "technical");
  assert.equal(normalizeXiaohongshuPostType("随便写的类型"), "daily");
});
