export type ExpressionLearningOutcome = "sent" | "skipped";
export type ExpressionLearningOwnerAction =
  | "owner_written"
  | "edited_draft"
  | "accepted_draft"
  | "skipped";

export interface ExpressionLearningInput {
  sourceRef: string;
  sourceType: string;
  sourceId?: string | null;
  platform: string;
  scene: string;
  scope?: "global" | "platform" | "scene" | "private";
  contextText: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome: ExpressionLearningOutcome;
  ownerAction: ExpressionLearningOwnerAction;
  ownerNote?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExpressionLearningAnalysis {
  lesson: string;
  reasoning: string;
  strategy: string;
  tone: string;
  avoidances: string[];
  tags: string[];
  confidence: number;
}

export interface ExpressionLearningRetrievalInput {
  platform: string;
  scene: string;
  query: string;
  limit?: number;
}

