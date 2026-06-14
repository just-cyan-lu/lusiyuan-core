import test from "node:test";
import assert from "node:assert/strict";
import type { RelationshipState } from "@prisma/client";
import { deriveRelationshipStatePatch } from "../src/runtime/relationship-state.service.js";

const baseRelationship: RelationshipState = {
  id: "relationship-1",
  userId: "user-1",
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
