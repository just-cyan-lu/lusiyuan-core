import test from "node:test";
import assert from "node:assert/strict";
import {
  getStringArray,
  memoryProposalRequiresPerson,
  resolveMemoryProposalPersonId,
  type MemoryProposalPersonLookup,
} from "../src/memory/memory-proposal-person-resolver.js";

function lookup(overrides: Partial<MemoryProposalPersonLookup> = {}): MemoryProposalPersonLookup {
  return {
    findTargetMemoryPersonId: async () => null,
    findSourceMessagePersonId: async () => null,
    findReportJobScope: async () => null,
    findPersonId: async () => null,
    findUserPersonId: async () => null,
    findConversationPersonId: async () => null,
    ...overrides,
  };
}

test("only person scoped proposals require a person", () => {
  assert.equal(memoryProposalRequiresPerson("person"), true);
  assert.equal(memoryProposalRequiresPerson("project"), false);
  assert.equal(memoryProposalRequiresPerson("global"), false);
  assert.equal(memoryProposalRequiresPerson("topic"), false);
});

test("filters JSON arrays down to strings", () => {
  assert.deepEqual(getStringArray(["msg_1", 7, "msg_2", null]), [
    "msg_1",
    "msg_2",
  ]);
  assert.deepEqual(getStringArray("msg_1"), []);
});

test("returns null for non-person scoped proposals", async () => {
  const result = await resolveMemoryProposalPersonId(
    {
      id: "proposal_1",
      scope: "global",
      reportId: "report_1",
    },
    lookup()
  );
  assert.equal(result, null);
});

test("prefers explicit proposal person when present", async () => {
  const result = await resolveMemoryProposalPersonId(
    {
      id: "proposal_1",
      scope: "person",
      reportId: "report_1",
      personId: "person_1",
      targetMemoryId: "memory_1",
    },
    lookup({
      findPersonId: async () => "person_from_proposal",
      findTargetMemoryPersonId: async () => "person_from_target",
    })
  );
  assert.equal(result, "person_from_proposal");
});

test("falls back to target memory person", async () => {
  const result = await resolveMemoryProposalPersonId(
    {
      id: "proposal_1",
      scope: "person",
      reportId: "report_1",
      targetMemoryId: "memory_1",
    },
    lookup({
      findTargetMemoryPersonId: async () => "person_from_target",
    })
  );
  assert.equal(result, "person_from_target");
});

test("falls back to source message person", async () => {
  const result = await resolveMemoryProposalPersonId(
    {
      id: "proposal_1",
      scope: "person",
      reportId: "report_1",
      sourceMessageIds: ["msg_1"],
    },
    lookup({
      findSourceMessagePersonId: async (messageIds) =>
        messageIds.includes("msg_1") ? "person_from_message" : null,
    })
  );
  assert.equal(result, "person_from_message");
});

test("falls back through report job user and conversation", async () => {
  const fromJobUser = await resolveMemoryProposalPersonId(
    {
      id: "proposal_1",
      scope: "person",
      reportId: "report_1",
    },
    lookup({
      findReportJobScope: async () => ({
        userId: "telegram:123",
        conversationId: "telegram:chat-1",
      }),
      findUserPersonId: async () => "person_from_job_user",
    })
  );
  assert.equal(fromJobUser, "person_from_job_user");

  const fromConversation = await resolveMemoryProposalPersonId(
    {
      id: "proposal_2",
      scope: "person",
      reportId: "report_2",
    },
    lookup({
      findReportJobScope: async () => ({
        userId: null,
        conversationId: "telegram:chat-2",
      }),
      findConversationPersonId: async () => "person_from_conversation",
    })
  );
  assert.equal(fromConversation, "person_from_conversation");
});

test("throws when a person scoped proposal has no resolvable person", async () => {
  await assert.rejects(
    () =>
      resolveMemoryProposalPersonId(
        {
          id: "proposal_missing",
          scope: "person",
          reportId: "report_missing",
        },
        lookup()
      ),
    /Cannot resolve personId/
  );
});
