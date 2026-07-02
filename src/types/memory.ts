export type MemoryType =
  | "personal_fact"
  | "user_preference"
  | "recurring_topic"
  | "project_context"
  | "growth_event"
  | "technical_decision"
  | "boundary"
  | "other";

export type MemoryScope = "person" | "project" | "global" | "topic";
export type MemoryStatus = "active" | "archived" | "superseded" | "rejected";
export type MemoryTier = "temp" | "short" | "mid" | "long";

export interface NewMemory {
  type: MemoryType;
  scope?: MemoryScope;
  personId?: string | null;
  tier?: MemoryTier;
  tierMentionCount?: number;
  tierEnteredAt?: Date;
  content: string;
  summary?: string;
  status?: MemoryStatus;
  sourceMessageIds?: string[];
  mentionDayKeys?: string[];
  lastMentionedAt?: Date;
}

export type { Memory } from "@prisma/client";
