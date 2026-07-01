import type { Memory } from "@prisma/client";

export function buildMemoryEmbeddingText(memory: Memory): string {
  const parts: string[] = [];

  parts.push(`type: ${memory.type}`);
  const m = memory as Memory & {
    scope?: string;
    tier?: string;
    riskLevel?: string;
    summary?: string | null;
    tags?: unknown;
    entities?: unknown;
  };
  parts.push(`scope: ${m.scope ?? "person"}`);
  parts.push(`tier: ${m.tier ?? "short"}`);
  parts.push(`risk: ${m.riskLevel ?? "low"}`);
  parts.push(`content: ${memory.content}`);

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
