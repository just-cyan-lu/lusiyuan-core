import test from "node:test";
import assert from "node:assert/strict";
import { moodLabelFromEnergyLevel } from "../src/runtime/runtime-state.service.js";

test("maps energy level to mood label", () => {
  assert.equal(moodLabelFromEnergyLevel(5), "很低电");
  assert.equal(moodLabelFromEnergyLevel(28), "安静，需要缓一缓");
  assert.equal(moodLabelFromEnergyLevel(44), "有点累，但稳定");
  assert.equal(moodLabelFromEnergyLevel(62), "平稳在线");
  assert.equal(moodLabelFromEnergyLevel(74), "被点亮了一点");
  assert.equal(moodLabelFromEnergyLevel(95), "兴致很高");
});
