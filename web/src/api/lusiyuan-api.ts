import type {
  ChatRequest,
  ChatReplyPart,
  ChatResponse,
  ChatStreamEvent,
  ConversationMessage,
} from "../types/chat";

export const API_BASE_URL =
  import.meta.env.VITE_LUSIYUAN_API_BASE_URL ?? "http://localhost:64100";

export interface HealthStatus {
  status: string;
}

export interface ChannelStatus {
  telegram: {
    enabled: boolean;
    mode: string | null;
  };
  weixin: {
    enabled: boolean;
    mode: string | null;
  };
}

export interface RuntimeProvider {
  name: string;
  label: string;
  active: boolean;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  model: string | null;
}

export interface RuntimeConfig {
  activeModelProvider: string;
  providers: RuntimeProvider[];
  channels: {
    telegram: {
      enabled: boolean;
      mode: string | null;
      tokenConfigured: boolean;
      proxyConfigured: boolean;
    };
    weixin: {
      enabled: boolean;
      mode: string | null;
      secretConfigured: boolean;
    };
  };
  features: Record<string, boolean>;
  safety: Record<string, boolean>;
}

export interface RunningTask {
  id: string;
  kind: "chat" | "dream";
  label: string;
  status: "running" | "cancelling";
  source: string | null;
  channel: string | null;
  userId: string | null;
  conversationId: string | null;
  startedAt: string;
  cancelRequestedAt: string | null;
  cancelReason: string | null;
  ageMs: number;
}

export interface RunningTasksResponse {
  tasks: RunningTask[];
}

export interface RunningTaskResponse {
  task: RunningTask | null;
}

export interface RuntimeState {
  id: string;
  key: string;
  moodLabel: string;
  energyLevel: number;
  recentEventSummary: string | null;
  statusNote: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeStateEvent {
  id: string;
  runtimeStateId: string;
  eventType: string;
  source: string | null;
  summary: string;
  patch: unknown;
  before: unknown;
  after: unknown;
  userId: string | null;
  conversationId: string | null;
  sourceRuntimeEventIds: unknown;
  sourceMessageIds: unknown;
  channel: string | null;
  createdAt: string;
}

export interface RuntimeEvent {
  id: string;
  eventType: string;
  source: string;
  summary: string;
  importance: number;
  topic: string | null;
  moodSignal: string | null;
  energySignal: string | null;
  stateImpact: unknown;
  payload: unknown;
  userId: string | null;
  conversationId: string | null;
  messageId: string | null;
  channel: string | null;
  status: string;
  createdAt: string;
}

export interface RuntimeSourceMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  externalMessageId: string | null;
  isIntermediate: boolean;
  metadata: unknown;
  createdAt: string;
  conversation: {
    id: string;
    channel: string;
    externalConversationId: string;
    user: {
      id: string;
      externalId: string;
      displayName: string | null;
    };
  };
}

export interface RuntimeStateResponse {
  state: RuntimeState;
  events: RuntimeStateEvent[];
  runtimeEvents: RuntimeEvent[];
  autonomousTasks?: AutonomousTask[];
  idleTaskRun?: AutonomousTaskRunResult | null;
}

