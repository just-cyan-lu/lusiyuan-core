// dream-scheduler.ts — Auto-run Dream Cycle on cron schedule

import cron from "node-cron";
import { dreamService } from "./dream.service.js";
import { env } from "../utils/env.js";

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Start the Dream Cycle cron scheduler if DREAM_AUTO_RUN is enabled.
 * Uses DREAM_CRON expression (default: "30 3 * * *" = 3:30 AM daily).
 */
export function startDreamScheduler(logger?: { info: (msg: string) => void; error: (msg: string, err: unknown) => void }): void {
  if (!env.DREAM_ENABLED) {
    logger?.info("[DreamScheduler] Dream Cycle is disabled (DREAM_ENABLED=false)");
    return;
  }

  if (!env.DREAM_AUTO_RUN) {
    logger?.info("[DreamScheduler] Auto-run is disabled (DREAM_AUTO_RUN=false)");
    return;
  }

  const cronExpression = env.DREAM_CRON;
  const timezone = env.DREAM_TIMEZONE;

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    logger?.error(`[DreamScheduler] Invalid cron expression: ${cronExpression}`, new Error("Invalid cron"));
    return;
  }

  logger?.info(`[DreamScheduler] Starting auto-run scheduler: ${cronExpression} (${timezone})`);

  scheduledTask = cron.schedule(
    cronExpression,
    async () => {
      logger?.info("[DreamScheduler] Running scheduled Dream Cycle...");
      try {
        const result = await dreamService.runDailyDream({
          triggerType: "scheduled",
          lookbackHours: env.DREAM_DEFAULT_LOOKBACK_HOURS,
        });
        logger?.info(`[DreamScheduler] Completed: job=${result.jobId}, status=${result.status}, signals=${result.signalCount}, proposals=${result.proposalCount}`);
      } catch (err) {
        logger?.error("[DreamScheduler] Failed to run scheduled Dream Cycle", err);
      }
    },
    {
      scheduled: true,
      timezone,
    }
  );

  logger?.info("[DreamScheduler] Scheduler started successfully");
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
