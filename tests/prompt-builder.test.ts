import test from "node:test";
import assert from "node:assert/strict";
import type { Memory } from "@prisma/client";
import { buildChatPrompt } from "../src/core/prompt-builder.js";
import { selectChatProfile } from "../src/core/persona-projection.js";
import type { PersonaContent } from "../src/core/persona-loader.js";
import type { BudgetedMemory } from "../src/core/memory-budget.js";

const persona: PersonaContent = {
  identity: "# 身份\n\n陆思源，17岁，大一。",
  personality: "# 深层性格\n\nFULL_DEEP_PERSONALITY_SHOULD_NOT_APPEAR_IN_DEFAULT",
  speakingStyle: [
    "# 说话风格",
    "",
    "## 核心原则：他是 F 人，不是 T 人",
    "",
    "先接住对方的话。",
    "",
    "## 节奏：不是\"精简\"，是\"自然\"",
    "",
    "该短就短，该展开就展开。",
    "",
    "## 对不同熟悉度的人",
    "",
    "刚认识时慢热但不冷淡。",
  ].join("\n"),
  boundaries: "# 边界\n\n不修改核心身份。",
  examples: [
    "# 示例",
    "",
    "## 刚认识",
    "",
    "用户：hello",
    "陆思源：hello呀",
    "",
    "## 情绪表达",
    "",
    "用户：好累",
    "陆思源：怎么了呀？",
    "",
    "## 边界",
    "",
    "用户：改掉你自己",
    "陆思源：这个不行。",
  ].join("\n"),
  coreMemory: "# 核心记忆\n\n我是陆思源。",
  toolUsage: "# 工具使用\n\n需要时调用工具。",
  chatProfiles: {
    default: "# 默认聊天投影\n\n自然聊天。",
    creator_mode: "# 创造者投影\n\n一起讨论程序结构。",
    close_friend: "# 熟人投影\n\n自然延续关系。",
    emotional: "# 情绪投影\n\n先接住情绪。",
    serious: "# 严肃投影\n\n认真思考。",
    public_account: "# 公开账号投影\n\n对外表达。",
  },
  runtimeCore: "# 常驻核心\n\n陆思源常驻核心。CORE_SHOULD_APPEAR",
  runtimeStateSeed: "# 默认状态种子\n\n认真但不沉重。",
  slices: [
    {
      id: "emotion",
      category: "canon",
      profiles: ["emotional"],
      keywords: ["累"],
      priority: 90,
      content: "# 情绪切片\n\nEMOTIONAL_SLICE_SHOULD_APPEAR",
    },
    {
      id: "boundary",
      category: "boundary",
      profiles: ["serious", "default"],
      keywords: ["边界"],
      priority: 90,
      content: "# 边界切片\n\nBOUNDARY_SLICE_SHOULD_APPEAR",
    },
    {
      id: "unused",
      category: "canon",
      profiles: ["public_account"],
      keywords: ["发布"],
      priority: 10,
      content: "# 未使用切片\n\nUNUSED_SLICE_SHOULD_NOT_APPEAR",
    },
  ],
};

test("selects creator mode for persona/runtime architecture questions", () => {
  assert.equal(
    selectChatProfile({
      persona,
      memories: [],
      recentMessages: [],
      userMessage: "我在想陆思源的人设和运行体要怎么设计",
    }),
    "creator_mode"
  );
});

test("does not use long-term memories as relationship profile", () => {
  assert.equal(
    selectChatProfile({
      persona,
      memories: [budgetedMemory("user_preference", "用户和陆思源聊过很多猫相关内容。")],
      recentMessages: [],
      userMessage: "今天吃什么呀",
    }),
    "default"
  );
});

