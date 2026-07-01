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
export type MemoryTier = "short" | "mid" | "long";
export type MemoryRiskLevel = "low" | "medium" | "high";

export interface NewMemory {
  type: MemoryType;
  scope?: MemoryScope;
  personId?: string | null;
  tier?: MemoryTier;
  strength?: number;
  riskLevel?: MemoryRiskLevel;
  content: string;
  summary?: string;
  importance: number;
  confidence?: number;
  status?: MemoryStatus;
  source?: string;
  tags?: string[];
  entities?: string[];
  channel?: string;
  conversationId?: string;
  sourceMessageIds?: string[];
  sourceConversationIds?: string[];
  sourceUserIds?: string[];
  mentionDayKeys?: string[];
  lastMentionedAt?: Date;
  nextReviewAt?: Date;
}

export type { Memory } from "@prisma/client";
