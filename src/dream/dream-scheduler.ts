// dream-scheduler.ts — Dream Cycle cron schedule

import cron from "node-cron";
import { dreamService } from "./dream.service.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Start the Dream Cycle cron scheduler if DREAM_ENABLED is true.
 * Uses DREAM_CRON expression (default: "30 3 * * *" = 3:30 AM daily)
 * in the server's local timezone.
 */
export function startDreamScheduler(logger?: { info: (msg: string) => void; error: (msg: string, err: unknown) => void }): void {
  stopDreamScheduler();
  if (!runtimeConfig.DREAM_ENABLED) {
    logger?.info("[DreamScheduler] Dream Cycle is disabled in Admin runtime settings");
    return;
  }

  const cronExpression = runtimeConfig.DREAM_CRON;

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    logger?.error(`[DreamScheduler] Invalid cron expression: ${cronExpression}`, new Error("Invalid cron"));
    return;
  }

  logger?.info(`[DreamScheduler] Starting auto-run scheduler: ${cronExpression} (server local time)`);

  scheduledTask = cron.schedule(
    cronExpression,
    async () => {
      logger?.info("[DreamScheduler] Running scheduled Dream Cycle...");
      try {
        const result = await dreamService.runDailyDream({
          triggerType: "scheduled",
        });
        if (result.status === "running") {
          logger?.info(`[DreamScheduler] Skipped: Dream job ${result.jobId} is still running`);
        } else {
          logger?.info(`[DreamScheduler] Completed: job=${result.jobId}, status=${result.status}, signals=${result.signalCount}, proposals=${result.proposalCount}`);
        }
      } catch (err) {
        logger?.error("[DreamScheduler] Failed to run scheduled Dream Cycle", err);
      }
    },
    { scheduled: true }
  );

  logger?.info("[DreamScheduler] Scheduler started successfully");
}

export function reconfigureDreamScheduler(logger?: { info: (msg: string) => void; error: (msg: string, err: unknown) => void }): void {
  stopDreamScheduler(logger);
  startDreamScheduler(logger);
}

/**
 * Stop the Dream Cycle scheduler.
 */
export function stopDreamScheduler(logger?: { info: (msg: string) => void }): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger?.info("[DreamScheduler] Scheduler stopped");
  }
}