export interface AutonomousArtifact {
  id: string;
  taskId: string;
  runId: string | null;
  kind: string;
  title: string;
  content: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomousTaskRun {
  id: string;
  taskId: string;
  trigger: string;
  status: string;
  summary: string | null;
  plan: unknown;
  result: unknown;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface AutonomousTask {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: number;
  currentStep: string | null;
  nextStep: string | null;
  createdBy: string;
  lastRunAt: string | null;
  completedAt: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  runs?: AutonomousTaskRun[];
  artifacts?: AutonomousArtifact[];
}

export interface AutonomousTaskRunResult {
  status: "completed" | "skipped" | "failed";
  summary: string;
  task: AutonomousTask | null;
  run: AutonomousTaskRun | null;
  artifact: AutonomousArtifact | null;
}

export interface RuntimeStateEventSourcesResponse {
  event: RuntimeStateEvent;
  runtimeEvents: RuntimeEvent[];
  messages: RuntimeSourceMessage[];
  missingRuntimeEventIds: string[];
  missingMessageIds: string[];
}

export interface RelationshipUser {
  id: string;
  externalId: string;
  displayName: string | null;
}

export interface IdentityLink {
  id: string;
  personId: string;
  userId: string;
  source: string;
  verifiedBy: string | null;
  createdAt: string;
  user: RelationshipUser;
}

export interface PersonIdentity {
  id: string;
  label: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  identityLinks: IdentityLink[];
}

export interface RelationshipState {
  id: string;
  personId: string;
  person?: PersonIdentity;
  relationshipLabel: string;
  affinity: number;
  userIntroduction: string | null;
  interactionStyle: string | null;
  summary: string | null;
  recentSignal: string | null;
  statusNote: string | null;
  metadata: unknown;
  lastInteractionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipStateEvent {
  id: string;
  relationshipStateId: string;
  personId: string;
  userId: string | null;
  eventType: string;
  source: string | null;
  summary: string;
  patch: unknown;
  before: unknown;
  after: unknown;
  conversationId: string | null;
  messageId: string | null;
  channel: string | null;
  createdAt: string;
}

export interface RelationshipReviewEvidence {
  id: string;
  proposalId: string;
  relationshipStateId: string;
  personId: string;
  userId: string | null;
  conversationId: string | null;
  messageId: string | null;
  channel: string | null;
  source: string;
  evidenceKey: string;
  evidenceType: string;
  polarity: string;
  confidence: number;
  content: string;
  reason: string;
  affectsFields: unknown;
  sourceMessageIds: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface RelationshipReviewProposal {
  id: string;
  reportId: string | null;
  relationshipStateId: string;
  personId: string;
  userId: string | null;
  conversationId: string | null;
  channel: string | null;
  source: string;
  status: string;
  reason: string;
  confidence: number;
  evidenceCount: number;
  beforeSnapshot: unknown;
  proposedPatch: unknown;
  afterSnapshot: unknown;
  appliedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rawOutput: unknown;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  evidences: RelationshipReviewEvidence[];
}

export interface RelationshipListResponse {
  relationships: RelationshipState[];
}

export interface RelationshipDetailResponse {
  relationship: RelationshipState;
  events: RelationshipStateEvent[];
  reviewProposals?: RelationshipReviewProposal[];
}

export interface IdentityLinkProposal {
  id: string;
  sourceUserId: string;
  targetPersonId: string;
  targetUserId: string | null;
  reason: string;
  evidence: unknown;
  confidence: number;
  status: string;
  source: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceUser: RelationshipUser;
  targetUser: RelationshipUser | null;
  targetPerson: PersonIdentity;
}

export interface IdentityLinkProposalListResponse {
  proposals: IdentityLinkProposal[];
}

export interface IdentityLinkProposalReviewResponse {
  proposal: IdentityLinkProposal;
  relationship?: RelationshipState;
  events?: RelationshipStateEvent[];
}

export interface ConversationIdentityLinkSummary {
  id: string;
  personId: string;
  userId: string;
  source: string;
  verifiedBy: string | null;
  createdAt: string;
  user: RelationshipUser & {
    createdAt?: string;
    updatedAt?: string;
  };
  conversationCount: number;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface ConversationPersonSummary {
  person: Omit<PersonIdentity, "identityLinks">;
  relationship: RelationshipState | null;
  identityLinks: ConversationIdentityLinkSummary[];
  isOwner: boolean;
  lastMessageAt: string | null;
  conversationCount: number;
  messageCount: number;
}

export interface ConversationPeopleResponse {
  people: ConversationPersonSummary[];
}

export interface ConversationUserDetail {
  link: {
    id: string;
    personId: string;
    userId: string;
    source: string;
    verifiedBy: string | null;
    createdAt: string;
  };
  user: RelationshipUser & {
    createdAt: string;
    updatedAt: string;
  };
  isOwner: boolean;
  conversations: ConversationSummary[];
}

export interface ConversationSummary {
  id: string;
  userId: string;
  channel: string;
  externalConversationId: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageAt: string | null;
  lastMessageRole: string | null;
  lastMessagePreview: string | null;
}

export interface ConversationPersonDetailResponse {
  person: Omit<PersonIdentity, "identityLinks">;
  relationship: RelationshipState | null;
  isOwner: boolean;
  lastMessageAt: string | null;
  users: ConversationUserDetail[];
}

export interface AdminConversation {
  id: string;
  userId: string;
  channel: string;
  externalConversationId: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  user: RelationshipUser;
}

export interface AdminConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  externalMessageId: string | null;
  isIntermediate: boolean;
  metadata: unknown;
  createdAt: string;
}

export interface AdminConversationMessagesResponse {
  conversation: AdminConversation;
  messages: AdminConversationMessage[];
}

export interface WebChatConversationSummary extends ConversationSummary {
  user: RelationshipUser;
}

export interface WebChatConversationsResponse {
  conversations: WebChatConversationSummary[];
}

export interface RelationshipUpdateInput {
  token: string;
  relationshipId: string;
  relationshipLabel?: string;
  affinity?: number;
  userIntroduction?: string | null;
  interactionStyle?: string | null;
  summary?: string | null;
  recentSignal?: string | null;
  statusNote?: string | null;
  metadata?: unknown;
  eventSummary?: string;
}

export interface RuntimeStateUpdateInput {
  token: string;
  energyLevel?: number;
  recentEventSummary?: string | null;
  statusNote?: string | null;
  summary?: string;
}

export type EnvConfigFieldType =
  | "string"
  | "secret"
  | "boolean"
  | "integer"
  | "number"
  | "select";

export interface EnvConfigField {
  key: string;
  group: string;
  label: string;
  type: EnvConfigFieldType;
  value: string;
  configured: boolean;
  fromFile: boolean;
  maskedValue?: string;
  maskedValues?: string[];
  secret: boolean;
  restartRequired: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  description?: string;
}

export interface EditableEnvConfig {
  envPath: string;
  restartRequired: boolean;
  fields: EnvConfigField[];
  updatedKeys?: string[];
  deletedKeys?: string[];
  deletedSecretValueIndexes?: Record<string, number[]>;
  message?: string;
}

export interface RuntimeSettingField {
  key: string;
  group: string;
  label: string;
  type: Exclude<EnvConfigFieldType, "secret">;
  value: string | number | boolean;
  defaultValue: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  description?: string;
  stored?: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface RuntimeSettingsResponse {
  immediate: boolean;
  fields: RuntimeSettingField[];
  changedKeys?: string[];
  message?: string;
}

export interface RuntimeSettingEvent {
  id: string;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string | null;
  source: string;
  createdAt: string;
}

export interface ClearDatabaseResponse {
  ok: boolean;
  tableCount: number;
  tables: string[];
  clearedAt: string;
  message: string;
}

export interface ToolPolicy {
  callLogEnabled: boolean;
}

export interface RegisteredTool {
  name: string;
  description: string;
  parameters: unknown;
  riskLevel: "low" | "medium" | "high" | string;
  enabled: boolean;
  accessMode?: "off" | "owner_only" | "on";
  effectiveEnabled: boolean;
  disabledReason: string | null;
  ownerOnly: boolean;
}

export interface ToolRegistryResponse {
  tools: RegisteredTool[];
  policy: ToolPolicy;
}

export interface SkillProfile {
  id: string;
  label: string;
  platform?: string;
  description: string;
  enabled: boolean;
  implemented: boolean;
  configKeys: string[];
  disabledReason: string | null;
  rulesSummary: string[];
}

export interface RegisteredSkill {
  id: string;
  label: string;
  category: string;
  description: string;
  accessMode: "off" | "owner_only" | "on";
  enabled: boolean;
  disabledReason: string | null;
  configKeys: string[];
  entryPoints: string[];
  outputContract: string[];
  disabledBehavior: string;
  profiles: SkillProfile[];
}

export interface SkillsResponse {
  skills: RegisteredSkill[];
}

export interface XiaohongshuReplyConfig {
  version: number;
  accessMode: "off" | "owner_only" | "on";
  accountMode: "siyuan_first" | "creator_first" | "mixed";
  maxReplyChars: number;
  prompt: string;
}

export interface XiaohongshuReplyConfigResponse {
  config: XiaohongshuReplyConfig;
  message?: string;
}

export interface XiaohongshuReplyResult {
  risk: "ready" | "review" | "skip";
  comment_type: string;
  awareness: string;
  voice: string;
  boundary: string;
  reply: string;
  reason: string;
}

export interface XiaohongshuReplyDraft {
  id: string;
  commentId: string;
  originalContent: string;
  content: string;
  risk: string;
  commentType: string;
  awareness: string | null;
  voice: string | null;
  boundary: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionLearningExample {
  id: string;
  sourceRef: string;
  sourceType: string;
  sourceId: string | null;
  platform: string;
  scene: string;
  scope: string;
  contextText: string;
  draftText: string | null;
  finalText: string | null;
  outcome: "sent" | "skipped";
  ownerAction: string;
  ownerNote: string | null;
  lesson: string;
  reasoning: string | null;
  strategy: string | null;
  tone: string | null;
  avoidances: unknown;
  tags: unknown;
  confidence: number;
  status: "pending" | "active" | "disabled";
  analysisVersion: number;
  embeddingStatus: string;
  embeddingError: string | null;
  lastUsedAt: string | null;
  accessCount: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionLearningResponse {
  examples: ExpressionLearningExample[];
  summary: { total: number; active: number; pending: number; skipped: number };
  platforms: string[];
}

export interface ExpressionLearningCreateInput {
  token: string;
  trainingRecordId?: string | null;
  sourceType?: string;
  platform: string;
  scene: string;
  scope?: string;
  contextText: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome: "sent" | "skipped";
  ownerAction?: string;
  ownerNote?: string | null;
  status?: "pending" | "active" | "disabled";
  metadata?: Record<string, unknown>;
}

export interface ExpressionLearningPracticeQuestion {
  platform: string;
  scene: string;
  contextText: string;
  draftText: string | null;
  teachingFocus: string;
  expectedOwnerInput: string;
  tags: string[];
}

export interface ExpressionLearningPracticeQuestionResponse {
  question: ExpressionLearningPracticeQuestion;
  trainingRecord: ExpressionLearningTrainingRecord;
}

export interface ExpressionLearningDraftResponse {
  draftText: string;
  referenceExampleIds: string[];
  trainingRecord?: ExpressionLearningTrainingRecord;
}

export interface ExpressionLearningTrainingRecord {
  id: string;
  sourceType: string;
  platform: string;
  scene: string;
  scope: string | null;
  status: string;
  contextText: string | null;
  draftText: string | null;
  finalText: string | null;
  outcome: string | null;
  ownerAction: string | null;
  ownerNote: string | null;
  reasonText: string | null;
  generatedQuestion: unknown;
  generatedDraft: unknown;
  analysisSnapshot: unknown;
  exportPayload: unknown;
  rawPayload: unknown;
  exampleId: string | null;
  example?: ExpressionLearningExample | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionLearningTrainingRecordsResponse {
  records: ExpressionLearningTrainingRecord[];
  summary: {
    total: number;
    open: number;
    archived: number;
    completed: number;
    dismissed: number;
  };
}

export interface XiaohongshuComment {
  id: string;
  postId: string;
  parentId: string | null;
  replyToId: string | null;
  externalId: string | null;
  authorName: string | null;
  authorUserId: string | null;
  content: string;
  isAuthor: boolean;
  replyToAuthorName: string | null;
  replyToAuthorUserId: string | null;
  sortOrder: number;
  status: string;
  replyNeed: string;
  source: string;
  publishedAt: string | null;
  lastSyncedAt: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  drafts: XiaohongshuReplyDraft[];
  replies: XiaohongshuComment[];
  learningExample: ExpressionLearningExample | null;
}

export interface XiaohongshuPost {
  id: string;
  externalId: string | null;
  url: string | null;
  title: string;
  caption: string | null;
  authorName: string | null;
  postType: string;
  imageCount: number;
  imageAlts: unknown;
  status: string;
  source: string;
  publishedAt: string | null;
  lastSyncedAt: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  comments: XiaohongshuComment[];
}

export interface XiaohongshuPostsResponse {
  posts: XiaohongshuPost[];
  postTypes: Record<string, string>;
}

export interface XiaohongshuImportStatus {
  mcpEnabled: boolean;
  chromeDevtoolsMcpEnabled: boolean;
  browserAvailable: boolean;
  connectionMode: "auto" | "browser_url";
  browserUrl: string | null;
  pageBehavior: {
    reusesExistingPage: boolean;
    leavesPageOpen: boolean;
    automaticScrolling: boolean;
    automaticExpansion: boolean;
    minimumOpenIntervalMs: number;
  };
}

export interface XiaohongshuImportResponse {
  posts: XiaohongshuPost[];
  imported: {
    posts: number;
    threads: number;
    comments: number;
    replies: number;
    authorReplies: number;
    learned: number;
  };
  importedPostId: string;
  browser: {
    reusedPage: boolean;
    pageLeftOpen: boolean;
    finalUrl: string;
    automaticScrolling: boolean;
    automaticExpansion: boolean;
    expandedReplyGroups: number;
  };
  warning: string | null;
}

export interface ToolCallLog {
  id: string;
  toolName: string;
  riskLevel: string;
  status: string;
  blocked: boolean;
  blockReason: string | null;
  userId: string | null;
  conversationId: string | null;
  messageId: string | null;
  channel: string | null;
  input: unknown;
  output: unknown;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface AdminMemoryUser {
  id: string;
  externalId: string;
  displayName: string | null;
}

export interface AdminMemory {
  id: string;
  userId: string | null;
  user?: AdminMemoryUser | null;
  type: string;
  scope: string;
  content: string;
  summary: string | null;
  importance: number;
  confidence: number;
  status: string;
  source: string | null;
  tags: unknown;
  entities: unknown;
  channel: string | null;
  conversationId: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMemoryActivityDay {
  date: string;
  count: number;
  importance: number;
}

export interface AdminMemoryActivity {
  days: AdminMemoryActivityDay[];
  totalCount: number;
  peakCount: number;
  peakImportance: number;
  metric: string;
  dateField: string;
}

export interface AdminMemoryWriteInput {
  token: string;
  memoryId?: string;
  userId?: string | null;
  type: string;
  scope: string;
  content: string;
  summary?: string | null;
  importance: number;
  confidence: number;
  status?: string;
  source?: string | null;
  tags?: unknown;
  entities?: unknown;
  channel?: string | null;
  conversationId?: string | null;
  metadata?: unknown;
}

export type MemoryProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "ignored";

export interface MemoryProposal {
  id: string;
  reportId: string;
  userId: string | null;
  conversationId: string | null;
  channel: string | null;
  proposalType: string;
  targetMemoryId: string | null;
  scope: string;
  type: string;
  content: string;
  summary: string | null;
  tags: unknown;
  entities: unknown;
  reason: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high" | string;
  status: MemoryProposalStatus | string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  appliedMemoryId: string | null;
  sourceMessageIds: unknown;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRiskFlag {
  id: string;
  reportId: string;
  type: string;
  severity: string;
  description: string;
  suggestedAction: string | null;
  relatedMessageIds: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthLogProposal {
  id: string;
  reportId: string;
  title: string;
  content: string;
  tags: unknown;
  confidence: number;
  status: string;
  sourceMessageIds: unknown;
  appliedMemoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DreamRunResult {
  jobId: string;
  status: string;
  dailyNoteId: string | null;
  diaryEntryId: string | null;
  signalCount: number;
  proposalCount: number;
  riskCount: number;
}

export interface DreamJob {
  id: string;
  status: string;
  triggerType: string;
  scope: string;
  userId: string | null;
  conversationId: string | null;
  channel: string | null;
  fromTime: string | null;
  toTime: string | null;
  phase: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  metadata: unknown;
  _count?: {
    dailyNotes: number;
    signals: number;
    diaryEntries: number;
    reports: number;
  };
}

export interface DreamDailyNote {
  id: string;
  jobId: string | null;
  date: string;
  scope: string;
  userId: string | null;
  channel: string | null;
  title: string | null;
  summary: string;
  keyPoints: unknown;
  sourceStats: unknown;
  riskSummary: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DreamSignal {
  id: string;
  jobId: string | null;
  signalType: string;
  content: string;
  summary: string | null;
  confidence: number;
  strength: number;
  riskLevel: string;
  sourceTypes: unknown;
  sourceIds: unknown;
  evidenceCount: number;
  tags: unknown;
  entities: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DreamDiaryEntry {
  id: string;
  jobId: string | null;
  date: string;
  title: string | null;
  content: string;
  style: string;
  grounded: boolean;
  sourceSignalIds: unknown;
  sourceMessageIds: unknown;
  visibility: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DreamMorningBrief {
  jobId: string;
  completedAt: string;
  dailyNoteId?: string;
  diaryEntryId?: string;
  signalCount: number;
  proposalCount: number;
  riskCount: number;
  topSignals: Array<{ signalType: string; content: string; confidence: number }>;
  summary: string;
}

export interface DreamConsolidationReport {
  id: string;
  jobId: string | null;
  summary: string;
  phase: string;
  candidateCount: number;
  promotedCount: number;
  rejectedCount: number;
  riskCount: number;
  generatedProposalIds: unknown;
  rawOutput: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface DreamDeepSleepDetail {
  reports: DreamConsolidationReport[];
  proposals: MemoryProposal[];
  riskFlags: MemoryRiskFlag[];
  growthLogs: GrowthLogProposal[];
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text) as { error?: string };
        if (data.error) throw new Error(data.error);
      } catch (error) {
        if (error instanceof Error && error.name === "Error") throw error;
      }
    }
    throw new Error(text || fallbackMessage);
  }
  return response.json() as Promise<T>;
}

function adminHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function sendChatMessage(input: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "发送失败");
  }

  return response.json() as Promise<ChatResponse>;
}

function parseSseEvent(rawEvent: string): ChatStreamEvent | null {
  const lines = rawEvent.split(/\r?\n/);
  const eventName = lines
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart());

  if (!eventName || dataLines.length === 0) return null;

  const data = JSON.parse(dataLines.join("\n")) as unknown;
  if (eventName === "ready") return { type: "ready", data: data as { ok: boolean; task_id?: string } };
  if (eventName === "progress") return { type: "progress", data: data as ChatReplyPart };
  if (eventName === "message") return { type: "message", data: data as ChatReplyPart };
  if (eventName === "done") return { type: "done", data: data as ChatResponse };
  if (eventName === "cancelled") return { type: "cancelled", data: data as { task_id?: string; reason?: string } };
  if (eventName === "error") return { type: "error", data: data as { error: string } };
  return null;
}

export async function streamChatMessage(
  input: ChatRequest,
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/v1/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "发送失败");
  }

  if (!response.body) {
    throw new Error("当前浏览器不支持流式响应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const chunks = buffer.split(/\n\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const event = parseSseEvent(chunk);
      if (!event) continue;
      onEvent(event);
      if (event.type === "error") streamError = event.data.error;
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseEvent(buffer);
    if (event) {
      onEvent(event);
      if (event.type === "error") streamError = event.data.error;
    }
  }

  if (streamError) throw new Error(streamError);
}

export async function cancelChatTask(input: {
  taskId: string;
  userId: string;
  conversationId: string;
}): Promise<RunningTaskResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/chat/tasks/${encodeURIComponent(input.taskId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: input.userId,
        conversation_id: input.conversationId,
      }),
    }
  );
  return parseJsonResponse<RunningTaskResponse>(response, "无法停止当前回复");
}

export async function fetchRunningTasks(token: string): Promise<RunningTasksResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/running-tasks`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<RunningTasksResponse>(response, "无法读取运行中任务");
}

export async function cancelRunningTask(input: {
  token: string;
  taskId: string;
}): Promise<RunningTaskResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/running-tasks/${encodeURIComponent(input.taskId)}/cancel`,
    {
      method: "POST",
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<RunningTaskResponse>(response, "无法停止运行中任务");
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return parseJsonResponse<HealthStatus>(response, "无法读取健康状态");
}

export async function fetchChannelStatus(): Promise<ChannelStatus> {
  const response = await fetch(`${API_BASE_URL}/v1/channels/status`);
  return parseJsonResponse<ChannelStatus>(response, "无法读取渠道状态");
}

export async function fetchRuntimeConfig(token: string): Promise<RuntimeConfig> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/runtime`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<RuntimeConfig>(response, "无法读取运行配置");
}

export async function fetchRuntimeState(token: string): Promise<RuntimeStateResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/runtime/state`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<RuntimeStateResponse>(response, "无法读取陆思源运行态");
}

export async function fetchRuntimeStateEventSources(
  token: string,
  eventId: string
): Promise<RuntimeStateEventSourcesResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/runtime/state/events/${encodeURIComponent(eventId)}/sources`,
    {
      headers: adminHeaders(token),
    }
  );
  return parseJsonResponse<RuntimeStateEventSourcesResponse>(
    response,
    "无法读取状态变更来源"
  );
}

export async function updateRuntimeState(
  input: RuntimeStateUpdateInput
): Promise<RuntimeStateResponse> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/runtime/state`, {
    method: "PATCH",
    headers: {
      ...adminHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<RuntimeStateResponse>(response, "保存运行态失败");
}

export async function resetRuntimeState(token: string): Promise<RuntimeStateResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/runtime/state/reset`, {
    method: "POST",
    headers: adminHeaders(token),
  });
  return parseJsonResponse<RuntimeStateResponse>(response, "重置运行态失败");
}

export async function runRuntimeAutonomyTick(token: string): Promise<RuntimeStateResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/runtime/autonomy/tick`, {
    method: "POST",
    headers: adminHeaders(token),
  });
  return parseJsonResponse<RuntimeStateResponse>(response, "自启动检查失败");
}

export async function createAutonomousTask(input: {
  token: string;
  title: string;
  description: string;
  type: string;
  priority: number;
}): Promise<{ task: AutonomousTask }> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/runtime/autonomous-tasks`, {
    method: "POST",
    headers: {
      ...adminHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ task: AutonomousTask }>(response, "创建自主任务失败");
}

export async function updateAutonomousTask(input: {
  token: string;
  taskId: string;
  status?: string;
  priority?: number;
}): Promise<{ task: AutonomousTask }> {
  const { token, taskId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/runtime/autonomous-tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: {
        ...adminHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ task: AutonomousTask }>(response, "更新自主任务失败");
}

export async function runAutonomousTask(input: {
  token: string;
  taskId: string;
}): Promise<AutonomousTaskRunResult> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/runtime/autonomous-tasks/${encodeURIComponent(input.taskId)}/run`,
    {
      method: "POST",
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<AutonomousTaskRunResult>(response, "推进自主任务失败");
}

export async function fetchRelationships(input: {
  token: string;
  q?: string;
  limit?: number;
}): Promise<RelationshipListResponse> {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/v1/admin/relationships${query ? `?${query}` : ""}`, {
    headers: adminHeaders(input.token),
  });
  return parseJsonResponse<RelationshipListResponse>(response, "无法读取关系状态");
}

export async function fetchRelationshipDetail(input: {
  token: string;
  relationshipId: string;
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/relationships/${input.relationshipId}`, {
    headers: adminHeaders(input.token),
  });
  return parseJsonResponse<RelationshipDetailResponse>(response, "无法读取关系详情");
}

export async function mergeRelationshipIdentities(input: {
  token: string;
  sourceRelationshipId: string;
  targetRelationshipId: string;
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/relationships/merge`, {
    method: "POST",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_relationship_id: input.sourceRelationshipId,
      target_relationship_id: input.targetRelationshipId,
    }),
  });
  return parseJsonResponse<RelationshipDetailResponse>(response, "合并身份失败");
}

export async function splitRelationshipIdentity(input: {
  token: string;
  relationshipId: string;
  userIds: string[];
  newLabel?: string;
  newAffinity?: number;
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/relationships/${input.relationshipId}/split`, {
    method: "POST",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_ids: input.userIds,
      new_label: input.newLabel,
      new_affinity: input.newAffinity,
    }),
  });
  return parseJsonResponse<RelationshipDetailResponse>(response, "拆分身份失败");
}

export async function updateRelationshipIdentityLabel(input: {
  token: string;
  relationshipId: string;
  label: string | null;
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/relationships/${input.relationshipId}/person`, {
    method: "PATCH",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label: input.label }),
  });
  return parseJsonResponse<RelationshipDetailResponse>(response, "修改身份名称失败");
}

export async function updateRelationshipUserDisplayName(input: {
  token: string;
  relationshipId: string;
  userId: string;
  displayName: string | null;
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/relationships/${input.relationshipId}/users/${input.userId}`,
    {
      method: "PATCH",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ display_name: input.displayName }),
    }
  );
  return parseJsonResponse<RelationshipDetailResponse>(response, "修改渠道昵称失败");
}

