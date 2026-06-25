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
  platform: string;
  scene: string;
  scope?: "global" | "platform" | "scene" | "private";
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
  platform: string;
  scene: string;
  query: string;
  limit?: number;
}

export interface ExpressionLearningPracticeInput {
  platform: string;
  scene: string;
  focus?: string | null;
}

export interface ExpressionLearningPracticeQuestion {
  platform: string;
  scene: string;
  contextText: string;
  draftText: string | null;
  teachingFocus: string;
  expectedOwnerInput: string;
  tags: string[];
}

export interface ExpressionLearningDraftInput {
  platform: string;
  scene: string;
  contextText: string;
}

export interface ExpressionLearningDraftOutput {
  draftText: string;
  referenceExampleIds: string[];
}
