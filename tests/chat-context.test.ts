import test from "node:test";
import assert from "node:assert/strict";
import type { Message } from "@prisma/client";
import {
  compactConversationMessages,
  selectMessagesWithinCharBudget,
} from "../src/core/chat-context.js";

function message(overrides: Partial<Message>): Message {
  return {
    id: overrides.id ?? "message-1",
    conversationId: overrides.conversationId ?? "conversation-1",
    role: overrides.role ?? "user",
    content: overrides.content ?? "",
    externalMessageId: overrides.externalMessageId ?? null,
    isIntermediate: overrides.isIntermediate ?? false,
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-06-26T00:00:00.000Z"),
  };
}

test("compacts split final replies and drops intermediate messages", () => {
  const compacted = compactConversationMessages([
    message({ id: "u1", role: "user", content: "你刚才说什么？" }),
    message({
      id: "a1",
      role: "assistant",
      content: "第一段",
      metadata: { deliveryKind: "final", replyGroupId: "reply-1", segmentIndex: 0 },
    }),
    message({
      id: "i1",
      role: "assistant",
      content: "我先查一下",
      isIntermediate: true,
      metadata: { deliveryKind: "intermediate" },
    }),
    message({
      id: "a2",
      role: "assistant",
      content: "第二段",
      metadata: { deliveryKind: "final", replyGroupId: "reply-1", segmentIndex: 1 },
    }),
    message({ id: "u2", role: "user", content: "懂了" }),
  ]);

  assert.deepEqual(
    compacted.map((m) => ({ role: m.role, content: m.content })),
    [
      { role: "user", content: "你刚才说什么？" },
      { role: "assistant", content: "第一段\n第二段" },
      { role: "user", content: "懂了" },
    ]
  );
});

test("selects newest messages within the character budget", () => {
  const selected = selectMessagesWithinCharBudget(
    [
      { role: "user", content: "old" },
      { role: "assistant", content: "newer" },
      { role: "user", content: "latest" },
    ],
    20
  );

  assert.deepEqual(
    selected.map((m) => m.content),
    ["newer", "latest"]
  );
});

test("truncates the newest message when it alone exceeds the budget", () => {
  const selected = selectMessagesWithinCharBudget(
    [{ role: "user", content: "0123456789" }],
    11
  );

  assert.deepEqual(selected, [{ role: "user", content: "…456789" }]);
});