export async function updateRelationshipState(
  input: RelationshipUpdateInput
): Promise<RelationshipDetailResponse> {
  const { token, relationshipId, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/relationships/${relationshipId}`, {
    method: "PATCH",
    headers: {
      ...adminHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<RelationshipDetailResponse>(response, "保存关系状态失败");
}

export async function fetchIdentityLinkProposals(input: {
  token: string;
  status?: string;
  limit?: number;
}): Promise<IdentityLinkProposalListResponse> {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/identity-link-proposals${query ? `?${query}` : ""}`,
    {
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<IdentityLinkProposalListResponse>(response, "无法读取身份怀疑");
}

export async function approveIdentityLinkProposal(input: {
  token: string;
  proposalId: string;
}): Promise<IdentityLinkProposalReviewResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/identity-link-proposals/${input.proposalId}/approve`,
    {
      method: "POST",
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<IdentityLinkProposalReviewResponse>(response, "确认身份合并失败");
}

export async function rejectIdentityLinkProposal(input: {
  token: string;
  proposalId: string;
}): Promise<IdentityLinkProposalReviewResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/identity-link-proposals/${input.proposalId}/reject`,
    {
      method: "POST",
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<IdentityLinkProposalReviewResponse>(response, "忽略身份怀疑失败");
}

export async function applyRelationshipReviewProposal(input: {
  token: string;
  proposalId: string;
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/relationship-review-proposals/${input.proposalId}/apply`,
    {
      method: "POST",
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<RelationshipDetailResponse>(response, "应用关系复盘失败");
}

export async function rejectRelationshipReviewProposal(input: {
  token: string;
  proposalId: string;
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/relationship-review-proposals/${input.proposalId}/reject`,
    {
      method: "POST",
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<RelationshipDetailResponse>(response, "忽略关系复盘失败");
}

export async function resetRelationshipState(input: {
  token: string;
  relationshipId: string;
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/relationships/${input.relationshipId}/reset`, {
    method: "POST",
    headers: adminHeaders(input.token),
  });
  return parseJsonResponse<RelationshipDetailResponse>(response, "重置关系状态失败");
}

export async function fetchConversationPeople(input: {
  token: string;
  query?: string;
  limit?: number;
}): Promise<ConversationPeopleResponse> {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/conversation-people${query ? `?${query}` : ""}`,
    {
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<ConversationPeopleResponse>(response, "无法读取对话身份列表");
}

export async function fetchConversationPersonDetail(input: {
  token: string;
  personId: string;
  conversationLimit?: number;
}): Promise<ConversationPersonDetailResponse> {
  const params = new URLSearchParams();
  if (input.conversationLimit) {
    params.set("conversationLimit", String(input.conversationLimit));
  }
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/conversation-people/${input.personId}${query ? `?${query}` : ""}`,
    {
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<ConversationPersonDetailResponse>(response, "无法读取现实身份对话详情");
}

export async function fetchAdminConversationMessages(input: {
  token: string;
  conversationId: string;
  limit?: number;
}): Promise<AdminConversationMessagesResponse> {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/conversations/${input.conversationId}/messages${query ? `?${query}` : ""}`,
    {
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<AdminConversationMessagesResponse>(response, "无法读取会话消息");
}

export async function fetchWebChatConversations(input: {
  token: string;
  limit?: number;
}): Promise<WebChatConversationsResponse> {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/web-chat/conversations${query ? `?${query}` : ""}`,
    {
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<WebChatConversationsResponse>(response, "无法读取 Web Chat 会话");
}

export async function fetchEditableEnvConfig(token: string): Promise<EditableEnvConfig> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/config/env`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<EditableEnvConfig>(response, "无法读取可编辑配置");
}

export async function fetchRuntimeSettings(token: string): Promise<RuntimeSettingsResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/settings`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<RuntimeSettingsResponse>(response, "无法读取运行配置");
}

export async function saveRuntimeSettings(input: {
  token: string;
  values: Record<string, string | boolean | number>;
}): Promise<RuntimeSettingsResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/settings`, {
    method: "PATCH",
    headers: { ...adminHeaders(input.token), "Content-Type": "application/json" },
    body: JSON.stringify({ values: input.values }),
  });
  return parseJsonResponse<RuntimeSettingsResponse>(response, "保存运行配置失败");
}

export async function fetchRuntimeSettingEvents(token: string): Promise<{ events: RuntimeSettingEvent[] }> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/settings/events`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<{ events: RuntimeSettingEvent[] }>(response, "无法读取配置变更记录");
}

export async function saveEditableEnvConfig(input: {
  token: string;
  values: Record<string, string | boolean | number>;
  deleteKeys?: string[];
  deleteSecretValueIndexes?: Record<string, number[]>;
}): Promise<EditableEnvConfig> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/config/env`, {
    method: "PATCH",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: input.values,
      deleteKeys: input.deleteKeys,
      deleteSecretValueIndexes: input.deleteSecretValueIndexes,
    }),
  });
  return parseJsonResponse<EditableEnvConfig>(response, "保存配置失败");
}

export async function clearDatabaseData(input: {
  token: string;
  password: string;
  confirmText: string;
}): Promise<ClearDatabaseResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/database/clear`, {
    method: "POST",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: input.password,
      confirmText: input.confirmText,
    }),
  });
  return parseJsonResponse<ClearDatabaseResponse>(response, "清空数据库失败");
}

export async function fetchRegisteredTools(token: string): Promise<ToolRegistryResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/tools`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<ToolRegistryResponse>(response, "无法读取工具列表");
}

