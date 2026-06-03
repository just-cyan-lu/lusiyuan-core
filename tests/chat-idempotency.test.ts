import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDuplicatedChatOutput,
  buildExternalMessageLookup,
  isPrismaUniqueConstraintError,
} from "../src/core/chat-idempotency.js";

test("builds a channel and conversation scoped duplicate lookup", () => {
  assert.deepEqual(
    buildExternalMessageLookup({
      channel: "telegram",
      conversation_id: "telegram:chat-1",
      external_message_id: "42",
    }),
    {
      externalMessageId: "42",
      conversation: {
        is: {
          channel: "telegram",
          externalConversationId: "telegram:chat-1",
        },
      },
    }
  );
});

test("does not build a duplicate lookup without external message id", () => {
  assert.equal(
    buildExternalMessageLookup({
      channel: "web",
      conversation_id: "web:conv",
    }),
    null
  );
});

test("builds duplicated chat output", () => {
  assert.deepEqual(buildDuplicatedChatOutput("telegram:chat-1"), {
    reply: "",
    conversation_id: "telegram:chat-1",
    memory_written: false,
    duplicated: true,
  });
});

test("detects Prisma unique constraint errors without importing Prisma runtime", () => {
  assert.equal(isPrismaUniqueConstraintError({ code: "P2002" }), true);
  assert.equal(isPrismaUniqueConstraintError({ code: "P2003" }), false);
  assert.equal(isPrismaUniqueConstraintError(new Error("P2002")), false);
});
