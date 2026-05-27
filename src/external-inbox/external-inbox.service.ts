import { prisma } from "../db/prisma.js";
import { env } from "../utils/env.js";
import { fetchXiaohongshuInbox } from "./adapters/xiaohongshu-inbox.adapter.js";
import type { InboxItem, SyncResult } from "./external-inbox.types.js";

class ExternalInboxService {
  async sync(platform: string): Promise<SyncResult> {
    if (!env.EXTERNAL_INBOX_ENABLED) {
      throw new Error("External Inbox is disabled");
    }

    let items: InboxItem[];

    switch (platform) {
      case "xiaohongshu":
        items = await fetchXiaohongshuInbox();
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    let saved = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        await prisma.externalInboxItem.create({
          data: {
            id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            platform: item.platform,
            sourceId: item.sourceId,
            type: item.type,
            content: item.content,
            authorName: item.authorName ?? null,
            postTitle: item.postTitle ?? null,
            postUrl: item.postUrl ?? null,
          },
        });
        saved++;
      } catch (err: unknown) {
        // unique constraint violation = already synced
        if (
          err instanceof Error &&
          err.message.includes("Unique constraint")
        ) {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    return { platform, fetched: items.length, saved, skipped };
  }

  async list(platform?: string, limit = 50) {
    return prisma.externalInboxItem.findMany({
      where: platform ? { platform } : undefined,
      orderBy: { syncedAt: "desc" },
      take: limit,
    });
  }

  async get(id: string) {
    return prisma.externalInboxItem.findUnique({ where: { id } });
  }
}

export const externalInboxService = new ExternalInboxService();