export async function fetchSkills(token: string): Promise<SkillsResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/skills`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<SkillsResponse>(response, "无法读取 Skill 列表");
}

export async function fetchExpressionLearningExamples(input: {
  token: string;
  platform?: string;
  scene?: string;
  status?: string;
  outcome?: string;
  query?: string;
}): Promise<ExpressionLearningResponse> {
  const params = new URLSearchParams();
  if (input.platform && input.platform !== "all") params.set("platform", input.platform);
  if (input.scene && input.scene !== "all") params.set("scene", input.scene);
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.outcome && input.outcome !== "all") params.set("outcome", input.outcome);
  if (input.query) params.set("q", input.query);
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/examples?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<ExpressionLearningResponse>(response, "无法读取表达学习记录");
}

export async function createExpressionLearningExample(
  input: ExpressionLearningCreateInput
): Promise<{ example: ExpressionLearningExample; trainingRecord?: ExpressionLearningTrainingRecord }> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/examples`, {
    method: "POST",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ example: ExpressionLearningExample; trainingRecord?: ExpressionLearningTrainingRecord }>(
    response,
    "创建表达经验失败"
  );
}

export async function generateExpressionLearningPracticeQuestion(input: {
  token: string;
  platform: string;
  scene: string;
  focus?: string | null;
}): Promise<ExpressionLearningPracticeQuestionResponse> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/practice-question`, {
    method: "POST",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<ExpressionLearningPracticeQuestionResponse>(
    response,
    "生成练习题失败"
  );
}

export async function generateExpressionLearningDraft(input: {
  token: string;
  platform: string;
  scene: string;
  contextText: string;
}): Promise<ExpressionLearningDraftResponse> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/draft`, {
    method: "POST",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<ExpressionLearningDraftResponse>(response, "生成陆思源草稿失败");
}

