import { createExpressionLearningTrainingRecord } from "./expression-learning-training-records.js";
import { generateExpressionLearningPracticeQuestion } from "./expression-learning.service.js";

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
  const trainingRecord = await createExpressionLearningTrainingRecord({
    sourceType: "practice_question",
    scene: question.scene,
    status: "question_generated",
    contextText: question.contextText,
    draftText: question.draftText,
    generatedQuestion: question,
    rawPayload: {
      request,
      source: input.source ?? "manual",
      batchId: input.batchId ?? null,
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
