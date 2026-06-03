import test from "node:test";
import assert from "node:assert/strict";
import {
  getStringArray,
  memoryProposalRequiresUser,
  resolveMemoryProposalUserId,
  type MemoryProposalUserLookup,
} from "../src/reflection/memory-proposal-user-resolver.js";

function lookup(overrides: Partial<MemoryProposalUserLookup> = {}): MemoryProposalUserLookup {
  return {
    findTargetMemoryUserId: async () => null,
    findSourceMessageUserId: async () => null,
    findReportJobScope: async () => null,
    findUserInternalId: async () => null,
    findConversationUserId: async () => null,
    ...overrides,
  };
}

test("only user and relationship scoped proposals require a user", () => {
  assert.equal(memoryProposalRequiresUser("user"), true);
  assert.equal(memoryProposalRequiresUser("relationship"), true);
  assert.equal(memoryProposalRequiresUser("project"), false);
  assert.equal(memoryProposalRequiresUser("global"), false);
});

test("filters JSON arrays down to strings", () => {
  assert.deepEqual(getStringArray(["msg_1", 7, "msg_2", null]), [
    "msg_1",
    "msg_2",
  ]);
  assert.deepEqual(getStringArray("msg_1"), []);
});

test("returns null for non-user scoped proposals", async () => {
  const result = await resolveMemoryProposalUserId(
    {
      id: "proposal_1",
      scope: "global",
      reportId: "report_1",
    },
    lookup()
  );
  assert.equal(result, null);
});

test("prefers the target memory user when present", async () => {
  const result = await resolveMemoryProposalUserId(
    {
      id: "proposal_1",
      scope: "user",
      reportId: "report_1",
      targetMemoryId: "memory_1",
    },
    lookup({
      findTargetMemoryUserId: async () => "internal_user_1",
    })
  );
  assert.equal(result, "internal_user_1");
});

test("prefers proposal ownership before legacy fallbacks", async () => {
  const result = await resolveMemoryProposalUserId(
    {
      id: "proposal_1",
      scope: "user",
      reportId: "report_1",
      userId: "telegram:123",
      targetMemoryId: "memory_1",
    },
    lookup({
      findUserInternalId: async () => "internal_user_from_proposal",
      findTargetMemoryUserId: async () => "internal_user_from_target",
    })
  );
  assert.equal(result, "internal_user_from_proposal");
});

test("falls back to source message user", async () => {
  const result = await resolveMemoryProposalUserId(
    {
      id: "proposal_1",
      scope: "user",
      reportId: "report_1",
      sourceMessageIds: ["msg_1"],
    },
    lookup({
      findSourceMessageUserId: async (messageIds) =>
        messageIds.includes("msg_1") ? "internal_user_2" : null,
    })
  );
  assert.equal(result, "internal_user_2");
});

test("falls back through report job user and conversation", async () => {
  const fromJobUser = await resolveMemoryProposalUserId(
    {
      id: "proposal_1",
      scope: "user",
      reportId: "report_1",
    },
    lookup({
      findReportJobScope: async () => ({
        userId: "telegram:123",
        conversationId: "telegram:chat-1",
      }),
      findUserInternalId: async () => "internal_user_3",
    })
  );
  assert.equal(fromJobUser, "internal_user_3");

  const fromConversation = await resolveMemoryProposalUserId(
    {
      id: "proposal_2",
      scope: "user",
      reportId: "report_2",
    },
    lookup({
      findReportJobScope: async () => ({
        userId: null,
        conversationId: "telegram:chat-2",
      }),
      findConversationUserId: async () => "internal_user_4",
    })
  );
  assert.equal(fromConversation, "internal_user_4");
});

test("throws when a user scoped proposal has no resolvable user", async () => {
  await assert.rejects(
    () =>
      resolveMemoryProposalUserId(
        {
          id: "proposal_missing",
          scope: "user",
          reportId: "report_missing",
        },
        lookup()
      ),
    /Cannot resolve userId/
  );
});
