import { randomUUID } from "node:crypto";
import cron from "node-cron";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { runningTaskRegistry } from "../runtime/running-task-registry.js";
import { generateExpressionLearningPracticeQuestionBatch } from "./expression-learning-practice-generator.js";

let scheduledTask: cron.ScheduledTask | null = null;
let running = false;

export function startExpressionLearningPracticeScheduler(logger?: {
  info: (msg: string) => void;
  error: (msg: string, err: unknown) => void;
}): void {
  stopExpressionLearningPracticeScheduler();
  if (!runtimeConfig.EXPRESSION_LEARNING_AUTO_PRACTICE_ENABLED) {
    logger?.info("[ExpressionLearningPractice] Auto practice generation is disabled");
    return;
  }

  const cronExpression = runtimeConfig.EXPRESSION_LEARNING_AUTO_PRACTICE_CRON;
  if (!cron.validate(cronExpression)) {
    logger?.error(
      `[ExpressionLearningPractice] Invalid cron expression: ${cronExpression}`,
      new Error("Invalid cron")
    );
    return;
  }

  scheduledTask = cron.schedule(
    cronExpression,
    async () => {
      if (running) {
        logger?.info("[ExpressionLearningPractice] Skipped: previous generation is still running");
        return;
      }
      running = true;
      const task = runningTaskRegistry.start({
        kind: "maintenance",
        label: "Expression learning practice generation",
        source: "expression-learning-practice-scheduler",
      });
      const batchId = randomUUID();
      try {
        const items = await generateExpressionLearningPracticeQuestionBatch({
          count: runtimeConfig.EXPRESSION_LEARNING_AUTO_PRACTICE_COUNT,
          scene: runtimeConfig.EXPRESSION_LEARNING_AUTO_PRACTICE_SCENE,
          focus: runtimeConfig.EXPRESSION_LEARNING_AUTO_PRACTICE_FOCUS || null,
          source: "scheduler",
          batchId,
        });
        logger?.info(
          `[ExpressionLearningPractice] Generated ${items.length} practice question(s), batch=${batchId}`
        );
      } catch (error) {
        logger?.error("[ExpressionLearningPractice] Failed to generate practice questions", error);
      } finally {
        running = false;
        task.finish();
      }
    },
    { scheduled: true }
  );

  logger?.info(
    `[ExpressionLearningPractice] Scheduler started: ${cronExpression} (server local time)`
  );
}

export function reconfigureExpressionLearningPracticeScheduler(logger?: {
  info: (msg: string) => void;
  error: (msg: string, err: unknown) => void;
}): void {
  stopExpressionLearningPracticeScheduler(logger);
  startExpressionLearningPracticeScheduler(logger);
}

export function stopExpressionLearningPracticeScheduler(logger?: { info: (msg: string) => void }): void {
  if (!scheduledTask) return;
  scheduledTask.stop();
  scheduledTask = null;
  logger?.info("[ExpressionLearningPractice] Scheduler stopped");
}
