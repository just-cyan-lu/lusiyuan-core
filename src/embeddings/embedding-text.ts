import type { Memory } from "@prisma/client";

export function buildMemoryEmbeddingText(memory: Memory): string {
  const parts: string[] = [];

  parts.push(`type: ${memory.type}`);
  const m = memory as Memory & {
    scope?: string;
    tier?: string;
    summary?: string | null;
  };
  parts.push(`scope: ${m.scope ?? "person"}`);
  parts.push(`tier: ${m.tier ?? "temp"}`);
  parts.push(`content: ${memory.content}`);

  if (m.summary) {
    parts.push(`summary: ${m.summary}`);
  }

  return parts.join("\n");
}
