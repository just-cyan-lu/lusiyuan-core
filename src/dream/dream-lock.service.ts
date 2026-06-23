// dream-lock.service.ts — distributed lock to prevent concurrent DreamJobs

import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";

export class DreamLockService {
  /**
   * Try to acquire a lock. Returns true if acquired, false if already locked.
   */
  async acquire(lockKey: string, owner?: string): Promise<boolean> {
    // Clean up expired locks first
    await this.cleanup();

    const expiresAt = new Date(
      Date.now() + runtimeConfig.DREAM_LOCK_TTL_MINUTES * 60 * 1000
    );

    try {
      await prisma.dreamLock.create({
        data: { lockKey, owner, expiresAt },
      });
      return true;
    } catch {
      // Unique constraint violation — lock already held
      return false;
    }
  }

  async release(lockKey: string): Promise<void> {
    await prisma.dreamLock.deleteMany({ where: { lockKey } });
  }

  async isLocked(lockKey: string): Promise<boolean> {
    await this.cleanup();
    const lock = await prisma.dreamLock.findUnique({ where: { lockKey } });
    return lock !== null;
  }

  private async cleanup(): Promise<void> {
    await prisma.dreamLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}

export const dreamLockService = new DreamLockService();
