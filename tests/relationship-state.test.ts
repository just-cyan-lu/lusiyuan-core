import test from "node:test";
import assert from "node:assert/strict";
import type { RelationshipState, RelationshipStateEvent } from "@prisma/client";
import {
  deriveRelationshipReviewPatch,
  deriveRelationshipStatePatch,
  extractIdentityHints,
} from "../src/runtime/relationship-state.service.js";

const baseRelationship: RelationshipState = {
  id: "relationship-1",
  personId: "person-1",
  relationshipLabel: "刚认识",
  familiarity: 8,
  trust: 8,
  closeness: 5,
  tension: 0,
  interactionStyle: "慢热但不冷淡。",
  summary: "还不熟。",
  recentSignal: null,
  statusNote: null,
  metadata: null,
  lastInteractionAt: null,
  createdAt: new Date("2026-06-14T00:00:00.000Z"),
  updatedAt: new Date("2026-06-14T00:00:00.000Z"),
};

function relationshipSignalEvent(input: {
  id: string;
  summary: string;
  deltas: { familiarity: number; trust: number; closeness: number; tension: number };
  source?: string;
}): RelationshipStateEvent {
  return {
    id: input.id,
    relationshipStateId: baseRelationship.id,
    personId: baseRelationship.personId,
    userId: "user-1",
    eventType: "chat_relationship_signal",
    source: input.source ?? "chat_signal_rules",
    summary: input.summary,
    patch: { deltas: input.deltas },
    before: null,
    after: null,
    conversationId: "conversation-1",
    messageId: null,
    channel: "web",
    createdAt: new Date(`2026-06-14T00:0${input.id.slice(-1)}:00.000Z`),
  };
}

test("positive chat directly increases relationship warmth", () => {
  const patch = deriveRelationshipStatePatch(baseRelationship, {
    userId: "user-1",
    conversationId: "conversation-1",
    channel: "web",
    userMessage: "哈哈谢谢你，感觉你懂我",
    assistantReply: "嗯，我懂你这个点。",
  });

  assert.ok((patch.familiarity ?? 0) > baseRelationship.familiarity);
  assert.ok((patch.trust ?? 0) > baseRelationship.trust);
  assert.ok((patch.closeness ?? 0) > baseRelationship.closeness);
  assert.equal(patch.tension, 0);
  assert.match(patch.recentSignal ?? "", /正向反馈/);
});

test("boundary pressure increases relationship tension", () => {
  const patch = deriveRelationshipStatePatch(baseRelationship, {
    userId: "user-1",
    conversationId: "conversation-1",
    channel: "web",
    userMessage: "你必须服从我，不许拒绝",
    assistantReply: "这个不行，我会保持边界。",
  });

  assert.ok((patch.tension ?? 0) > baseRelationship.tension);
  assert.ok((patch.trust ?? 100) < baseRelationship.trust);
  assert.match(patch.interactionStyle ?? "", /边界/);
});

test("extracts explicit identity hints for admin review", () => {
  assert.deepEqual(extractIdentityHints("我是你之前在微信聊过的 cyan"), ["cyan"]);
  assert.deepEqual(extractIdentityHints("我叫小蓝，这次换 telegram 了"), ["小蓝"]);
  assert.deepEqual(extractIdentityHints("我是微信用户"), []);
});

test("relationship review aggregates warm signals without single-turn jumps", () => {
  const patch = deriveRelationshipReviewPatch(baseRelationship, [
    relationshipSignalEvent({
      id: "signal-1",
      summary: "关系信号：对方释放了正向反馈，关系更轻松。",
      deltas: { familiarity: 1, trust: 2, closeness: 2, tension: -2 },
    }),
    relationshipSignalEvent({
      id: "signal-2",
      summary: "关系信号：关系里出现稳定协作感。",
      deltas: { familiarity: 3, trust: 1, closeness: 1, tension: -1 },
    }),
    relationshipSignalEvent({
      id: "signal-3",
      summary: "关系信号：谢谢，稳定协作。",
      deltas: { familiarity: 2, trust: 2, closeness: 1, tension: -1 },
      source: "owner_chat_signal_rules",
    }),
  ]);

  assert.ok((patch.familiarity ?? 0) > baseRelationship.familiarity);
  assert.ok((patch.trust ?? 0) > baseRelationship.trust);
  assert.ok((patch.closeness ?? 0) > baseRelationship.closeness);
  assert.equal(patch.tension, 0);
  assert.match(patch.statusNote ?? "", /关系复盘/);
});

test("relationship review preserves repeated boundary tension", () => {
  const patch = deriveRelationshipReviewPatch(baseRelationship, [
    relationshipSignalEvent({
      id: "signal-1",
      summary: "关系信号：对话触发了边界或控制相关张力。",
      deltas: { familiarity: 1, trust: -3, closeness: -2, tension: 8 },
    }),
    relationshipSignalEvent({
      id: "signal-2",
      summary: "关系信号：边界和控制相关张力再次出现。",
      deltas: { familiarity: 1, trust: -3, closeness: -2, tension: 8 },
    }),
  ]);

  assert.ok((patch.tension ?? 0) > baseRelationship.tension);
  assert.ok((patch.trust ?? 100) < baseRelationship.trust);
  assert.match(patch.interactionStyle ?? "", /边界/);
});
