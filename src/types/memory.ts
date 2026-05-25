export type MemoryType =
  | "core"
  | "user_preference"
  | "project_context"
  | "relationship"
  | "growth_event"
  | "boundary"
  | "technical_decision";

export type MemoryScope = "user" | "relationship" | "project" | "global";
export type MemoryStatus = "active" | "archived" | "superseded" | "rejected";

export interface NewMemory {
  type: MemoryType;
  scope?: MemoryScope;
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
}

export type { Memory } from "@prisma/client";
