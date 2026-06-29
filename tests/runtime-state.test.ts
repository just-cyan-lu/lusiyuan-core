import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveRuntimeEventFromChatTurn,
  moodLabelFromEnergyLevel,
} from "../src/runtime/runtime-state.service.js";

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

test("records owner chat as observation material without changing runtime state", () => {
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
  assert.equal(impact.canMutateRuntimeState, false);
  assert.equal(impact.mutationGate, "owner_chat_observe_only");
  assert.equal(event.topic, "运行体结构和项目实现");
});

test("chat runtime events keep candidate deltas only as future material", () => {
  const event = deriveRuntimeEventFromChatTurn({
    userId: "owner-1",
    conversationId: "conversation-1",
    channel: "web",
    userMessage: "今天真的好累，但这个项目也挺有意思的",
    assistantReply: "那我们慢一点，把它拆成能做的小块。",
    isOwner: true,
  });

  const impact = event.stateImpact as Record<string, unknown>;
  const deltas = impact.candidateDeltas as Record<string, unknown>;

  assert.equal(impact.canMutateRuntimeState, false);
  assert.equal(typeof deltas.energyLevel, "number");
  assert.match(String(impact.note), /聊天只记录 RuntimeEvent/);
});

test("maps energy level to mood label", () => {
  assert.equal(moodLabelFromEnergyLevel(5), "很低电");
  assert.equal(moodLabelFromEnergyLevel(28), "安静，需要缓一缓");
  assert.equal(moodLabelFromEnergyLevel(44), "有点累，但稳定");
  assert.equal(moodLabelFromEnergyLevel(62), "平稳在线");
  assert.equal(moodLabelFromEnergyLevel(74), "被点亮了一点");
  assert.equal(moodLabelFromEnergyLevel(95), "兴致很高");
});
