export type ReflectionScope = "conversation" | "user" | "global_project" | "daily";
export type ReflectionTriggerType = "manual" | "scheduled" | "conversation_threshold";
export type ReflectionJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type ProposalType =
  | "create_memory"
  | "update_memory"
  | "supersede_memory"
  | "archive_memory";

export type ProposalStatus = "pending" | "approved" | "rejected" | "applied" | "ignored";
export type RiskFlagStatus = "open" | "reviewed" | "resolved" | "ignored";
export type GrowthLogStatus = "pending" | "approved" | "rejected" | "applied";

export type RiskFlagType =
  | "persona_drift"
  | "boundary_risk"
  | "pretend_human_risk"
  | "privacy_risk"
  | "unsafe_action_risk"
  | "memory_conflict"
  | "low_confidence";

export type RiskSeverity = "low" | "medium" | "high";

// ── Context ──────────────────────────────────────────────────────────────────

export interface BuildReflectionContextInput {
  scope: ReflectionScope;
  userId?: string;
  conversationId?: string;
  channel?: string;
  messageLimit?: number;
  from?: Date;
  to?: Date;
}

export interface ReflectionMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface ReflectionMemory {
  id: string;
  type: string;
  scope: string;
  content: string;
  importance: number;
  confidence: number;
  createdAt: Date;
}

export interface ReflectionContext {
  messages: ReflectionMessage[];
  existingMemories: ReflectionMemory[];
  coreIdentitySummary: string;
  boundariesSummary: string;
}

// ── Raw model output ──────────────────────────────────────────────────────────

export interface RawMemoryProposal {
  proposalType: ProposalType;
  targetMemoryId?: string;
  scope: string;
  type: string;
  content: string;
  summary?: string;
  tags?: string[];
  entities?: string[];
  reason: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  sourceMessageIds?: string[];
}

export interface RawRiskFlag {
  type: string;
  severity: string;
  description: string;
  suggestedAction?: string;
  relatedMessageIds?: string[];
}

export interface RawGrowthLog {
  title: string;
  content: string;
  tags?: string[];
  confidence: number;
  sourceMessageIds?: string[];
}

export interface RawReflectionOutput {
  summary: string;
  newMemoryProposals: RawMemoryProposal[];
  updateMemoryProposals: RawMemoryProposal[];
  supersedeMemoryProposals: RawMemoryProposal[];
  riskFlags: RawRiskFlag[];
  growthLogProposals: RawGrowthLog[];
  openQuestions: string[];
  confidence: number;
}

// ── Service input/output ──────────────────────────────────────────────────────

export interface CreateReflectionJobInput {
  scope: ReflectionScope;
  triggerType: ReflectionTriggerType;
  userId?: string;
  conversationId?: string;
  channel?: string;
  messageLimit?: number;
  from?: Date;
  to?: Date;
}
