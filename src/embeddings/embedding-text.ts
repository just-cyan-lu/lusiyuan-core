import type { Memory } from "@prisma/client";

export function buildMemoryEmbeddingText(memory: Memory): string {
  const parts: string[] = [];

  parts.push(`type: ${memory.type}`);
  parts.push(`scope: ${(memory as Memory & { scope?: string }).scope ?? "user"}`);
  parts.push(`content: ${memory.content}`);

  const m = memory as Memory & {
    summary?: string | null;
    tags?: unknown;
    entities?: unknown;
  };

  if (m.summary) {
    parts.push(`summary: ${m.summary}`);
  }
  if (Array.isArray(m.tags) && m.tags.length > 0) {
    parts.push(`tags: ${(m.tags as string[]).join(", ")}`);
  }
  if (Array.isArray(m.entities) && m.entities.length > 0) {
    parts.push(`entities: ${(m.entities as string[]).join(", ")}`);
  }

  return parts.join("\n");
}
