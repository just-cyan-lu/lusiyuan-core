import test from "node:test";
import assert from "node:assert/strict";
import type { Memory } from "@prisma/client";
import {
  extractMemoryCandidateTermsFromText,
  matchedMemoryTerms,
  normalizeMemoryChanges,
  phraseSearchTermsForMessages,
  selectMemoriesForRelationshipReview,
} from "../src/dream/dream-relationship-review-organizer.js";
import type { DreamSourceMessage, RawRelationshipReviewOutput } from "../src/dream/dream.types.js";

function memory(overrides: Partial<Memory>): Memory {
  return {
    id: overrides.id ?? "memory-1",
    personId: overrides.personId ?? "person-1",
    type: overrides.type ?? "user_preference",
    scope: overrides.scope ?? "person",
    tier: overrides.tier ?? "temp",
    tierMentionCount: overrides.tierMentionCount ?? 0,
    tierEnteredAt: overrides.tierEnteredAt ?? null,
    content: overrides.content ?? "用户喜欢吃螺蛳粉。",
    summary: overrides.summary ?? null,
    status: overrides.status ?? "active",
    sourceMessageIds: overrides.sourceMessageIds ?? null,
    mentionDayKeys: overrides.mentionDayKeys ?? null,
    lastMentionedAt: overrides.lastMentionedAt ?? null,
    lastAccessedAt: overrides.lastAccessedAt ?? null,
    accessCount: overrides.accessCount ?? 0,
    createdAt: overrides.createdAt ?? new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-07-01T00:00:00.000Z"),
  };
}

function userMessage(content: string): DreamSourceMessage {
  return {
    id: "msg-1",
    role: "user",
    content,
    createdAt: new Date("2026-07-02T00:00:00.000Z"),
    userId: "user-1",
  };
}

test("extracts short Chinese entity terms for memory candidate matching", () => {
  const terms = extractMemoryCandidateTermsFromText("我不是喜欢螺蛳粉，我是不喜欢。");
  assert.equal(terms.rareTerms.has("螺蛳粉"), true);
});

test("keeps short entity terms for database phrase recall", () => {
  const terms = phraseSearchTermsForMessages([
    userMessage("前面那个记忆不对，我不是喜欢螺蛳粉，我是不喜欢。"),
  ]);

  assert.equal(terms.includes("螺蛳粉"), true);
});

test("matches old memories by short entity even when polarity is reversed", () => {
  const terms = extractMemoryCandidateTermsFromText("我不是喜欢螺蛳粉，我是不喜欢。");
  const oldMemory = memory({ content: "用户喜欢吃螺蛳粉。" });

  assert.deepEqual(matchedMemoryTerms(oldMemory, terms.rareTerms).includes("螺蛳粉"), true);
});

