export type ExpressionLearningOutcome = "sent" | "skipped";
export type ExpressionLearningOwnerAction =
  | "owner_written"
  | "edited_draft"
  | "accepted_draft"
  | "skipped"
  | "owner_taught";

export type ExpressionLearningStatus = "pending" | "active" | "disabled";

export interface ExpressionLearningInput {
  sourceRef: string;
  sourceType: string;
  sourceId?: string | null;
  scene: string;
  contextText: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome: ExpressionLearningOutcome;
  ownerAction: ExpressionLearningOwnerAction;
  ownerNote?: string | null;
  status?: ExpressionLearningStatus;
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
  scene: string;
  query: string;
  queryEmbedding?: Promise<number[]> | number[] | (() => Promise<number[]>);
  limit?: number;
}

export interface ExpressionLearningPracticeInput {
  scene: string;
  focus?: string | null;
}

export interface ExpressionLearningPracticeQuestion {
  scene: string;
  contextText: string;
  draftText: string | null;
  teachingFocus: string;
  expectedOwnerInput: string;
  tags: string[];
}

export interface ExpressionLearningDraftInput {
  scene: string;
  contextText: string;
}

export interface ExpressionLearningDraftOutput {
  draftText: string;
  reason: string;
  referenceExampleIds: string[];
}