export async function downloadExpressionLearningTrainingExport(input: {
  token: string;
  format: "json" | "jsonl";
}): Promise<Blob> {
  const params = new URLSearchParams({ format: input.format });
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/training-records/export?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "导出训练数据失败");
  }
  return response.blob();
}

export async function fetchExpressionLearningTrainingRecords(input: {
  token: string;
  sourceType?: string;
  status?: string;
}): Promise<ExpressionLearningTrainingRecordsResponse> {
  const params = new URLSearchParams();
  if (input.sourceType && input.sourceType !== "all") params.set("sourceType", input.sourceType);
  if (input.status && input.status !== "all") params.set("status", input.status);
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/training-records?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<ExpressionLearningTrainingRecordsResponse>(
    response,
    "无法读取表达习题册"
  );
}

export async function updateExpressionLearningTrainingRecord(input: {
  token: string;
  recordId: string;
  status?: string;
  finalText?: string | null;
  outcome?: "sent" | "skipped" | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
  reasonText?: string | null;
}): Promise<{ record: ExpressionLearningTrainingRecord }> {
  const { token, recordId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/training-records/${recordId}`,
    {
      method: "PATCH",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ record: ExpressionLearningTrainingRecord }>(
    response,
    "保存习题状态失败"
  );
}

export async function updateExpressionLearningExample(input: {
  token: string;
  exampleId: string;
  lesson?: string;
  reasoning?: string | null;
  strategy?: string | null;
  tone?: string | null;
  ownerNote?: string | null;
  status?: "pending" | "active" | "disabled";
  scope?: string;
}): Promise<{ example: ExpressionLearningExample }> {
  const { token, exampleId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/examples/${exampleId}`,
    {
      method: "PATCH",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ example: ExpressionLearningExample }>(response, "保存表达经验失败");
}

export async function reanalyzeExpressionLearningExample(input: {
  token: string;
  exampleId: string;
}): Promise<{ example: ExpressionLearningExample }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/examples/${input.exampleId}/reanalyze`,
    { method: "POST", headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<{ example: ExpressionLearningExample }>(response, "重新分析表达经验失败");
}

export async function fetchXiaohongshuReplyConfig(
  token: string
): Promise<XiaohongshuReplyConfigResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/skills/xiaohongshu-reply/config`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<XiaohongshuReplyConfigResponse>(response, "无法读取小红书回复配置");
}