test("keeps short-entity matched memories in relationship review candidates", () => {
  const oldMatchedMemory = memory({
    id: "memory-luosifen",
    content: "用户喜欢吃螺蛳粉。",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const recentMemories = Array.from({ length: 80 }, (_, index) =>
    memory({
      id: `recent-${index}`,
      content: `用户最近聊过话题 ${index}。`,
      updatedAt: new Date(`2026-07-01T00:${String(index % 60).padStart(2, "0")}:00.000Z`),
    })
  );

  const selected = selectMemoriesForRelationshipReview(
    [oldMatchedMemory, ...recentMemories],
    [userMessage("我不是喜欢螺蛳粉，我是不喜欢。")]
  );

  assert.equal(selected.some((item) => item.id === oldMatchedMemory.id), true);
});

test("keeps preselected semantic memories before recent fallback memories", () => {
  const semanticMemory = memory({
    id: "semantic-old",
    content: "用户曾经认真聊过一个冷门独立游戏项目。",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const recentMemories = Array.from({ length: 80 }, (_, index) =>
    memory({
      id: `recent-${index}`,
      content: `用户最近聊过普通话题 ${index}。`,
      updatedAt: new Date(`2026-07-01T00:${String(index % 60).padStart(2, "0")}:00.000Z`),
    })
  );

  const selected = selectMemoriesForRelationshipReview(
    [semanticMemory, ...recentMemories],
    [userMessage("今天先聊点别的。")]
  );

  assert.equal(selected.some((item) => item.id === semanticMemory.id), true);
});

test("converts duplicate create memory into update when rare terms hit existing memory", () => {
  const raw: RawRelationshipReviewOutput = {
    summary: "用户纠正了旧偏好记忆。",
    confidence: 0.9,
    evidences: [],
    memoryChanges: [
      {
        proposalType: "create_memory",
        type: "user_preference",
        content: "用户不喜欢吃螺蛳粉。",
        sourceMessageIds: ["msg-1"],
      },
    ],
  };

  const changes = normalizeMemoryChanges({
    raw,
    validUserMessageIds: new Set(["msg-1"]),
    currentMemories: [
      memory({
        id: "memory-luosifen",
        type: "user_preference",
        content: "用户喜欢吃螺蛳粉。",
      }),
    ],
  });

  assert.equal(changes.length, 1);
  assert.equal(changes[0].proposalType, "update_memory");
  assert.equal(changes[0].targetMemoryId, "memory-luosifen");
});

test("converts same-fact duplicate create memory into reinforce", () => {
  const raw: RawRelationshipReviewOutput = {
    summary: "用户再次确认了旧偏好。",
    confidence: 0.9,
    evidences: [],
    memoryChanges: [
      {
        proposalType: "create_memory",
        type: "user_preference",
        content: "用户喜欢吃螺蛳粉。",
        sourceMessageIds: ["msg-1"],
      },
    ],
  };

  const changes = normalizeMemoryChanges({
    raw,
    validUserMessageIds: new Set(["msg-1"]),
    currentMemories: [
      memory({
        id: "memory-luosifen",
        type: "user_preference",
        content: "用户喜欢吃螺蛳粉。",
      }),
    ],
  });

  assert.equal(changes.length, 1);
  assert.equal(changes[0].proposalType, "reinforce_memory");
  assert.equal(changes[0].targetMemoryId, "memory-luosifen");
  assert.equal(changes[0].content, undefined);
});

test("converts unchanged update memory into reinforce", () => {
  const raw: RawRelationshipReviewOutput = {
    summary: "用户再次提到旧偏好。",
    confidence: 0.9,
    evidences: [],
    memoryChanges: [
      {
        proposalType: "update_memory",
        relationToTarget: "same_fact",
        targetMemoryId: "memory-luosifen",
        type: "user_preference",
        content: "用户喜欢吃螺蛳粉。",
        sourceMessageIds: ["msg-1"],
      },
    ],
  };

  const changes = normalizeMemoryChanges({
    raw,
    validUserMessageIds: new Set(["msg-1"]),
    currentMemories: [
      memory({
        id: "memory-luosifen",
        type: "user_preference",
        content: "用户喜欢吃螺蛳粉。",
      }),
    ],
  });

  assert.equal(changes.length, 1);
  assert.equal(changes[0].proposalType, "reinforce_memory");
  assert.equal(changes[0].targetMemoryId, "memory-luosifen");
});

test("skips updates that are only related but distinct", () => {
  const raw: RawRelationshipReviewOutput = {
    summary: "相关但不是同一条记忆。",
    confidence: 0.9,
    evidences: [],
    memoryChanges: [
      {
        proposalType: "update_memory",
        relationToTarget: "related_but_distinct",
        targetMemoryId: "memory-game",
        type: "user_preference",
        content: "用户家里收藏了很多独立游戏设定集。",
        sourceMessageIds: ["msg-1"],
      },
    ],
  };

  const changes = normalizeMemoryChanges({
    raw,
    validUserMessageIds: new Set(["msg-1"]),
    currentMemories: [
      memory({
        id: "memory-game",
        type: "user_preference",
        content: "用户喜欢玩独立游戏。",
      }),
    ],
  });

  assert.equal(changes.length, 0);
});

test("coalesces multiple changes for the same target memory", () => {
  const raw: RawRelationshipReviewOutput = {
    summary: "同一个目标只保留最终写入动作。",
    confidence: 0.9,
    evidences: [],
    memoryChanges: [
      {
        proposalType: "reinforce_memory",
        relationToTarget: "same_fact",
        targetMemoryId: "memory-luosifen",
        sourceMessageIds: ["msg-1"],
      },
      {
        proposalType: "update_memory",
        relationToTarget: "conflict",
        targetMemoryId: "memory-luosifen",
        type: "user_preference",
        content: "用户不喜欢吃螺蛳粉。",
        sourceMessageIds: ["msg-2"],
      },
    ],
  };

  const changes = normalizeMemoryChanges({
    raw,
    validUserMessageIds: new Set(["msg-1", "msg-2"]),
    currentMemories: [
      memory({
        id: "memory-luosifen",
        type: "user_preference",
        content: "用户喜欢吃螺蛳粉。",
      }),
    ],
  });

  assert.equal(changes.length, 1);
  assert.equal(changes[0].proposalType, "update_memory");
  assert.equal(changes[0].targetMemoryId, "memory-luosifen");
  assert.deepEqual(changes[0].sourceMessageIds, ["msg-1", "msg-2"]);
});

test("does not allow relationship review to edit global memories", () => {
  const raw: RawRelationshipReviewOutput = {
    summary: "全局记忆只允许参考。",
    confidence: 0.9,
    evidences: [],
    memoryChanges: [
      {
        proposalType: "update_memory",
        targetMemoryId: "global-memory",
        type: "project_context",
        content: "项目方向被更新。",
        sourceMessageIds: ["msg-1"],
      },
    ],
  };

  const changes = normalizeMemoryChanges({
    raw,
    validUserMessageIds: new Set(["msg-1"]),
    currentMemories: [
      memory({
        id: "global-memory",
        personId: null,
        scope: "global",
        type: "project_context",
        content: "项目旧方向。",
      }),
    ],
  });

  assert.equal(changes.length, 0);
});

test("accepts reinforce memory without content", () => {
  const raw: RawRelationshipReviewOutput = {
    summary: "用户再次提起旧偏好。",
    confidence: 0.8,
    evidences: [],
    memoryChanges: [
      {
        proposalType: "reinforce_memory",
        targetMemoryId: "memory-1",
        sourceMessageIds: ["msg-1"],
      },
    ],
  };

  const changes = normalizeMemoryChanges({
    raw,
    validUserMessageIds: new Set(["msg-1"]),
    currentMemories: [memory({ id: "memory-1" })],
  });

  assert.equal(changes.length, 1);
  assert.equal(changes[0].proposalType, "reinforce_memory");
  assert.equal(changes[0].content, undefined);
});
