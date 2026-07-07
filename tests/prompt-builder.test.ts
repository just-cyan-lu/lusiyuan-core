import test from "node:test";
import assert from "node:assert/strict";
import type { Memory } from "@prisma/client";
import { buildChatPrompt } from "../src/core/prompt-builder.js";
import {
  selectChatProfile,
  selectRelationshipTone,
} from "../src/core/persona-projection.js";
import type { PersonaContent } from "../src/core/persona-loader.js";
import type { BudgetedMemory } from "../src/core/memory-budget.js";

const persona: PersonaContent = {
  personality: "# 深层性格\n\nFULL_DEEP_PERSONALITY_SHOULD_NOT_APPEAR_IN_DEFAULT",
  conversationBehavior: "# 接话规则\n\n先接当前这句话，不要像客服。BEHAVIOR_SHOULD_APPEAR",
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
  samples: [
    {
      id: "daily",
      profiles: ["default", "close_friend"],
      keywords: ["吃什么", "hello"],
      priority: 80,
      content: "# 日常样本\n\nDAILY_SAMPLE_SHOULD_APPEAR",
    },
    {
      id: "spark",
      profiles: ["default", "close_friend", "creator_mode"],
      keywords: ["脑洞", "好玩"],
      priority: 88,
      content: "# 活力样本\n\nSPARK_SAMPLE_SHOULD_APPEAR",
    },
    {
      id: "childlike",
      profiles: ["default", "close_friend", "creator_mode"],
      keywords: ["幼稚", "慢半拍"],
      priority: 70,
      content: "# 孩子气样本\n\nCHILDLIKE_SAMPLE_SHOULD_APPEAR",
    },
    {
      id: "emotion",
      profiles: ["emotional"],
      keywords: ["累"],
      priority: 95,
      content: "# 情绪样本\n\nEMOTION_SAMPLE_SHOULD_APPEAR",
    },
    {
      id: "creator",
      profiles: ["creator_mode"],
      keywords: ["人设"],
      priority: 100,
      content: "# 创作者样本\n\nCREATOR_SAMPLE_SHOULD_APPEAR",
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
  assert.match(systemPrompt as string, /当前场景策略：default/);
  assert.match(systemPrompt as string, /CORE_SHOULD_APPEAR/);
  assert.match(systemPrompt as string, /BEHAVIOR_SHOULD_APPEAR/);
  assert.match(systemPrompt as string, /认真但不沉重/);
  assert.match(systemPrompt as string, /DAILY_SAMPLE_SHOULD_APPEAR/);
  assert.match(systemPrompt as string, /SPARK_SAMPLE_SHOULD_APPEAR/);
  assert.match(systemPrompt as string, /CHILDLIKE_SAMPLE_SHOULD_APPEAR/);
  assert.doesNotMatch(systemPrompt as string, /BOUNDARY_SLICE_SHOULD_APPEAR/);
  assert.doesNotMatch(
    systemPrompt as string,
    /FULL_DEEP_PERSONALITY_SHOULD_NOT_APPEAR_IN_DEFAULT/
  );
  assert.doesNotMatch(systemPrompt as string, /UNUSED_SLICE_SHOULD_NOT_APPEAR/);
});

test("selects persona slices and profile-specific samples by context", () => {
  const messages = buildChatPrompt({
    persona,
    memories: [],
    recentMessages: [],
    userMessage: "今天好累",
    channel: "web",
  });

  const systemPrompt = messages[0].content;
  assert.equal(typeof systemPrompt, "string");
  assert.match(systemPrompt as string, /当前场景策略：emotional/);
  assert.match(systemPrompt as string, /EMOTIONAL_SLICE_SHOULD_APPEAR/);
  assert.match(systemPrompt as string, /EMOTION_SAMPLE_SHOULD_APPEAR/);
  assert.doesNotMatch(systemPrompt as string, /BOUNDARY_SLICE_SHOULD_APPEAR/);
});

test("includes database relationship state as relationship tone, without overriding scene profile", () => {
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
  assert.match(systemPrompt as string, /关系语气：熟悉稳定/);
  assert.match(systemPrompt as string, /当前场景策略：default/);
});

test("selects relationship tone independently from chat profile", () => {
  assert.equal(
    selectRelationshipTone({
      ownerProfile: "",
      relationshipState: "# 数据库关系状态\n\n- 关系标签：熟悉稳定\n- 好感度：72/100",
      recentMessages: [],
    }),
    "close"
  );

  assert.equal(
    selectChatProfile({
      persona,
      memories: [],
      recentMessages: [],
      userMessage: "今天吃什么呀",
      relationshipState: "# 数据库关系状态\n\n- 关系标签：熟悉稳定\n- 好感度：72/100",
    }),
    "default"
  );
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
      tierMentionCount: 1,
      tierEnteredAt: new Date("2026-06-09T00:00:00.000Z"),
      content: text,
      summary: null,
      status: "active",
      sourceMessageIds: null,
      mentionDayKeys: null,
      lastMentionedAt: null,
      lastAccessedAt: null,
      accessCount: 0,
      createdAt: new Date("2026-06-09T00:00:00.000Z"),
      updatedAt: new Date("2026-06-09T00:00:00.000Z"),
    } as Memory,
  };
}
