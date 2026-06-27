import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_DREAM_FROM_TIME,
  resolveContinuousDreamFromTime,
} from "../src/dream/dream.service.js";

test("dream window starts from the previous completed job cursor", () => {
  const previousToTime = new Date("2026-06-27T03:30:00.000Z");

  assert.equal(
    resolveContinuousDreamFromTime({ toTime: previousToTime }),
    previousToTime
  );
});

test("dream window falls back to the earliest time on first run", () => {
  assert.equal(resolveContinuousDreamFromTime(null), INITIAL_DREAM_FROM_TIME);
  assert.equal(resolveContinuousDreamFromTime({ toTime: null }), INITIAL_DREAM_FROM_TIME);
});
