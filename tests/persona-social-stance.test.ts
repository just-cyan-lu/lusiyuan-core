import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildChatPrompt } from "../src/core/prompt-builder.js";
import { loadPersona } from "../src/core/persona-loader.js";

test("social stance is selected from verified outer identity context", async () => {
  const persona = await loadPersona();
  const messages = buildChatPrompt({
    persona,
    memories: [],
    recentMessages: [],
    userMessage: "hello，你就是小思源吧",
    channel: "web",
    externalIdentityContext: [
      "## 外部身份候选（未确认）",
      "- 候选：Yuri（虚拟偶像）",
      "- 公开简介：数字人偶像，拥有较高公开关注度。",
    ].join("\n"),
  });

  const prompt = String(messages[0]?.content);
  assert.match(prompt, /面对有身份或影响力的人/);
  assert.match(prompt, /面对有身份或影响力的人的接话样本/);
  assert.doesNotMatch(prompt, /# 公开表达：像本人，不像运营号/);
  assert.match(prompt, /外部身份候选（未确认）/);
});

test("conversation behavior rejects old-fashioned social filler without banning formal contexts", async () => {
  const behavior = await readFile("persona/conversation_behavior.md", "utf-8");
  assert.match(behavior, /不要说“久仰久仰”等老成的词/);
  assert.match(behavior, /年轻的重点是反应直接、措辞自然、少说场面话/);
  assert.match(behavior, /明确的正式场合/);
});