export async function saveXiaohongshuReplyConfig(input: {
  token: string;
  config: XiaohongshuReplyConfig;
}): Promise<XiaohongshuReplyConfigResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/skills/xiaohongshu-reply/config`, {
    method: "PATCH",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ config: input.config }),
  });
  return parseJsonResponse<XiaohongshuReplyConfigResponse>(response, "保存小红书回复配置失败");
}

export async function resetXiaohongshuReplyConfig(
  token: string
): Promise<XiaohongshuReplyConfigResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/skills/xiaohongshu-reply/config/reset`, {
    method: "POST",
    headers: adminHeaders(token),
  });
  return parseJsonResponse<XiaohongshuReplyConfigResponse>(response, "重置小红书回复配置失败");
}

export async function generateXiaohongshuReplyDraft(input: {
  token: string;
  postTitle: string;
  postCaption?: string;
  postType?: string;
  comment: string;
  threadContext?: string;
}): Promise<XiaohongshuReplyResult> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/skills/xiaohongshu-reply/draft`, {
    method: "POST",
    headers: {
      ...adminHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<XiaohongshuReplyResult>(response, "生成小红书回复草稿失败");
}

export async function fetchXiaohongshuPosts(token: string): Promise<XiaohongshuPostsResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/xiaohongshu/posts`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<XiaohongshuPostsResponse>(response, "无法读取小红书帖子");
}

