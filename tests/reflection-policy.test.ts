import test from "node:test";
import assert from "node:assert/strict";
import { applyReflectionPolicy } from "../src/reflection/reflection-policy.js";
import type { RawMemoryProposal, RawReflectionOutput } from "../src/reflection/reflection.types.js";

function proposal(index: number, overrides: Partial<RawMemoryProposal> = {}): RawMemoryProposal {
  return {
    proposalType: "create_memory",
    scope: "user",
    type: "fact",
    content: `用户提到第 ${index} 个值得复盘的信息。`,
    reason: "来自复盘消息",
    confidence: 0.1,
    riskLevel: "low",
    ...overrides,
  };
}

function rawReflectionOutput(
  proposals: RawMemoryProposal[] = []
): RawReflectionOutput {
  return {
    summary: "summary",
    newMemoryProposals: proposals,
    updateMemoryProposals: [],
    supersedeMemoryProposals: [],
    riskFlags: [],
    growthLogProposals: [
      {
        title: "低置信度成长记录",
        content: "仍交给 admin 判断。",
        confidence: 0.1,
      },
    ],
    openQuestions: [],
    confidence: 0.5,
  };
}

test("reflection policy keeps low-confidence and many proposals for admin review", () => {
  const proposals = Array.from({ length: 25 }, (_, index) => proposal(index));
  const result = applyReflectionPolicy(rawReflectionOutput(proposals));

  assert.equal(result.allowedProposals.length, 25);
  assert.equal(result.allowedProposals[0].confidence, 0.1);
  assert.equal(result.filteredCount, 0);
});

test("reflection policy still filters forbidden and high-risk boundary proposals", () => {
  const result = applyReflectionPolicy(
    rawReflectionOutput([
      proposal(1, { content: "假装真人这件事应该被记住。" }),
      proposal(2, { type: "boundary", riskLevel: "high" }),
      proposal(3, { content: "正常提案" }),
    ])
  );

  assert.deepEqual(
    result.allowedProposals.map((item) => item.content),
    ["正常提案"]
  );
  assert.equal(result.filteredCount, 2);
});

test("reflection policy keeps growth logs for admin review", () => {
  const result = applyReflectionPolicy(rawReflectionOutput());
  assert.equal(result.allowedGrowthLogs.length, 1);
});
