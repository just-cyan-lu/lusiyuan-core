import type { Memory } from "@prisma/client";

export interface RetrievedMemory {
  memory: Memory;
  semanticScore: number;
  finalScore: number;
}

interface RankedCandidate {
  memory: Memory;
  semanticScore: number;
}

const TYPE_BOOST: Record<string, number> = {
  technical_decision: 0.85,
  project_context: 0.8,
  user_preference: 0.75,
  personal_fact: 0.7,
  recurring_topic: 0.7,
  boundary: 0.7,
  growth_event: 0.55,
};

const SCOPE_BOOST: Record<string, number> = {
  person: 0.9,
  project: 0.75,
  topic: 0.7,
  global: 0.65,
};

const TIER_BOOST: Record<string, number> = {
  long: 1.0,
  mid: 0.75,
  short: 0.55,
};

const WEIGHTS = {
  semantic: 0.58,
  importance: 0.12,
  recency: 0.10,
  typeBoost: 0.08,
  scopeBoost: 0.06,
  tier: 0.04,
  confidence: 0.02,
};

export function rerankMemories(candidates: RankedCandidate[]): RetrievedMemory[] {
  const now = Date.now();
  const RECENCY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  return candidates
    .map(({ memory, semanticScore }) => {
      const m = memory as Memory & {
        scope?: string;
        confidence?: number;
        status?: string;
        tier?: string;
        strength?: number;
      };

      const importanceScore = (memory.importance ?? 5) / 10;
      const strengthScore = Math.min(Math.max(m.strength ?? 1, 0), 10) / 10;

      const ageMs = now - new Date(memory.createdAt).getTime();
      const recencyScore = Math.exp(-ageMs / RECENCY_HALF_LIFE_MS);

      const typeScore = TYPE_BOOST[memory.type] ?? 0.5;
      const scopeScore = SCOPE_BOOST[m.scope ?? "person"] ?? 0.7;
      const tierScore = Math.max(TIER_BOOST[m.tier ?? "short"] ?? 0.55, strengthScore);
      const confidenceScore = m.confidence ?? 0.8;

      const finalScore =
        WEIGHTS.semantic * semanticScore +
        WEIGHTS.importance * importanceScore +
        WEIGHTS.recency * recencyScore +
        WEIGHTS.typeBoost * typeScore +
        WEIGHTS.scopeBoost * scopeScore +
        WEIGHTS.tier * tierScore +
        WEIGHTS.confidence * confidenceScore;

      return { memory, semanticScore, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