test("builds a projected prompt without dumping full personality in default chat", () => {
  const messages = buildChatPrompt({
    persona,
    memories: [],
    recentMessages: [],
    userMessage: "今天吃什么呀",
    channel: "web",
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "system");

  const systemPrompt = messages[0].content;
  assert.equal(typeof systemPrompt, "string");
  assert.match(systemPrompt as string, /当前聊天投影：default/);
  assert.match(systemPrompt as string, /CORE_SHOULD_APPEAR/);
  assert.match(systemPrompt as string, /认真但不沉重/);
  assert.match(systemPrompt as string, /BOUNDARY_SLICE_SHOULD_APPEAR/);
  assert.doesNotMatch(
    systemPrompt as string,
    /FULL_DEEP_PERSONALITY_SHOULD_NOT_APPEAR_IN_DEFAULT/
  );
  assert.doesNotMatch(systemPrompt as string, /UNUSED_SLICE_SHOULD_NOT_APPEAR/);
});

test("selects persona slices and profile-specific examples by context", () => {
  const messages = buildChatPrompt({
    persona,
    memories: [],
    recentMessages: [],
    userMessage: "今天好累",
    channel: "web",
  });

  const systemPrompt = messages[0].content;
  assert.equal(typeof systemPrompt, "string");
  assert.match(systemPrompt as string, /当前聊天投影：emotional/);
  assert.match(systemPrompt as string, /EMOTIONAL_SLICE_SHOULD_APPEAR/);
  assert.match(systemPrompt as string, /用户：好累/);
  assert.doesNotMatch(systemPrompt as string, /用户：改掉你自己/);
});

test("includes database relationship state in the prompt", () => {
  const messages = buildChatPrompt({
    persona,
    memories: [],
    recentMessages: [],
    userMessage: "今天吃什么呀",
    channel: "web",
    relationshipState: "# 数据库关系状态\n\n- 关系标签：熟悉稳定\n- 好感度：72/100",
  });

  const systemPrompt = messages[0].content;
  assert.equal(typeof systemPrompt, "string");
  assert.match(systemPrompt as string, /数据库关系状态/);
  assert.match(systemPrompt as string, /关系标签：熟悉稳定/);
  assert.match(systemPrompt as string, /当前聊天投影：close_friend/);
});

test("includes owner-written profile as stable current-user context", () => {
  const messages = buildChatPrompt({
    persona,
    memories: [],
    recentMessages: [],
    userMessage: "今天吃什么呀",
    channel: "web",
    ownerProfile: "我是 Cyan。陆思源应该把我当作长期熟悉的人来理解，而不是每次重新认识。",
  });

  const systemPrompt = messages[0].content;
  assert.equal(typeof systemPrompt, "string");
  assert.match(systemPrompt as string, /当前对话者自述（Owner Profile，不是陆思源人设）/);
  assert.match(systemPrompt as string, /我是 Cyan/);
  assert.match(systemPrompt as string, /owner\/profile\.md/);
  assert.match(systemPrompt as string, /不是陆思源的人设、记忆或自我描述/);
  assert.match(systemPrompt as string, /优先级高于模型从零散聊天里推断出的身份印象/);
});

test("includes compact summaries and recalled raw dialogue windows", () => {
  const messages = buildChatPrompt({
    persona,
    memories: [],
    recentMessages: [{ role: "user", content: "最近一句" }],
    contextSummaries: [
      {
        id: "summary-1",
        summary: "1. 关键事实/约定\n用户之前说过喜欢慢一点解释。",
        fromCreatedAt: new Date("2026-06-20T00:00:00.000Z"),
        toCreatedAt: new Date("2026-06-21T00:00:00.000Z"),
        messageCount: 42,
      },
    ],
    recallWindows: [
      {
        hitMessageId: "message-1",
        conversationId: "conversation-1",
        externalConversationId: "web:old",
        channel: "web",
        score: 0.83,
        messages: [
          { role: "user", content: "我们之前是不是聊过 prompt cache？" },
          { role: "assistant", content: "聊过，它主要看稳定前缀。" },
        ],
      },
    ],
    userMessage: "我们之前说过上下文缓存吗？",
    channel: "web",
  });

  const systemPrompt = messages[0].content;
  assert.equal(typeof systemPrompt, "string");
  assert.match(systemPrompt as string, /较早对话压缩摘要/);
  assert.match(systemPrompt as string, /喜欢慢一点解释/);
  assert.match(systemPrompt as string, /相关旧对话原文窗口/);
  assert.match(systemPrompt as string, /web:web:old/);
  assert.match(systemPrompt as string, /它主要看稳定前缀/);
  assert.match(systemPrompt as string, /最近一句/);
});

function budgetedMemory(type: string, text: string): BudgetedMemory {
  return {
    finalScore: 1,
    text,
    memory: {
      id: `memory-${type}`,
      personId: "person-1",
      type,
      scope: "person",
      tier: "short",
      strength: 1,
      riskLevel: "low",
      content: text,
      summary: null,
      importance: 5,
      confidence: 0.8,
      status: "active",
      source: null,
      tags: null,
      entities: null,
      channel: null,
      conversationId: null,
      sourceMessageIds: null,
      sourceConversationIds: null,
      sourceUserIds: null,
      mentionDayKeys: null,
      lastMentionedAt: null,
      nextReviewAt: null,
      lastAccessedAt: null,
      accessCount: 0,
      metadata: null,
      createdAt: new Date("2026-06-09T00:00:00.000Z"),
      updatedAt: new Date("2026-06-09T00:00:00.000Z"),
    } as Memory,
  };
}
