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
  boundary: 1.0,
  core: 1.0,
  technical_decision: 0.8,
  project_context: 0.7,
  user_preference: 0.6,
  relationship: 0.5,
  growth_event: 0.4,
};

const SCOPE_BOOST: Record<string, number> = {
  global: 1.0,
  project: 0.9,
  user: 0.7,
  relationship: 0.6,
};

const WEIGHTS = {
  semantic: 0.45,
  importance: 0.15,
  recency: 0.10,
  typeBoost: 0.15,
  scopeBoost: 0.10,
  confidence: 0.05,
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
      };

      const importanceScore = (memory.importance ?? 5) / 10;

      const ageMs = now - new Date(memory.createdAt).getTime();
      const recencyScore = Math.exp(-ageMs / RECENCY_HALF_LIFE_MS);

      const typeScore = TYPE_BOOST[memory.type] ?? 0.5;
      const scopeScore = SCOPE_BOOST[m.scope ?? "user"] ?? 0.7;
      const confidenceScore = m.confidence ?? 0.8;

      const finalScore =
        WEIGHTS.semantic * semanticScore +
        WEIGHTS.importance * importanceScore +
        WEIGHTS.recency * recencyScore +
        WEIGHTS.typeBoost * typeScore +
        WEIGHTS.scopeBoost * scopeScore +
        WEIGHTS.confidence * confidenceScore;

      return { memory, semanticScore, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
