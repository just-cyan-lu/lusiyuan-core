// dream.types.ts — v0.75 Dream Cycle type definitions

export type DreamJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type DreamTriggerType = "manual" | "scheduled" | "conversation_threshold" | "after_reflection";
export type DreamScope = "daily" | "conversation" | "user" | "project" | "global";

export type DreamSignalType =
  | "recurring_theme"
  | "technical_decision"
  | "project_context"
  | "user_preference"
  | "persona_feedback"
  | "relationship_shift"
  | "growth_event"
  | "boundary_risk"
  | "memory_conflict"
  | "asset_pattern"
  | "external_feedback"
  | "open_question";

export type DreamRiskLevel = "low" | "medium" | "high";

// ─── Context ──────────────────────────────────────────────────────────────────

export interface DreamSourceMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  userId?: string;
}

export interface DreamSourceMemory {
  id: string;
  type: string;
  content: string;
  importance: number;
  createdAt: Date;
}

export interface DreamSourceToolCall {
  id: string;
  toolName: string;
  status: string;
  createdAt: Date;
}

export interface DreamSourceReflectionReport {
  id: string;
  summary: string;
  confidence: number;
  createdAt: Date;
}

export interface DreamSourceMemoryProposal {
  id: string;
  proposalType: string;
  content: string;
  confidence: number;
  status: string;
  createdAt: Date;
}

export interface DreamContext {
  range: { from: Date; to: Date };
  messages: DreamSourceMessage[];
  memories: DreamSourceMemory[];
  toolCalls: DreamSourceToolCall[];
  reflectionReports: DreamSourceReflectionReport[];
  memoryProposals: DreamSourceMemoryProposal[];
  // reserved for v0.8+
  assetReviews?: unknown[];
  sourceStats: Record<string, number>;
}

// ─── Daily Note ───────────────────────────────────────────────────────────────

export interface DailyNoteContent {
  summary: string;
  keyPoints: string[];
  possibleSignals: string[];
  risks: string[];
  openQuestions: string[];
  sourceStats: Record<string, number>;
}

// ─── Dream Signal ─────────────────────────────────────────────────────────────

export interface RawDreamSignal {
  signalType: DreamSignalType;
  content: string;
  summary?: string;
  confidence: number;
  strength: number;
  riskLevel: DreamRiskLevel;
  sourceTypes?: string[];
  sourceIds?: string[];
  evidenceCount: number;
  tags?: string[];
  entities?: string[];
}

// ─── Dream Diary ──────────────────────────────────────────────────────────────

export interface RawDreamDiaryEntry {
  title?: string;
  content: string;
}

// ─── Consolidation ────────────────────────────────────────────────────────────

export interface RawConsolidationProposal {
  proposalType: "create_memory" | "update_memory" | "supersede_memory" | "archive_memory";
  targetMemoryId?: string;
  scope: string;
  type: string;
  content: string;
  summary?: string;
  tags?: string[];
  entities?: string[];
  reason: string;
  confidence: number;
  riskLevel: DreamRiskLevel;
  sourceMessageIds?: string[];
}

export interface RawConsolidationGrowthLog {
  title: string;
  content: string;
  tags?: string[];
  confidence: number;
  sourceMessageIds?: string[];
}

export interface RawConsolidationRiskFlag {
  type: string;
  severity: string;
  description: string;
  suggestedAction?: string;
  relatedMessageIds?: string[];
}

export interface RawConsolidationOutput {
  memoryProposals: RawConsolidationProposal[];
  growthLogProposals: RawConsolidationGrowthLog[];
  riskFlags: RawConsolidationRiskFlag[];
  openQuestions: string[];
}

// ─── Morning Brief ────────────────────────────────────────────────────────────

export interface MorningBrief {
  jobId: string;
  completedAt: Date;
  dailyNoteId?: string;
  diaryEntryId?: string;
  signalCount: number;
  proposalCount: number;
  riskCount: number;
  topSignals: Array<{ signalType: string; content: string; confidence: number }>;
  summary: string;
}

// ─── Service inputs ───────────────────────────────────────────────────────────

export interface CreateDreamJobInput {
  triggerType: DreamTriggerType;
  scope: DreamScope;
  userId?: string;
  conversationId?: string;
  channel?: string;
  fromTime?: Date;
  toTime?: Date;
}

export interface RunDailyDreamInput {
  triggerType?: DreamTriggerType;
  lookbackHours?: number;
  userId?: string;
}

export interface DreamRunResult {
  jobId: string;
  status: DreamJobStatus;
  dailyNoteId?: string;
  diaryEntryId?: string;
  signalCount: number;
  proposalCount: number;
  riskCount: number;
}
