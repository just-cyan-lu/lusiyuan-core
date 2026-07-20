import type {
  ChatRequest,
  ChatReplyPart,
  ChatResponse,
  ChatStreamEvent,
  ConversationMessage,
  VoiceStreamEvent,
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
  assignedTo: string[];
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  model: string | null;
}

export interface RuntimeConfig {
  modelRoutes: {
    default: string;
    chat: string;
    dream: string;
    expressionLearning: string;
  };
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
  sourceMessageIds: unknown;
  channel: string | null;
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
  messages: RuntimeSourceMessage[];
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

export interface IdentityAlias {
  id: string;
  personId: string;
  sourceUserId: string | null;
  value: string;
  normalizedValue: string;
  source: string;
  confidence: number;
  mentionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonIdentity {
  id: string;
  label: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  identityLinks: IdentityLink[];
  identityAliases?: IdentityAlias[];
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

export interface ExternalIdentityResearchJob {
  id: string;
  personId: string;
  sourceUserId: string | null;
  sourceMessageId: string | null;
  queryAliases: unknown;
  trigger: string;
  status: string;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalIdentityCandidate {
  id: string;
  jobId: string;
  personId: string;
  alias: string;
  canonicalName: string;
  role: string | null;
  summary: string;
  publicReach: string | null;
  region: string | null;
  confidence: number;
  relevanceScore: number;
  sources: unknown;
  status: "pending" | "confirmed" | "rejected" | "superseded";
  promptedAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalIdentityResearchResponse {
  jobs: ExternalIdentityResearchJob[];
  candidates: ExternalIdentityCandidate[];
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
  note: string | null;
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
  note: string | null;
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

export interface ConversationUpdateResponse {
  conversation: AdminConversation;
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
  scene: string;
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
  status: "active" | "disabled";
  analysisVersion: number;
  embeddingStatus: string;
  embeddingError: string | null;
  lastUsedAt: string | null;
  accessCount: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  ruleEvidences?: Array<{
    id: string;
    coverage: "partial" | "full";
    relation: "supports" | "contradicts";
    rule: { id: string; ruleText: string; status: "draft" | "active" | "disabled" };
  }>;
}

export interface ExpressionLearningResponse {
  examples: ExpressionLearningExample[];
  summary: { total: number; active: number; skipped: number };
  scenes: string[];
}

export interface ExpressionLearningRuleEvidence {
  id: string;
  ruleId: string;
  exampleId: string;
  relation: "supports" | "contradicts";
  coverage: "partial" | "full";
  createdAt: string;
  example: ExpressionLearningExample;
}

export interface ExpressionLearningRule {
  id: string;
  ruleText: string;
  kind: "avoid" | "prefer" | "strategy";
  scope: "global" | "scene";
  scene: string | null;
  strength: "hard" | "soft";
  status: "draft" | "active" | "disabled";
  source: "manual" | "distilled" | "markdown";
  publishedPath: string | null;
  publishedRuleKey: string | null;
  publishedContentHash: string | null;
  publishedAt: string | null;
  metadata: unknown;
  evidences: ExpressionLearningRuleEvidence[];
  createdAt: string;
  updatedAt: string;
  publication?: {
    state: "unpublished" | "synced" | "outdated" | "file_modified" | "missing";
    path: string | null;
  };
}

export interface ExpressionLearningRuleCandidate {
  ruleText: string;
  kind: ExpressionLearningRule["kind"];
  scope: ExpressionLearningRule["scope"];
  scene: string | null;
  strength: ExpressionLearningRule["strength"];
  coverage: "partial" | "full";
  reason: string;
}

export interface ExpressionLearningRulesResponse {
  rules: ExpressionLearningRule[];
  summary: { total: number; active: number; draft: number };
}

export interface ExpressionLearningDistillationCandidate {
  id: string;
  batchId: string;
  ruleText: string;
  kind: ExpressionLearningRule["kind"];
  scope: ExpressionLearningRule["scope"];
  scene: string | null;
  strength: ExpressionLearningRule["strength"];
  coverage: "partial" | "full";
  reason: string | null;
  sourceExampleIds: unknown;
  matchType: "new" | "duplicate" | "conflict";
  matchedRuleId: string | null;
  matchReason: string | null;
  status: "proposed" | "accepted" | "merged" | "dismissed";
  createdRuleId: string | null;
  resolvedAt: string | null;
  matchedRule: ExpressionLearningRule | null;
  createdRule: ExpressionLearningRule | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionLearningDistillationBatch {
  id: string;
  status: "processing" | "proposed" | "completed" | "failed";
  scene: string | null;
  organization: "unorganized" | "partial" | "full" | "all";
  fromTime: string | null;
  toTime: string | null;
  sourceExampleIds: unknown;
  sourceCount: number;
  candidateCount: number;
  rawOutput: unknown;
  error: string | null;
  completedAt: string | null;
  candidates: ExpressionLearningDistillationCandidate[];
  sourceExamples: ExpressionLearningExample[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionLearningDistillationBatchesResponse {
  batches: ExpressionLearningDistillationBatch[];
}

export interface ExpressionLearningAnalysis {
  lesson: string;
  reasoning: string;
  strategy: string;
  tone: string;
  avoidances: string[];
  tags: string[];
  confidence: number;
}

export interface ExpressionLearningCreateInput {
  token: string;
  trainingRecordId?: string | null;
  sourceType?: string;
  scene: string;
  contextText: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome: "sent" | "skipped";
  ownerAction?: string;
  ownerNote?: string | null;
  status?: "active" | "disabled";
  analysis?: Partial<ExpressionLearningAnalysis> | null;
  metadata?: Record<string, unknown>;
}

export interface ExpressionLearningPracticeQuestion {
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
  reason: string;
  referenceExampleIds: string[];
  trainingRecord?: ExpressionLearningTrainingRecord;
}

export interface ExpressionLearningTrainingRecord {
  id: string;
  sourceType: string;
  scene: string;
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

export interface ExpressionLearningTrainingDraftInput {
  token: string;
  recordId?: string | null;
  sourceType?: string;
  scene: string;
  status?: string;
  contextText?: string | null;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: "sent" | "skipped" | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
  reasonText?: string | null;
  generatedQuestion?: unknown;
  generatedDraft?: unknown;
  analysisSnapshot?: unknown;
}

export interface ExpressionLearningDialogueTurn {
  id: string;
  caseId: string;
  parentTurnId: string | null;
  branchLabel: string | null;
  userText: string;
  pathText: string | null;
  draftText: string | null;
  finalText: string | null;
  outcome: "sent" | "skipped" | null;
  ownerAction: string | null;
  ownerNote: string | null;
  analysisSnapshot: unknown;
  exampleId: string | null;
  example?: ExpressionLearningExample | null;
  status: string;
  needsReview: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionLearningDialogueCase {
  id: string;
  scene: string;
  title: string;
  trainingFocus: string | null;
  rootContextText: string;
  status: "draft" | "active" | "archived";
  createdFrom: string;
  metadata: unknown;
  turns: ExpressionLearningDialogueTurn[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionLearningDialogueCasesResponse {
  cases: ExpressionLearningDialogueCase[];
  summary: {
    total: number;
    draft: number;
    active: number;
    archived: number;
  };
}

export interface ExpressionLearningDialogueCaseInput {
  token: string;
  scene: string;
  title?: string | null;
  trainingFocus?: string | null;
  rootContextText: string;
  status?: "draft" | "active" | "archived";
}

export interface ExpressionLearningDialogueTurnInput {
  token: string;
  caseId: string;
  parentTurnId?: string | null;
  branchLabel?: string | null;
  userText: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: "sent" | "skipped" | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
  status?: string;
}

export interface ExpressionLearningDialogueTurnPatch {
  token: string;
  turnId: string;
  parentTurnId?: string | null;
  branchLabel?: string | null;
  userText?: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: "sent" | "skipped" | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
  analysisSnapshot?: unknown;
  status?: string;
}

export interface ExpressionLearningDialogueTurnDecisionInput {
  token: string;
  turnId: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: "sent" | "skipped" | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
  analysis?: Partial<ExpressionLearningAnalysis> | null;
  status?: "active" | "disabled";
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
  publisher: {
    enabled: boolean;
  };
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

export interface AdminMemoryLinkedUser {
  id: string;
  externalId: string;
  displayName: string | null;
}

export interface AdminMemoryPerson {
  id: string;
  label: string | null;
  note: string | null;
  identityLinks?: Array<{
    id: string;
    userId: string;
    user: AdminMemoryLinkedUser;
  }>;
}

export interface AdminMemory {
  id: string;
  personId: string | null;
  person?: AdminMemoryPerson | null;
  type: string;
  scope: string;
  tier: string;
  tierMentionCount: number;
  tierEnteredAt: string | null;
  content: string;
  summary: string | null;
  status: string;
  sourceMessageIds: unknown;
  mentionDayKeys: unknown;
  lastMentionedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMemoryEvidence {
  memory: AdminMemory;
  messages: RuntimeSourceMessage[];
  missingMessageIds: string[];
  mentionDayKeys: string[];
}

export interface AdminMemoryActivityDay {
  date: string;
  count: number;
}

export interface AdminMemoryActivity {
  days: AdminMemoryActivityDay[];
  totalCount: number;
  peakCount: number;
  metric: string;
  dateField: string;
}

export interface AdminMemoryWriteInput {
  token: string;
  memoryId?: string;
  personId?: string | null;
  type: string;
  scope: string;
  tier?: string;
  content: string;
  summary?: string | null;
  status?: string;
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
  rawOutput: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface DreamDeepSleepDetail {
  reports: DreamConsolidationReport[];
  memories: AdminMemory[];
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
  if (eventName === "voice_start") return { type: "voice_start", data: data as VoiceStreamEvent["data"] } as VoiceStreamEvent;
  if (eventName === "voice_chunk") return { type: "voice_chunk", data: data as VoiceStreamEvent["data"] } as VoiceStreamEvent;
  if (eventName === "voice_done") return { type: "voice_done", data: data as VoiceStreamEvent["data"] } as VoiceStreamEvent;
  if (eventName === "voice_error") return { type: "voice_error", data: data as VoiceStreamEvent["data"] } as VoiceStreamEvent;
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

export async function streamMessageVoice(
  input: {
    userId: string;
    conversationId: string;
    messageId: string;
  },
  onEvent: (event: VoiceStreamEvent) => void
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/v1/voice/messages/${encodeURIComponent(input.messageId)}/play`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: input.userId,
        conversation_id: input.conversationId,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "语音播放失败");
  }
  if (!response.body) throw new Error("当前浏览器不支持语音流");

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
      if (
        event.type === "voice_start" ||
        event.type === "voice_chunk" ||
        event.type === "voice_done" ||
        event.type === "voice_error"
      ) {
        onEvent(event);
        if (event.type === "voice_error") streamError = event.data.error;
      }
    }

    if (done) break;
  }
  if (streamError) throw new Error(streamError);
}

export interface VoiceClientConfig {
  asr: {
    enabled: boolean;
    provider: "browser";
    language: string;
    max_duration_seconds: number;
    auto_silence_ms: number;
  };
  tts: {
    enabled: boolean;
  };
}

export async function fetchVoiceClientConfig(): Promise<VoiceClientConfig> {
  const response = await fetch(`${API_BASE_URL}/v1/voice/config`);
  return parseJsonResponse<VoiceClientConfig>(response, "无法读取语音配置");
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

export async function fetchExternalIdentityResearch(input: {
  token: string;
  relationshipId: string;
}): Promise<ExternalIdentityResearchResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/relationships/${input.relationshipId}/external-identity-research`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<ExternalIdentityResearchResponse>(response, "无法读取外部身份候选");
}

export async function runExternalIdentityResearch(input: {
  token: string;
  relationshipId: string;
  userId: string;
}): Promise<{ jobId: string | null }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/relationships/${input.relationshipId}/external-identity-research`,
    {
      method: "POST",
      headers: { ...adminHeaders(input.token), "Content-Type": "application/json" },
      body: JSON.stringify({ userId: input.userId }),
    }
  );
  return parseJsonResponse<{ jobId: string | null }>(response, "无法创建外部身份检索");
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

export async function updateRelationshipIdentityAliases(input: {
  token: string;
  relationshipId: string;
  aliases: string[];
}): Promise<RelationshipDetailResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/relationships/${input.relationshipId}/person/aliases`,
    {
      method: "PATCH",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ aliases: input.aliases }),
    }
  );
  return parseJsonResponse<RelationshipDetailResponse>(response, "修改自称/别名失败");
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

export async function updateAdminConversation(input: {
  token: string;
  conversationId: string;
  note: string | null;
}): Promise<ConversationUpdateResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/conversations/${input.conversationId}`, {
    method: "PATCH",
    headers: {
      ...adminHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note: input.note }),
  });
  return parseJsonResponse<ConversationUpdateResponse>(response, "保存对话备注失败");
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
  scene?: string;
  status?: string;
  outcome?: string;
  query?: string;
}): Promise<ExpressionLearningResponse> {
  const params = new URLSearchParams();
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

export async function fetchExpressionLearningRules(input: {
  token: string;
  status?: string;
  scope?: string;
  scene?: string;
  query?: string;
}): Promise<ExpressionLearningRulesResponse> {
  const params = new URLSearchParams();
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.scope && input.scope !== "all") params.set("scope", input.scope);
  if (input.scene && input.scene !== "all") params.set("scene", input.scene);
  if (input.query) params.set("q", input.query);
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/rules?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<ExpressionLearningRulesResponse>(response, "无法读取表达规则");
}

export async function proposeExpressionLearningRule(input: {
  token: string;
  exampleId: string;
}): Promise<{ candidate: ExpressionLearningRuleCandidate }> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/rules/propose`, {
    method: "POST",
    headers: { ...adminHeaders(input.token), "Content-Type": "application/json" },
    body: JSON.stringify({ exampleId: input.exampleId }),
  });
  return parseJsonResponse<{ candidate: ExpressionLearningRuleCandidate }>(response, "提炼表达规则失败");
}

export async function createExpressionLearningRule(input: {
  token: string;
  ruleText: string;
  kind: ExpressionLearningRule["kind"];
  scope: ExpressionLearningRule["scope"];
  scene?: string | null;
  strength: ExpressionLearningRule["strength"];
  status: ExpressionLearningRule["status"];
  source?: ExpressionLearningRule["source"];
  exampleIds?: string[];
  coverage?: "partial" | "full";
}): Promise<{ rule: ExpressionLearningRule }> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/rules`, {
    method: "POST",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ rule: ExpressionLearningRule }>(response, "保存表达规则失败");
}

export async function updateExpressionLearningRule(input: {
  token: string;
  ruleId: string;
  ruleText?: string;
  kind?: ExpressionLearningRule["kind"];
  scope?: ExpressionLearningRule["scope"];
  scene?: string | null;
  strength?: ExpressionLearningRule["strength"];
  status?: ExpressionLearningRule["status"];
}): Promise<{ rule: ExpressionLearningRule }> {
  const { token, ruleId, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/rules/${ruleId}`, {
    method: "PATCH",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ rule: ExpressionLearningRule }>(response, "保存表达规则失败");
}

export async function deleteExpressionLearningRule(input: {
  token: string;
  ruleId: string;
}): Promise<{ ok: true; deletedId: string }> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/rules/${input.ruleId}`, {
    method: "DELETE",
    headers: adminHeaders(input.token),
  });
  return parseJsonResponse<{ ok: true; deletedId: string }>(response, "删除表达规则失败");
}

export async function publishExpressionLearningRule(input: {
  token: string;
  ruleId: string;
  force?: boolean;
}): Promise<{ rule: ExpressionLearningRule }> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/rules/${input.ruleId}/publish`, {
    method: "POST",
    headers: { ...adminHeaders(input.token), "Content-Type": "application/json" },
    body: JSON.stringify({ force: input.force === true }),
  });
  return parseJsonResponse<{ rule: ExpressionLearningRule }>(response, "发布表达规则到人设失败");
}

export async function unpublishExpressionLearningRule(input: {
  token: string;
  ruleId: string;
  force?: boolean;
}): Promise<{ rule: ExpressionLearningRule }> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/rules/${input.ruleId}/unpublish`, {
    method: "POST",
    headers: { ...adminHeaders(input.token), "Content-Type": "application/json" },
    body: JSON.stringify({ force: input.force === true }),
  });
  return parseJsonResponse<{ rule: ExpressionLearningRule }>(response, "从人设撤回表达规则失败");
}

export async function fetchExpressionLearningDistillationBatches(input: {
  token: string;
  limit?: number;
}): Promise<ExpressionLearningDistillationBatchesResponse> {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/distillation-batches?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<ExpressionLearningDistillationBatchesResponse>(response, "无法读取经验整理批次");
}

export async function createExpressionLearningDistillationBatch(input: {
  token: string;
  scene?: string | null;
  organization?: "unorganized" | "partial" | "full" | "all";
  createdFrom?: string | null;
  createdTo?: string | null;
  exampleIds?: string[];
  limit?: number;
}): Promise<{ batch: ExpressionLearningDistillationBatch }> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/distillation-batches`, {
    method: "POST",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ batch: ExpressionLearningDistillationBatch }>(response, "批量整理表达经验失败");
}

export async function updateExpressionLearningDistillationCandidate(input: {
  token: string;
  candidateId: string;
  ruleText?: string;
  kind?: ExpressionLearningRule["kind"];
  scope?: ExpressionLearningRule["scope"];
  scene?: string | null;
  strength?: ExpressionLearningRule["strength"];
  coverage?: "partial" | "full";
  reason?: string | null;
  sourceExampleIds?: string[];
}): Promise<{ candidate: ExpressionLearningDistillationCandidate }> {
  const { token, candidateId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/distillation-candidates/${candidateId}`,
    {
      method: "PATCH",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ candidate: ExpressionLearningDistillationCandidate }>(response, "保存候选规则失败");
}

export async function resolveExpressionLearningDistillationCandidate(input: {
  token: string;
  candidateId: string;
  action: "create" | "merge" | "dismiss";
  ruleStatus?: "draft" | "active";
}): Promise<{ candidate: ExpressionLearningDistillationCandidate }> {
  const { token, candidateId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/distillation-candidates/${candidateId}/resolve`,
    {
      method: "POST",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ candidate: ExpressionLearningDistillationCandidate }>(response, "处理候选规则失败");
}

export async function reopenExpressionLearningDistillationCandidate(input: {
  token: string;
  candidateId: string;
}): Promise<{ candidate: ExpressionLearningDistillationCandidate }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/distillation-candidates/${input.candidateId}/reopen`,
    { method: "POST", headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<{ candidate: ExpressionLearningDistillationCandidate }>(response, "取消忽略候选规则失败");
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

export async function analyzeExpressionLearningExample(
  input: ExpressionLearningCreateInput
): Promise<{ analysis: ExpressionLearningAnalysis }> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/analyze`, {
    method: "POST",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ analysis: ExpressionLearningAnalysis }>(response, "分析表达经验失败");
}

export async function deleteExpressionLearningExample(input: {
  token: string;
  exampleId: string;
}): Promise<{ ok: true; deletedId: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/examples/${input.exampleId}`,
    { method: "DELETE", headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<{ ok: true; deletedId: string }>(response, "删除表达经验失败");
}

export async function generateExpressionLearningPracticeQuestion(input: {
  token: string;
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

export async function runExpressionLearningPracticeBatchNow(input: {
  token: string;
}): Promise<{
  items: ExpressionLearningPracticeQuestionResponse[];
  count: number;
  config: { count: number; scene: string; focus: string | null };
}> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/practice-questions/run-auto-batch`,
    {
      method: "POST",
      headers: adminHeaders(input.token),
    }
  );
  return parseJsonResponse<{
    items: ExpressionLearningPracticeQuestionResponse[];
    count: number;
    config: { count: number; scene: string; focus: string | null };
  }>(response, "立即批量出题失败");
}

export async function generateExpressionLearningDraft(input: {
  token: string;
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

export async function fetchExpressionLearningDialogueCases(input: {
  token: string;
  scene?: string;
  status?: string;
  limit?: number;
}): Promise<ExpressionLearningDialogueCasesResponse> {
  const params = new URLSearchParams();
  if (input.scene && input.scene !== "all") params.set("scene", input.scene);
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.limit) params.set("limit", String(input.limit));
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-cases?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<ExpressionLearningDialogueCasesResponse>(
    response,
    "无法读取多轮练习"
  );
}

export async function createExpressionLearningDialogueCase(
  input: ExpressionLearningDialogueCaseInput
): Promise<{ dialogueCase: ExpressionLearningDialogueCase }> {
  const { token, ...body } = input;
  const response = await fetch(`${API_BASE_URL}/v1/admin/expression-learning/dialogue-cases`, {
    method: "POST",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<{ dialogueCase: ExpressionLearningDialogueCase }>(
    response,
    "创建多轮练习失败"
  );
}

export async function updateExpressionLearningDialogueCase(input: {
  token: string;
  caseId: string;
  scene?: string;
  title?: string | null;
  trainingFocus?: string | null;
  rootContextText?: string;
  status?: "draft" | "active" | "archived";
}): Promise<{ dialogueCase: ExpressionLearningDialogueCase }> {
  const { token, caseId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-cases/${caseId}`,
    {
      method: "PATCH",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ dialogueCase: ExpressionLearningDialogueCase }>(
    response,
    "保存多轮练习失败"
  );
}

export async function deleteExpressionLearningDialogueCase(input: {
  token: string;
  caseId: string;
}): Promise<{ deletedId: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-cases/${input.caseId}`,
    { method: "DELETE", headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<{ deletedId: string }>(response, "删除多轮练习失败");
}

export async function createExpressionLearningDialogueTurn(
  input: ExpressionLearningDialogueTurnInput
): Promise<{ dialogueCase: ExpressionLearningDialogueCase }> {
  const { token, caseId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-cases/${caseId}/turns`,
    {
      method: "POST",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ dialogueCase: ExpressionLearningDialogueCase }>(
    response,
    "添加对话分支失败"
  );
}

export async function updateExpressionLearningDialogueTurn(
  input: ExpressionLearningDialogueTurnPatch
): Promise<{ dialogueCase: ExpressionLearningDialogueCase }> {
  const { token, turnId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-turns/${turnId}`,
    {
      method: "PATCH",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ dialogueCase: ExpressionLearningDialogueCase }>(
    response,
    "保存对话节点失败"
  );
}

export async function deleteExpressionLearningDialogueTurn(input: {
  token: string;
  turnId: string;
}): Promise<{ dialogueCase: ExpressionLearningDialogueCase }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-turns/${input.turnId}`,
    { method: "DELETE", headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<{ dialogueCase: ExpressionLearningDialogueCase }>(
    response,
    "删除对话节点失败"
  );
}

export async function generateExpressionLearningDialogueTurnDraft(input: {
  token: string;
  turnId: string;
}): Promise<ExpressionLearningDraftResponse & { dialogueCase: ExpressionLearningDialogueCase }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-turns/${input.turnId}/draft`,
    { method: "POST", headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<ExpressionLearningDraftResponse & { dialogueCase: ExpressionLearningDialogueCase }>(
    response,
    "生成多轮试答失败"
  );
}

export async function analyzeExpressionLearningDialogueTurn(
  input: ExpressionLearningDialogueTurnDecisionInput
): Promise<{ analysis: ExpressionLearningAnalysis; dialogueCase: ExpressionLearningDialogueCase }> {
  const { token, turnId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-turns/${turnId}/analyze`,
    {
      method: "POST",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ analysis: ExpressionLearningAnalysis; dialogueCase: ExpressionLearningDialogueCase }>(
    response,
    "分析多轮节点失败"
  );
}

export async function saveExpressionLearningDialogueTurnExample(
  input: ExpressionLearningDialogueTurnDecisionInput
): Promise<{ example: ExpressionLearningExample; dialogueCase: ExpressionLearningDialogueCase }> {
  const { token, turnId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/dialogue-turns/${turnId}/save-example`,
    {
      method: "POST",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ example: ExpressionLearningExample; dialogueCase: ExpressionLearningDialogueCase }>(
    response,
    "保存多轮经验失败"
  );
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
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
}): Promise<ExpressionLearningTrainingRecordsResponse> {
  const params = new URLSearchParams();
  if (input.sourceType && input.sourceType !== "all") params.set("sourceType", input.sourceType);
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.createdFrom) params.set("createdFrom", input.createdFrom);
  if (input.createdTo) params.set("createdTo", input.createdTo);
  if (input.limit) params.set("limit", String(input.limit));
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/training-records?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<ExpressionLearningTrainingRecordsResponse>(
    response,
    "无法读取表达习题册"
  );
}

export async function saveExpressionLearningTrainingDraft(
  input: ExpressionLearningTrainingDraftInput
): Promise<{ record: ExpressionLearningTrainingRecord }> {
  const { token, recordId, ...body } = input;
  const response = await fetch(
    recordId
      ? `${API_BASE_URL}/v1/admin/expression-learning/training-records/${recordId}`
      : `${API_BASE_URL}/v1/admin/expression-learning/training-records`,
    {
      method: recordId ? "PATCH" : "POST",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ record: ExpressionLearningTrainingRecord }>(
    response,
    "保存习题草稿失败"
  );
}

export async function updateExpressionLearningTrainingRecord(input: {
  token: string;
  recordId: string;
  sourceType?: string;
  scene?: string;
  status?: string;
  contextText?: string | null;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: "sent" | "skipped" | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
  reasonText?: string | null;
  generatedQuestion?: unknown;
  generatedDraft?: unknown;
  analysisSnapshot?: unknown;
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

export async function deleteExpressionLearningTrainingRecord(input: {
  token: string;
  recordId: string;
}): Promise<{ ok: true; deletedId: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/expression-learning/training-records/${input.recordId}`,
    { method: "DELETE", headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<{ ok: true; deletedId: string }>(response, "删除习题失败");
}

export async function updateExpressionLearningExample(input: {
  token: string;
  exampleId: string;
  lesson?: string;
  reasoning?: string | null;
  strategy?: string | null;
  tone?: string | null;
  ownerNote?: string | null;
  status?: "active" | "disabled";
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

export async function publishXiaohongshuReply(input: {
  token: string;
  commentId: string;
  draftId: string;
  content: string;
}): Promise<{ posts: XiaohongshuPost[]; attempt: { id: string; status: string } }> {
  const { token, commentId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/xiaohongshu/comments/${commentId}/publish`,
    {
      method: "POST",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, confirmed: true }),
    }
  );
  return parseJsonResponse(response, "发布到小红书失败");
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
}): Promise<{ posts: XiaohongshuPost[] }> {
  const { token, commentId, ...body } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/xiaohongshu/comments/${commentId}/final-decision`,
    {
      method: "POST",
      headers: { ...adminHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return parseJsonResponse<{ posts: XiaohongshuPost[] }>(
    response,
    "记录最终回复并学习失败"
  );
}

export async function analyzeXiaohongshuCommentDecision(input: {
  token: string;
  commentId: string;
}): Promise<{ posts: XiaohongshuPost[]; learningExample: ExpressionLearningExample }> {
  const { token, commentId } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/xiaohongshu/comments/${commentId}/analyze`,
    { method: "POST", headers: adminHeaders(token) }
  );
  return parseJsonResponse(response, "分析这次回复失败");
}

export async function enableXiaohongshuCommentLearning(input: {
  token: string;
  commentId: string;
}): Promise<{ posts: XiaohongshuPost[]; learningExample: ExpressionLearningExample }> {
  const { token, commentId } = input;
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/xiaohongshu/comments/${commentId}/enable-learning`,
    { method: "POST", headers: adminHeaders(token) }
  );
  return parseJsonResponse(response, "启用表达经验失败");
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
  personId?: string;
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
  if (input.personId) params.set("person_id", input.personId);
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
  personId?: string;
  status?: string;
  scope?: string;
  type?: string;
  query?: string;
  dateField?: string;
  metric?: string;
}): Promise<AdminMemoryActivity> {
  const params = new URLSearchParams();
  if (input.personId) params.set("person_id", input.personId);
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

export async function fetchAdminMemoryEvidence(input: {
  token: string;
  memoryId: string;
}): Promise<AdminMemoryEvidence> {
  const response = await fetch(
    `${API_BASE_URL}/v1/admin/memories/${encodeURIComponent(input.memoryId)}/evidence`,
    { headers: adminHeaders(input.token) }
  );
  return parseJsonResponse<AdminMemoryEvidence>(
    response,
    "无法读取记忆证据"
  );
}

function adminMemoryBody(input: AdminMemoryWriteInput) {
  return {
    person_id: input.personId,
    type: input.type,
    scope: input.scope,
    tier: input.tier,
    content: input.content,
    summary: input.summary,
    status: input.status,
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
