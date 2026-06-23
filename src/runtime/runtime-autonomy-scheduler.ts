import cron from "node-cron";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { runtimeStateService } from "./runtime-state.service.js";

let scheduledTask: cron.ScheduledTask | null = null;

export function startRuntimeAutonomyScheduler(logger?: {
  info: (msg: string) => void;
  error: (msg: string, err: unknown) => void;
}): void {
  stopRuntimeAutonomyScheduler();
  if (!runtimeConfig.RUNTIME_AUTONOMY_AUTO_RUN) {
    logger?.info("[RuntimeAutonomy] Auto-run is disabled");
    return;
  }

  if (!cron.validate(runtimeConfig.RUNTIME_AUTONOMY_CRON)) {
    logger?.error(
      `[RuntimeAutonomy] Invalid cron expression: ${runtimeConfig.RUNTIME_AUTONOMY_CRON}`,
      new Error("Invalid cron")
    );
    return;
  }

  scheduledTask = cron.schedule(
    runtimeConfig.RUNTIME_AUTONOMY_CRON,
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
      timezone: runtimeConfig.RUNTIME_AUTONOMY_TIMEZONE,
    }
  );

  logger?.info(
    `[RuntimeAutonomy] Scheduler started: ${runtimeConfig.RUNTIME_AUTONOMY_CRON} (${runtimeConfig.RUNTIME_AUTONOMY_TIMEZONE})`
  );
}

export function reconfigureRuntimeAutonomyScheduler(logger?: {
  info: (msg: string) => void;
  error: (msg: string, err: unknown) => void;
}): void {
  stopRuntimeAutonomyScheduler(logger);
  startRuntimeAutonomyScheduler(logger);
}

export function stopRuntimeAutonomyScheduler(logger?: { info: (msg: string) => void }): void {
  if (!scheduledTask) return;
  scheduledTask.stop();
  scheduledTask = null;
  logger?.info("[RuntimeAutonomy] Scheduler stopped");
}
