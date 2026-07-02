import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMemoryAgingPatch,
  buildMemoryReinforcement,
  dayKeyFromDate,
} from "../src/memory/memory-lifecycle.js";

const now = new Date("2026-07-01T08:00:00.000Z");

test("new person memories start as temp without counting the creation day as reinforcement", () => {
  const result = buildMemoryReinforcement({
    scope: "person",
    proposedTier: "long",
    sourceDayKeys: ["2026-06-30", "2026-06-30"],
    lastMentionedAt: new Date("2026-06-30T12:00:00.000Z"),
    now,
  });

  assert.equal(result.tier, "temp");
  assert.equal(result.tierMentionCount, 0);
  assert.deepEqual(result.mentionDayKeys, ["2026-06-30"]);
});

test("promotes temp memory to short after one later effective mention day", () => {
  const result = buildMemoryReinforcement({
    existing: {
      scope: "person",
      tier: "temp",
      tierMentionCount: 0,
      tierEnteredAt: new Date("2026-06-01T12:00:00.000Z"),
      mentionDayKeys: ["2026-06-01"],
      lastMentionedAt: new Date("2026-06-01T12:00:00.000Z"),
    },
    sourceDayKeys: ["2026-06-12"],
    lastMentionedAt: new Date("2026-06-12T12:00:00.000Z"),
    now,
  });

  assert.equal(result.tier, "short");
  assert.equal(result.tierMentionCount, 0);
  assert.deepEqual(result.mentionDayKeys, ["2026-06-01", "2026-06-12"]);
});

test("manual force tier respects the requested tier", () => {
  const result = buildMemoryReinforcement({
    existing: {
      scope: "person",
      tier: "temp",
      tierMentionCount: 0,
      tierEnteredAt: new Date("2026-06-01T12:00:00.000Z"),
      mentionDayKeys: ["2026-06-01"],
      lastMentionedAt: new Date("2026-06-01T12:00:00.000Z"),
    },
    proposedTier: "long",
    forceTier: true,
    sourceDayKeys: [],
    now,
  });

  assert.equal(result.tier, "long");
  assert.equal(result.tierMentionCount, 0);
  assert.equal(result.tierEnteredAt?.toISOString(), now.toISOString());
});

test("promotes short memory to mid after five effective mention days", () => {
  const result = buildMemoryReinforcement({
    existing: {
      scope: "person",
      tier: "short",
      tierMentionCount: 4,
      tierEnteredAt: new Date("2026-06-01T12:00:00.000Z"),
      mentionDayKeys: ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22"],
      lastMentionedAt: new Date("2026-06-22T12:00:00.000Z"),
    },
    sourceDayKeys: ["2026-06-30"],
    lastMentionedAt: new Date("2026-06-30T12:00:00.000Z"),
    now,
  });

  assert.equal(result.tier, "mid");
  assert.equal(result.tierMentionCount, 0);
  assert.deepEqual(result.mentionDayKeys, [
    "2026-06-01",
    "2026-06-08",
    "2026-06-15",
    "2026-06-22",
    "2026-06-30",
  ]);
});

test("promotes mid memory to long after five effective mid mentions", () => {
  const result = buildMemoryReinforcement({
    existing: {
      scope: "person",
      tier: "mid",
      tierMentionCount: 4,
      tierEnteredAt: new Date("2026-04-01T12:00:00.000Z"),
      mentionDayKeys: ["2026-04-01", "2026-04-15", "2026-05-01", "2026-05-15"],
      lastMentionedAt: new Date("2026-05-15T12:00:00.000Z"),
    },
    sourceDayKeys: ["2026-06-30"],
    lastMentionedAt: new Date("2026-06-30T12:00:00.000Z"),
    now,
  });

  assert.equal(result.tier, "long");
  assert.equal(result.tierMentionCount, 0);
});

test("does not count an already counted day again", () => {
  const result = buildMemoryReinforcement({
    existing: {
      scope: "person",
      tier: "short",
      tierMentionCount: 3,
      tierEnteredAt: new Date("2026-06-01T12:00:00.000Z"),
      mentionDayKeys: ["2026-06-01", "2026-06-08", "2026-06-15"],
      lastMentionedAt: new Date("2026-06-15T12:00:00.000Z"),
    },
    sourceDayKeys: ["2026-06-15"],
    lastMentionedAt: new Date("2026-06-15T18:00:00.000Z"),
    now,
  });

  assert.equal(result.tier, "short");
  assert.equal(result.tierMentionCount, 3);
  assert.deepEqual(result.mentionDayKeys, [
    "2026-06-01",
    "2026-06-08",
    "2026-06-15",
  ]);
});

test("keeps temp memories before five active chat days", () => {
  const patch = buildMemoryAgingPatch(
    {
      scope: "person",
      status: "active",
      tier: "temp",
      tierMentionCount: 0,
      tierEnteredAt: new Date("2026-06-01T12:00:00.000Z"),
      lastMentionedAt: new Date("2026-06-01T12:00:00.000Z"),
    },
    { now, activeDayCountSinceWindowStart: 4 }
  );

  assert.equal(patch, null);
});

test("archives temp memories after five active chat days without a hit", () => {
  const patch = buildMemoryAgingPatch(
    {
      scope: "person",
      status: "active",
      tier: "temp",
      tierMentionCount: 0,
      tierEnteredAt: new Date("2026-06-01T12:00:00.000Z"),
      lastMentionedAt: new Date("2026-06-01T12:00:00.000Z"),
    },
    { now, activeDayCountSinceWindowStart: 5 }
  );

  assert.equal(patch?.status, "archived");
});

test("demotes expired short memories to temp by active chat days", () => {
  const patch = buildMemoryAgingPatch(
    {
      scope: "person",
      status: "active",
      tier: "short",
      tierMentionCount: 2,
      tierEnteredAt: new Date("2026-05-15T12:00:00.000Z"),
      lastMentionedAt: new Date("2026-05-15T12:00:00.000Z"),
    },
    { now, activeDayCountSinceWindowStart: 10 }
  );

  assert.equal(patch?.tier, "temp");
  assert.equal(patch?.tierMentionCount, 0);
});

test("demotes expired mid memories to short by active chat days", () => {
  const patch = buildMemoryAgingPatch(
    {
      scope: "person",
      status: "active",
      tier: "mid",
      tierMentionCount: 2,
      tierEnteredAt: new Date("2026-02-01T12:00:00.000Z"),
      lastMentionedAt: new Date("2026-02-01T12:00:00.000Z"),
    },
    { now, activeDayCountSinceWindowStart: 60 }
  );

  assert.equal(patch?.tier, "short");
  assert.equal(patch?.tierMentionCount, 0);
});

test("demotes expired long memories to mid by active chat days", () => {
  const patch = buildMemoryAgingPatch(
    {
      scope: "person",
      status: "active",
      tier: "long",
      tierMentionCount: 1,
      tierEnteredAt: new Date("2025-01-01T12:00:00.000Z"),
      lastMentionedAt: new Date("2025-01-01T12:00:00.000Z"),
    },
    { now, activeDayCountSinceWindowStart: 365 }
  );

  assert.equal(patch?.tier, "mid");
  assert.equal(patch?.tierMentionCount, 0);
});

test("formats UTC day keys consistently", () => {
  assert.equal(dayKeyFromDate(new Date("2026-07-01T23:59:59.000Z")), "2026-07-01");
});
