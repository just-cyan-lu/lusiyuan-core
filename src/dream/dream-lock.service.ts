// dream-lock.service.ts — distributed lock to prevent concurrent DreamJobs

import { prisma } from "../db/prisma.js";

const NON_EXPIRING_LOCK_TIME = new Date("9999-12-31T23:59:59.999Z");

export class DreamLockService {
  /**
   * Try to acquire a lock. Returns true if acquired, false if already locked.
   */
  async acquire(lockKey: string, owner?: string): Promise<boolean> {
    try {
      await prisma.dreamLock.create({
        data: { lockKey, owner, expiresAt: NON_EXPIRING_LOCK_TIME },
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
    const lock = await prisma.dreamLock.findUnique({ where: { lockKey } });
    return lock !== null;
  }
}

export const dreamLockService = new DreamLockService();
