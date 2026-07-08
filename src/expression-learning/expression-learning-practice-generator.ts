import { createExpressionLearningTrainingRecord } from "./expression-learning-training-records.js";
import {
  generateExpressionLearningDraft,
  generateExpressionLearningPracticeQuestion,
} from "./expression-learning.service.js";

export interface ExpressionLearningPracticeGenerationInput {
  scene: string;
  focus?: string | null;
  source?: string;
  batchId?: string;
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.round(value), 1), 20);
}

export async function generateAndStoreExpressionLearningPracticeQuestion(
  input: ExpressionLearningPracticeGenerationInput
) {
  const request = {
    scene: input.scene,
    focus: input.focus ?? null,
  };
  const question = await generateExpressionLearningPracticeQuestion(request);
  const draft = await generateExpressionLearningDraft({
    scene: question.scene,
    contextText: question.contextText,
  });
  const trainingRecord = await createExpressionLearningTrainingRecord({
    sourceType: "practice_question",
    scene: question.scene,
    status: "question_generated",
    contextText: question.contextText,
    draftText: draft.draftText,
    generatedQuestion: question,
    generatedDraft: draft,
    rawPayload: {
      request,
      source: input.source ?? "manual",
      batchId: input.batchId ?? null,
      draftReferenceExampleIds: draft.referenceExampleIds,
    },
  });
  return { question, trainingRecord };
}

export async function generateExpressionLearningPracticeQuestionBatch(input: {
  count: number;
  scene: string;
  focus?: string | null;
  source?: string;
  batchId?: string;
}) {
  const count = normalizeCount(input.count);
  const items = [];
  for (let index = 0; index < count; index++) {
    items.push(
      await generateAndStoreExpressionLearningPracticeQuestion({
        scene: input.scene,
        focus: input.focus ?? null,
        source: input.source,
        batchId: input.batchId,
      })
    );
  }
  return items;
}
