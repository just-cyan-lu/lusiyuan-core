import cron from "node-cron";
import { env } from "../utils/env.js";
import { runtimeStateService } from "./runtime-state.service.js";

let scheduledTask: cron.ScheduledTask | null = null;

export function startRuntimeAutonomyScheduler(logger?: {
  info: (msg: string) => void;
  error: (msg: string, err: unknown) => void;
}): void {
  if (!env.RUNTIME_AUTONOMY_AUTO_RUN) {
    logger?.info("[RuntimeAutonomy] Auto-run is disabled");
    return;
  }

  if (!cron.validate(env.RUNTIME_AUTONOMY_CRON)) {
    logger?.error(
      `[RuntimeAutonomy] Invalid cron expression: ${env.RUNTIME_AUTONOMY_CRON}`,
      new Error("Invalid cron")
    );
    return;
  }

  scheduledTask = cron.schedule(
    env.RUNTIME_AUTONOMY_CRON,
    async () => {
      logger?.info("[RuntimeAutonomy] Running scheduled autonomy tick...");
      try {
        const result = await runtimeStateService.runAutonomyTick();
        logger?.info(
          `[RuntimeAutonomy] Completed: state=${result.state.id}, event=${result.event.id}`
        );
      } catch (err) {
        logger?.error("[RuntimeAutonomy] Failed to run autonomy tick", err);
      }
    },
    {
      scheduled: true,
      timezone: env.RUNTIME_AUTONOMY_TIMEZONE,
    }
  );

  logger?.info(
    `[RuntimeAutonomy] Scheduler started: ${env.RUNTIME_AUTONOMY_CRON} (${env.RUNTIME_AUTONOMY_TIMEZONE})`
  );
}

export function stopRuntimeAutonomyScheduler(logger?: { info: (msg: string) => void }): void {
  if (!scheduledTask) return;
  scheduledTask.stop();
  scheduledTask = null;
  logger?.info("[RuntimeAutonomy] Scheduler stopped");
}