export async function fetchXiaohongshuImportStatus(token: string): Promise<XiaohongshuImportStatus> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/xiaohongshu/import-status`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<XiaohongshuImportStatus>(response, "无法读取小红书导入状态");
}

export async function importXiaohongshuUrl(input: {
  token: string;
  url: string;
}): Promise<XiaohongshuImportResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/xiaohongshu/import-url`, {
    method: "POST",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: input.url }),
  });
  return parseJsonResponse<XiaohongshuImportResponse>(response, "读取并导入小红书帖子失败");
}

export async function updateXiaohongshuPost(input: {
  token: string;
  postId: string;
  title?: string;
  caption?: string | null;
  authorName?: string | null;
  postType?: string;
  imageCount?: number;
  imageAlts?: string[];
}): Promise<{ posts: XiaohongshuPost[] }> {
  const { token, postId, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/xiaohongshu/posts/${postId}`, {
    method: "PATCH",
    headers: {
      ...adminHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ posts: XiaohongshuPost[] }>(response, "保存小红书帖子失败");
}

export async function updateXiaohongshuComment(input: {
  token: string;
  commentId: string;
  content?: string;
  authorName?: string | null;
}): Promise<{ posts: XiaohongshuPost[] }> {
  const { token, commentId, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/xiaohongshu/comments/${commentId}`, {
    method: "PATCH",
    headers: {
      ...adminHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ posts: XiaohongshuPost[] }>(response, "保存小红书评论失败");
}

export async function generateXiaohongshuCommentReply(input: {
  token: string;
  commentId: string;
}): Promise<{
  output: XiaohongshuReplyResult;
  draft: XiaohongshuReplyDraft;
  comment: XiaohongshuComment;
}> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/xiaohongshu/comments/${input.commentId}/generate-reply`,
    {
      method: "POST",
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<{
    output: XiaohongshuReplyResult;
    draft: XiaohongshuReplyDraft;
    comment: XiaohongshuComment;
  }>(response, "生成小红书评论回复失败");
}

export async function updateXiaohongshuReplyDraft(input: {
  token: string;
  draftId: string;
  content: string;
  status?: string;
}): Promise<{ draft: XiaohongshuReplyDraft }> {
  const { token, draftId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/xiaohongshu/reply-drafts/${draftId}`,
    {
      method: "PATCH",
      headers: {
        ...adminHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ draft: XiaohongshuReplyDraft }>(
    response,
    "保存小红书回复草稿失败"
  );
}

export async function recordXiaohongshuFinalDecision(input: {
  token: string;
  commentId: string;
  draftId?: string | null;
  content?: string | null;
  outcome: "sent" | "skipped";
  ownerNote?: string | null;
}): Promise<{ posts: XiaohongshuPost[]; learningExample: ExpressionLearningExample }> {
  const { token, commentId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/xiaohongshu/comments/${commentId}/final-decision`,
    {
      method: "POST",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ posts: XiaohongshuPost[]; learningExample: ExpressionLearningExample }>(
    response,
    "记录最终回复并学习失败"
  );
}

export async function fetchToolCallLogs(input: {
  token: string;
  userId?: string;
  toolName?: string;
  status?: string;
  riskLevel?: string;
  blocked?: string;
  channel?: string;
  conversationId?: string;
  query?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<ToolCallLog[]> {
  const params = new URLSearchParams();
  if (input.userId) params.set("userId", input.userId);
  if (input.toolName && input.toolName !== "all") params.set("toolName", input.toolName);
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.riskLevel && input.riskLevel !== "all") params.set("riskLevel", input.riskLevel);
  if (input.blocked && input.blocked !== "all") params.set("blocked", input.blocked);
  if (input.channel) params.set("channel", input.channel);
  if (input.conversationId) params.set("conversationId", input.conversationId);
  if (input.query) params.set("q", input.query);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(`${API_BASE_URL}/v1/tool-logs?${params.toString()}`, {
    headers: adminHeaders(input.token),
  });
  const data = await parseJsonResponse<{ logs: ToolCallLog[] }>(
    response,
    "无法读取工具调用日志"
  );
  return data.logs ?? [];
}

export async function fetchAdminMemories(input: {
  token: string;
  userId?: string;
  status?: string;
  scope?: string;
  type?: string;
  query?: string;
  from?: string;
  to?: string;
  dateField?: string;
  sort?: string;
  limit?: number;
}): Promise<AdminMemory[]> {
  const params = new URLSearchParams();
  if (input.userId) params.set("user_id", input.userId);
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.scope && input.scope !== "all") params.set("scope", input.scope);
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.query) params.set("q", input.query);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.dateField) params.set("date_field", input.dateField);
  if (input.sort) params.set("sort", input.sort);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${API_BASE_URL}/v1/admin/memories?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  const data = await parseJsonResponse<{ memories: AdminMemory[] }>(
    response,
    "无法读取记忆库"
  );
  return data.memories ?? [];
}

export async function fetchAdminMemoryActivity(input: {
  token: string;
  userId?: string;
  status?: string;
  scope?: string;
  type?: string;
  query?: string;
  dateField?: string;
  metric?: string;
}): Promise<AdminMemoryActivity> {
  const params = new URLSearchParams();
  if (input.userId) params.set("user_id", input.userId);
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.scope && input.scope !== "all") params.set("scope", input.scope);
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.query) params.set("q", input.query);
  if (input.dateField) params.set("date_field", input.dateField);
  if (input.metric) params.set("metric", input.metric);

  const response = await fetch(
    `${API_BASE_URL}/v1/admin/memories/activity?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<AdminMemoryActivity>(
    response,
    "无法读取记忆活跃统计"
  );
}

function adminMemoryBody(input: AdminMemoryWriteInput) {
  return {
    user_id: input.userId,
    type: input.type,
    scope: input.scope,
    content: input.content,
    summary: input.summary,
    importance: input.importance,
    confidence: input.confidence,
    status: input.status,
    source: input.source,
    tags: input.tags,
    entities: input.entities,
    channel: input.channel,
    conversation_id: input.conversationId,
    metadata: input.metadata,
  };
}

export async function createAdminMemory(input: AdminMemoryWriteInput): Promise<AdminMemory> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/memories`, {
    method: "POST",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(adminMemoryBody(input)),
  });
  const data = await parseJsonResponse<{ memory: AdminMemory }>(
    response,
    "新增记忆失败"
  );
  return data.memory;
}

export async function updateAdminMemory(input: AdminMemoryWriteInput): Promise<AdminMemory> {
  if (!input.memoryId) throw new Error("memoryId is required");
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/memories/${encodeURIComponent(input.memoryId)}`,
    {
      method: "PATCH",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(adminMemoryBody(input)),
    }
  );
  const data = await parseJsonResponse<{ memory: AdminMemory }>(
    response,
    "更新记忆失败"
  );
  return data.memory;
}

export async function archiveAdminMemory(input: {
  token: string;
  memoryId: string;
}): Promise<AdminMemory> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/memories/${encodeURIComponent(input.memoryId)}`,
    {
      method: "DELETE",
      headers: adminHeaders(input.token),
    }
  );
  const data = await parseJsonResponse<{ memory: AdminMemory }>(
    response,
    "归档记忆失败"
  );
  return data.memory;
}

export async function fetchMemoryProposals(input: {
  token: string;
  status?: string;
  riskLevel?: string;
  proposalType?: string;
  scope?: string;
  type?: string;
  userId?: string;
  reportId?: string;
  query?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<MemoryProposal[]> {
  const params = new URLSearchParams();
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.riskLevel && input.riskLevel !== "all") params.set("risk_level", input.riskLevel);
  if (input.proposalType && input.proposalType !== "all") {
    params.set("proposal_type", input.proposalType);
  }
  if (input.scope && input.scope !== "all") params.set("scope", input.scope);
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.userId) params.set("user_id", input.userId);
  if (input.reportId) params.set("report_id", input.reportId);
  if (input.query) params.set("q", input.query);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${API_BASE_URL}/v1/memory/proposals?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  const data = await parseJsonResponse<{ proposals: MemoryProposal[] }>(
    response,
    "无法读取记忆提案"
  );
  return data.proposals ?? [];
}

export async function approveMemoryProposal(input: {
  token: string;
  proposalId: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/memory/proposals/${encodeURIComponent(input.proposalId)}/approve`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.reviewerId ?? "admin:web" }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "批准提案失败"
  );
  return data.proposal;
}

