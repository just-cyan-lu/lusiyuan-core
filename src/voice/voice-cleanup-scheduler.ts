import cron from "node-cron";
import { voiceCacheService } from "./voice-cache.service.js";

let scheduledTask: cron.ScheduledTask | null = null;

export function startVoiceCleanupScheduler(logger?: {
  info: (msg: string) => void;
  error: (msg: string, err: unknown) => void;
}): void {
  stopVoiceCleanupScheduler();
  scheduledTask = cron.schedule(
    "15 4 * * *",
    async () => {
      try {
        const result = await voiceCacheService.cleanupExpired();
        logger?.info(`[VoiceCleanup] Completed: deleted=${result.deleted}, failed=${result.failed}`);
      } catch (error) {
        logger?.error("[VoiceCleanup] Failed to cleanup expired voice cache", error);
      }
    },
    { scheduled: true }
  );
  logger?.info("[VoiceCleanup] Scheduler started: 15 4 * * *");
}

export function stopVoiceCleanupScheduler(logger?: { info: (msg: string) => void }): void {
  if (!scheduledTask) return;
  scheduledTask.stop();
  scheduledTask = null;
  logger?.info("[VoiceCleanup] Scheduler stopped");
}
