import { prisma } from "../db/prisma.js";
import type { Draft } from "@prisma/client";
import type { CreateDraftInput, DraftStatus } from "./draft.types.js";

export class DraftService {
  async createDraft(input: CreateDraftInput): Promise<Draft> {
    return prisma.draft.create({
      data: {
        userId: input.userId,
        conversationId: input.conversationId,
        channel: input.channel,
        type: input.type,
        title: input.title,
        content: input.content,
        status: "draft",
        metadata: input.metadata
          ? ({ ...input.metadata, targetPlatform: input.targetPlatform, targetContext: input.targetContext } as object)
          : input.targetPlatform || input.targetContext
            ? ({ targetPlatform: input.targetPlatform, targetContext: input.targetContext } as object)
            : undefined,
        createdByTool: input.createdByTool,
      },
    });
  }

  async listDrafts(userId?: string, limit = 20): Promise<Draft[]> {
    return prisma.draft.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getDraft(id: string): Promise<Draft | null> {
    return prisma.draft.findUnique({ where: { id } });
  }

  async updateDraftStatus(id: string, status: DraftStatus): Promise<Draft> {
    return prisma.draft.update({
      where: { id },
      data: { status },
    });
  }
}

export const draftService = new DraftService();
