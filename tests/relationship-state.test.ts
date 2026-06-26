import test from "node:test";
import assert from "node:assert/strict";
import type { RelationshipState } from "@prisma/client";
import {
  extractIdentityHints,
  relationshipLabelFromAffinity,
  relationshipPatchFromAdminBody,
} from "../src/runtime/relationship-state.service.js";

const baseRelationship: RelationshipState = {
  id: "relationship-1",
  personId: "person-1",
  relationshipLabel: "刚认识",
  affinity: 10,
  interactionStyle: "慢热但不冷淡。",
  summary: "还不熟。",
  recentSignal: null,
  statusNote: null,
  metadata: null,
  lastInteractionAt: null,
  createdAt: new Date("2026-06-14T00:00:00.000Z"),
  updatedAt: new Date("2026-06-14T00:00:00.000Z"),
};

test("relationship labels come from one affinity score", () => {
  assert.equal(relationshipLabelFromAffinity(0), "刚认识");
  assert.equal(relationshipLabelFromAffinity(20), "逐渐熟悉");
  assert.equal(relationshipLabelFromAffinity(40), "熟悉稳定");
  assert.equal(relationshipLabelFromAffinity(65), "很熟悉");
  assert.equal(relationshipLabelFromAffinity(85), "非常熟悉");
  assert.equal(relationshipLabelFromAffinity(120), "非常熟悉");
});

test("admin relationship patch only accepts affinity and text fields", () => {
  const patch = relationshipPatchFromAdminBody(baseRelationship, {
    relationshipLabel: "",
    affinity: 150,
    interactionStyle: "  更自然一点  ",
    recentSignal: "",
    familiarity: 99,
    trust: 99,
  });

  assert.deepEqual(patch, {
    relationshipLabel: "非常熟悉",
    affinity: 100,
    interactionStyle: "更自然一点",
    recentSignal: null,
  });
});

test("extracts explicit identity hints for admin review", () => {
  assert.deepEqual(extractIdentityHints("我是你之前在微信聊过的 cyan"), ["cyan"]);
  assert.deepEqual(extractIdentityHints("我叫小蓝，这次换 telegram 了"), ["小蓝"]);
  assert.deepEqual(extractIdentityHints("我是微信用户"), []);
});
