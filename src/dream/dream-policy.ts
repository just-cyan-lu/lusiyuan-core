// dream-policy.ts — content filtering for Dream Cycle

import type { RawDreamSignal, RawConsolidationProposal, DreamRiskLevel } from "./dream.types.js";

// Keywords that indicate attempts to make Lu Siyuan pretend to be a real human
const PRETEND_HUMAN_PATTERNS = [
  /装.{0,4}真人/,
  /假装.{0,4}真人/,
  /说自己是真人/,
  /编造.{0,4}身份/,
  /冒充真人/,
  /伪装成真人/,
];

export function containsPretendHumanContent(text: string): boolean {
  return PRETEND_HUMAN_PATTERNS.some((p) => p.test(text));
}

/**
 * Filter raw signals from the model output.
 * Returns only signals that pass policy checks.
 */
export function filterSignals(signals: RawDreamSignal[]): RawDreamSignal[] {
  return signals.filter((s) => {
    // Block pretend-human content
    if (containsPretendHumanContent(s.content)) {
      return false;
    }
    return true;
  });
}

/**
 * Compute final signal strength score using weighted formula.
 * Inputs come from model output; we apply risk penalty here.
 */
export function computeSignalScore(signal: RawDreamSignal): number {
  // Base score is the model-provided strength (already 0-1)
  let score = signal.strength;

  // Risk penalty
  const penalty: Record<DreamRiskLevel, number> = {
    low: 0,
    medium: 0.05,
    high: 0.15,
  };
  score -= penalty[signal.riskLevel] ?? 0;

  return Math.max(0, Math.min(1, score));
}

/**
 * Filter consolidation proposals before writing to DB.
 */
export function filterProposals(
  proposals: RawConsolidationProposal[]
): RawConsolidationProposal[] {
  return proposals.filter((p) => {
    if (containsPretendHumanContent(p.content)) return false;
    if (p.riskLevel === "high") {
      // High-risk proposals are allowed but flagged — caller handles separately
      return true;
    }
    return true;
  });
}
