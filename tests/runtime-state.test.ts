import test from "node:test";
import assert from "node:assert/strict";
import type { RuntimeState } from "@prisma/client";
import {
  deriveRuntimeEventFromChatTurn,
  deriveRuntimeStatePatch,
  validateRuntimeStateProposal,
} from "../src/runtime/runtime-state.service.js";

const baseState: RuntimeState = {
  id: "runtime-1",
  key: "global",
  moodLabel: "平稳",
  moodScore: 10,
  energyLevel: 62,
  currentGoal: "自然聊天。",
  currentFocus: "日常聊天。",
  currentActivity: "待机。",
  recentEventSummary: null,
  statusNote: null,
  updateMode: "balanced",
  updateStrategy: "rules",
  metadata: null,
  createdAt: new Date("2026-06-12T00:00:00.000Z"),
  updatedAt: new Date("2026-06-12T00:00:00.000Z"),
};

test("derives an emotional runtime patch from tired user messages", () => {
  const patch = deriveRuntimeStatePatch(baseState, {
    userId: "user-1",
    conversationId: "conversation-1",
    channel: "web",
    userMessage: "今天真的好累，感觉没人懂我",
    assistantReply: "我在，先别急着撑住。",
  });

  assert.equal(patch.moodLabel, "有点担心，但在认真接住");
  assert.equal(patch.currentFocus, "对方当下的情绪和需要被接住的部分");
  assert.equal(patch.currentActivity, "陪对方待在情绪里，不急着给答案。");
  assert.ok((patch.energyLevel ?? 100) < baseState.energyLevel);
});

test("derives a focused runtime patch from runtime design messages", () => {
  const patch = deriveRuntimeStatePatch(baseState, {
    userId: "user-1",
    conversationId: "conversation-1",
    channel: "web",
    userMessage: "我们先做 RuntimeState 数据库和 admin 页面",
    assistantReply: "可以，我先把运行态落成正式骨架。",
  });

  assert.equal(patch.moodLabel, "专注、有点被点亮");
  assert.equal(patch.currentFocus, "运行体结构和项目实现");
  assert.equal(patch.currentGoal, "把陆思源的持续状态系统做稳。");
  assert.ok((patch.energyLevel ?? 0) > baseState.energyLevel);
});

test("records ordinary chat as runtime event without global state mutation permission", () => {
  const event = deriveRuntimeEventFromChatTurn({
    userId: "user-1",
    conversationId: "conversation-1",
    channel: "web",
    userMessage: "今天真的好累，感觉没人懂我",
    assistantReply: "我在，先别急着撑住。",
    isOwner: false,
  });

  const impact = event.stateImpact as Record<string, unknown>;

  assert.equal(event.eventType, "chat_turn");
  assert.equal(event.source, "chat");
  assert.equal(impact.canMutateRuntimeState, false);
  assert.equal(impact.mutationGate, "ordinary_chat_observe_only");
});

test("marks owner chat events as eligible for controlled runtime state updates", () => {
  const event = deriveRuntimeEventFromChatTurn({
    userId: "owner-1",
    conversationId: "conversation-1",
    channel: "web",
    userMessage: "我们继续调整思源的运行体和数据库结构",
    assistantReply: "可以，我把状态入口收束好。",
    isOwner: true,
  });

  const impact = event.stateImpact as Record<string, unknown>;

  assert.equal(event.source, "owner_chat");
  assert.equal(impact.canMutateRuntimeState, true);
  assert.equal(impact.mutationGate, "owner_chat_allowed");
  assert.equal(event.topic, "运行体结构和项目实现");
});

test("validates LLM runtime proposals with bounded numeric changes", () => {
  const validated = validateRuntimeStateProposal(baseState, {
    summary: "用户在讨论运行体，让状态更专注。",
    confidence: 0.9,
    patch: {
      moodLabel: "突然极端低落但又满电",
      moodScore: -100,
      energyLevel: 0,
      currentFocus: "LLM 提议的运行体状态校准",
      updateStrategy: "llm",
    },
    details: {
      innerWeather: "专注但带一点压力",
      emotionalTones: ["专注", "紧张"],
      needs: ["更清楚的结构"],
      tensions: ["想复杂一点，但不能失控"],
      openQuestions: ["哪些状态应该入库？"],
      relationshipSignal: "协作关系稳定",
      topicSignals: ["runtime", "statePatch"],
    },
  });

  assert.equal(validated.patch.moodScore, 0);
  assert.equal(validated.patch.energyLevel, 52);
  assert.deepEqual(validated.rejectedFields, ["updateStrategy"]);
  assert.match(JSON.stringify(validated.patch.metadata), /innerWeather/);
});

test("rejects invalid numeric values from LLM runtime proposals", () => {
  const validated = validateRuntimeStateProposal(baseState, {
    patch: {
      moodScore: "not-a-number" as unknown as number,
      energyLevel: Number.NaN,
    },
  });

  assert.equal(validated.patch.moodScore, undefined);
  assert.equal(validated.patch.energyLevel, undefined);
  assert.deepEqual(validated.rejectedFields, ["moodScore", "energyLevel"]);
});