export async function rejectMemoryProposal(input: {
  token: string;
  proposalId: string;
  reason?: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/memory/proposals/${encodeURIComponent(input.proposalId)}/reject`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: input.reviewerId ?? "admin:web",
        reason: input.reason,
      }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "拒绝提案失败"
  );
  return data.proposal;
}

export async function applyMemoryProposal(input: {
  token: string;
  proposalId: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/memory/proposals/${encodeURIComponent(input.proposalId)}/apply`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.reviewerId ?? "admin:web" }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "应用提案失败"
  );
  return data.proposal;
}

export async function applyMemoryProposalGlobally(input: {
  token: string;
  proposalId: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/memory/proposals/${encodeURIComponent(input.proposalId)}/apply-global`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.reviewerId ?? "admin:web" }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "全局应用提案失败"
  );
  return data.proposal;
}

export async function revokeMemoryProposal(input: {
  token: string;
  proposalId: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/memory/proposals/${encodeURIComponent(input.proposalId)}/revoke`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.reviewerId ?? "admin:web" }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "撤回提案失败"
  );
  return data.proposal;
}

export async function fetchMemoryRisks(input: {
  token: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<MemoryRiskFlag[]> {
  const params = new URLSearchParams();
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${API_BASE_URL}/v1/memory/risks?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  const data = await parseJsonResponse<{ risks: MemoryRiskFlag[] }>(
    response,
    "无法读取记忆风险项"
  );
  return data.risks ?? [];
}

export async function runDream(input: {
  token: string;
  userId?: string;
}): Promise<DreamRunResult> {
  const response = await fetch(`${API_BASE_URL}/v1/dream/run`, {
    method: "POST",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: input.userId,
    }),
  });
  const data = await parseJsonResponse<{
    job_id: string;
    status: string;
    daily_note_id: string | null;
    diary_entry_id: string | null;
    signal_count: number;
    proposal_count: number;
    risk_count: number;
  }>(response, "运行 Dream 失败");
  return {
    jobId: data.job_id,
    status: data.status,
    dailyNoteId: data.daily_note_id,
    diaryEntryId: data.diary_entry_id,
    signalCount: data.signal_count,
    proposalCount: data.proposal_count,
    riskCount: data.risk_count,
  };
}

export async function fetchDreamJobs(input: {
  token: string;
  status?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<DreamJob[]> {
  const params = new URLSearchParams();
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.userId) params.set("user_id", input.userId);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${API_BASE_URL}/v1/dream/jobs?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  const data = await parseJsonResponse<{ jobs: DreamJob[] }>(
    response,
    "无法读取 Dream 作业"
  );
  return data.jobs ?? [];
}

export async function fetchDreamDailyNotes(input: {
  token: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<DreamDailyNote[]> {
  const params = new URLSearchParams();
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${API_BASE_URL}/v1/dream/daily-notes?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<DreamDailyNote[]>(response, "无法读取 Dream Daily Note");
}

export async function fetchDreamSignals(input: {
  token: string;
  signalType?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<DreamSignal[]> {
  const params = new URLSearchParams();
  if (input.signalType && input.signalType !== "all") {
    params.set("signal_type", input.signalType);
  }
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${API_BASE_URL}/v1/dream/signals?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<DreamSignal[]>(response, "无法读取 Dream Signal");
}

export async function fetchDreamDiary(input: {
  token: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<DreamDiaryEntry[]> {
  const params = new URLSearchParams();
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${API_BASE_URL}/v1/dream/diary?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<DreamDiaryEntry[]>(response, "无法读取 Dream Diary");
}

export async function fetchDreamMorningBrief(input: {
  token: string;
  jobId: string;
}): Promise<DreamMorningBrief> {
  const response = await fetch(
    `${API_BASE_URL}/v1/dream/jobs/${encodeURIComponent(input.jobId)}/morning-brief`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<DreamMorningBrief>(response, "无法读取 Morning Brief");
}

export async function fetchDreamDeepSleep(input: {
  token: string;
  jobId: string;
}): Promise<DreamDeepSleepDetail> {
  const response = await fetch(
    `${API_BASE_URL}/v1/dream/jobs/${encodeURIComponent(input.jobId)}/deep-sleep`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<DreamDeepSleepDetail>(
    response,
    "无法读取 Deep Sleep 整合结果"
  );
}

export async function fetchConversationMessages(
  conversationId: string,
  userId?: string
): Promise<ConversationMessage[]> {
  try {
    const params = new URLSearchParams();
    if (userId) params.set("user_id", userId);
    const query = params.toString();
    const response = await fetch(
      `${API_BASE_URL}/v1/conversations/${encodeURIComponent(conversationId)}/messages${query ? `?${query}` : ""}`
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { messages: ConversationMessage[] };
    return data.messages ?? [];
  } catch {
    return [];
  }
}
