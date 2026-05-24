export type MemoryType =
  | "core"
  | "user_preference"
  | "project_context"
  | "relationship"
  | "growth_event"
  | "boundary"
  | "technical_decision";

export interface NewMemory {
  type: MemoryType;
  content: string;
  importance: number;
  source?: string;
}

export type { Memory } from "@prisma/client";
