import { prisma } from "../db/prisma.js";
import type { Memory } from "@prisma/client";
import type { NewMemory } from "../types/memory.js";

export interface MemoryService {
  searchRelevantMemories(userId: string, query: string): Promise<Memory[]>;
  createMemories(userId: string, memories: NewMemory[]): Promise<void>;
  listUserMemories(userId: string): Promise<Memory[]>;
}

class PrismaMemoryService implements MemoryService {
  async searchRelevantMemories(userId: string, _query: string): Promise<Memory[]> {
    return prisma.memory.findMany({
      where: { userId },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 8,
    });
  }

  async createMemories(userId: string, memories: NewMemory[]): Promise<void> {
    if (memories.length === 0) return;
    await prisma.memory.createMany({
      data: memories.map((m) => ({
        userId,
        type: m.type,
        content: m.content,
        importance: m.importance,
        source: m.source ?? null,
      })),
    });
  }

  async listUserMemories(userId: string): Promise<Memory[]> {
    return prisma.memory.findMany({
      where: { userId },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    });
  }
}

export const memoryService: MemoryService = new PrismaMemoryService();
