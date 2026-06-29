-- Enable pgvector for memory embeddings.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "app_users" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalConversationId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "isIntermediate" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_events" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalEventId" TEXT,
    "externalUserId" TEXT,
    "externalMessageId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'user',
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT,
    "tags" JSONB,
    "entities" JSONB,
    "channel" TEXT,
    "conversationId" TEXT,
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_call_logs" (
    "id" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "channel" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_states" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'global',
    "moodLabel" TEXT NOT NULL DEFAULT '平稳在线',
    "energyLevel" INTEGER NOT NULL DEFAULT 62,
    "currentGoal" TEXT,
    "currentFocus" TEXT,
    "currentActivity" TEXT,
    "recentEventSummary" TEXT,
    "statusNote" TEXT,
    "updateMode" TEXT NOT NULL DEFAULT 'balanced',
    "updateStrategy" TEXT NOT NULL DEFAULT 'rules',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runtime_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_state_events" (
    "id" TEXT NOT NULL,
    "runtimeStateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT,
    "summary" TEXT NOT NULL,
    "patch" JSONB,
    "before" JSONB,
    "after" JSONB,
    "userId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_state_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 30,
    "topic" TEXT,
    "moodSignal" TEXT,
    "energySignal" TEXT,
    "stateImpact" JSONB,
    "payload" JSONB,
    "userId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "channel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'observed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_identities" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_links" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto_singleton',
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_link_proposals" (
    "id" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "targetPersonId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'rules',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_link_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_states" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "relationshipLabel" TEXT NOT NULL DEFAULT '刚认识',
    "affinity" INTEGER NOT NULL DEFAULT 10,
    "interactionStyle" TEXT,
    "summary" TEXT,
    "recentSignal" TEXT,
    "statusNote" TEXT,
    "metadata" JSONB,
    "lastInteractionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_state_events" (
    "id" TEXT NOT NULL,
    "relationshipStateId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "source" TEXT,
    "summary" TEXT NOT NULL,
    "patch" JSONB,
    "before" JSONB,
    "after" JSONB,
    "conversationId" TEXT,
    "messageId" TEXT,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_state_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_affinity_proposals" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "relationshipStateId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "channel" TEXT,
    "source" TEXT NOT NULL DEFAULT 'dream',
    "status" TEXT NOT NULL DEFAULT 'applied',
    "beforeAffinity" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "afterAffinity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3),
    "rawOutput" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_affinity_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_affinity_evidence" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "relationshipStateId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "channel" TEXT,
    "source" TEXT NOT NULL DEFAULT 'dream',
    "evidenceKey" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "polarity" TEXT NOT NULL,
    "baseDelta" INTEGER NOT NULL DEFAULT 0,
    "adjustedDelta" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "content" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceMessageIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_affinity_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_embeddings" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_change_proposals" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "channel" TEXT,
    "proposalType" TEXT NOT NULL,
    "targetMemoryId" TEXT,
    "scope" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "tags" JSONB,
    "entities" JSONB,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedMemoryId" TEXT,
    "sourceMessageIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_change_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_risk_flags" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "relatedMessageIds" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_log_proposals" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceMessageIds" JSONB,
    "appliedMemoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_log_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_jobs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "triggerType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "channel" TEXT,
    "fromTime" TIMESTAMP(3),
    "toTime" TIMESTAMP(3),
    "phase" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "dream_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_daily_notes" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT,
    "title" TEXT,
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB,
    "sourceStats" JSONB,
    "riskSummary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dream_daily_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_signals" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "signalType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "sourceTypes" JSONB,
    "sourceIds" JSONB,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB,
    "entities" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dream_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_diary_entries" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'lusiyuan_inner_diary',
    "grounded" BOOLEAN NOT NULL DEFAULT true,
    "sourceSignalIds" JSONB,
    "sourceMessageIds" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'owner_only',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dream_diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_consolidation_reports" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "summary" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "promotedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "riskCount" INTEGER NOT NULL DEFAULT 0,
    "generatedProposalIds" JSONB,
    "rawOutput" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_consolidation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_locks" (
    "id" TEXT NOT NULL,
    "lockKey" TEXT NOT NULL,
    "owner" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_page_snapshots" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "screenshotPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_page_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_users_externalId_key" ON "app_users"("externalId");

-- CreateIndex
CREATE INDEX "chat_conversations_userId_idx" ON "chat_conversations"("userId");

-- CreateIndex
CREATE INDEX "chat_conversations_channel_idx" ON "chat_conversations"("channel");

-- CreateIndex
CREATE INDEX "chat_conversations_externalConversationId_idx" ON "chat_conversations"("externalConversationId");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_externalMessageId_idx" ON "chat_messages"("externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_conversationId_externalMessageId_key" ON "chat_messages"("conversationId", "externalMessageId");

-- CreateIndex
CREATE INDEX "channel_events_channel_idx" ON "channel_events"("channel");

-- CreateIndex
CREATE INDEX "channel_events_externalEventId_idx" ON "channel_events"("externalEventId");

-- CreateIndex
CREATE INDEX "channel_events_externalMessageId_idx" ON "channel_events"("externalMessageId");

-- CreateIndex
CREATE INDEX "memories_userId_idx" ON "memories"("userId");

-- CreateIndex
CREATE INDEX "memories_type_idx" ON "memories"("type");

-- CreateIndex
CREATE INDEX "memories_importance_idx" ON "memories"("importance");

-- CreateIndex
CREATE INDEX "memories_status_scope_type_idx" ON "memories"("status", "scope", "type");

-- CreateIndex
CREATE INDEX "memories_userId_status_idx" ON "memories"("userId", "status");

-- CreateIndex
CREATE INDEX "tool_call_logs_toolName_idx" ON "tool_call_logs"("toolName");

-- CreateIndex
CREATE INDEX "tool_call_logs_userId_idx" ON "tool_call_logs"("userId");

-- CreateIndex
CREATE INDEX "tool_call_logs_conversationId_idx" ON "tool_call_logs"("conversationId");

-- CreateIndex
CREATE INDEX "tool_call_logs_status_idx" ON "tool_call_logs"("status");

-- CreateIndex
CREATE INDEX "tool_call_logs_createdAt_idx" ON "tool_call_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_states_key_key" ON "runtime_states"("key");

-- CreateIndex
CREATE INDEX "runtime_state_events_runtimeStateId_idx" ON "runtime_state_events"("runtimeStateId");

-- CreateIndex
CREATE INDEX "runtime_state_events_eventType_idx" ON "runtime_state_events"("eventType");

-- CreateIndex
CREATE INDEX "runtime_state_events_source_idx" ON "runtime_state_events"("source");

-- CreateIndex
CREATE INDEX "runtime_state_events_createdAt_idx" ON "runtime_state_events"("createdAt");

-- CreateIndex
CREATE INDEX "runtime_events_eventType_idx" ON "runtime_events"("eventType");

-- CreateIndex
CREATE INDEX "runtime_events_source_idx" ON "runtime_events"("source");

-- CreateIndex
CREATE INDEX "runtime_events_status_idx" ON "runtime_events"("status");

-- CreateIndex
CREATE INDEX "runtime_events_userId_idx" ON "runtime_events"("userId");

-- CreateIndex
CREATE INDEX "runtime_events_conversationId_idx" ON "runtime_events"("conversationId");

-- CreateIndex
CREATE INDEX "runtime_events_createdAt_idx" ON "runtime_events"("createdAt");

-- CreateIndex
CREATE INDEX "person_identities_label_idx" ON "person_identities"("label");

-- CreateIndex
CREATE UNIQUE INDEX "identity_links_userId_key" ON "identity_links"("userId");

-- CreateIndex
CREATE INDEX "identity_links_personId_idx" ON "identity_links"("personId");

-- CreateIndex
CREATE INDEX "identity_links_source_idx" ON "identity_links"("source");

-- CreateIndex
CREATE INDEX "identity_link_proposals_sourceUserId_idx" ON "identity_link_proposals"("sourceUserId");

-- CreateIndex
CREATE INDEX "identity_link_proposals_targetPersonId_idx" ON "identity_link_proposals"("targetPersonId");

-- CreateIndex
CREATE INDEX "identity_link_proposals_targetUserId_idx" ON "identity_link_proposals"("targetUserId");

-- CreateIndex
CREATE INDEX "identity_link_proposals_status_idx" ON "identity_link_proposals"("status");

-- CreateIndex
CREATE INDEX "identity_link_proposals_confidence_idx" ON "identity_link_proposals"("confidence");

-- CreateIndex
CREATE INDEX "identity_link_proposals_createdAt_idx" ON "identity_link_proposals"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_states_personId_key" ON "relationship_states"("personId");

-- CreateIndex
CREATE INDEX "relationship_states_personId_idx" ON "relationship_states"("personId");

-- CreateIndex
CREATE INDEX "relationship_states_updatedAt_idx" ON "relationship_states"("updatedAt");

-- CreateIndex
CREATE INDEX "relationship_state_events_relationshipStateId_idx" ON "relationship_state_events"("relationshipStateId");

-- CreateIndex
CREATE INDEX "relationship_state_events_personId_idx" ON "relationship_state_events"("personId");

-- CreateIndex
CREATE INDEX "relationship_state_events_userId_idx" ON "relationship_state_events"("userId");

-- CreateIndex
CREATE INDEX "relationship_state_events_eventType_idx" ON "relationship_state_events"("eventType");

-- CreateIndex
CREATE INDEX "relationship_state_events_source_idx" ON "relationship_state_events"("source");

-- CreateIndex
CREATE INDEX "relationship_state_events_createdAt_idx" ON "relationship_state_events"("createdAt");

-- CreateIndex
CREATE INDEX "relationship_affinity_proposals_reportId_idx" ON "relationship_affinity_proposals"("reportId");

-- CreateIndex
CREATE INDEX "relationship_affinity_proposals_relationshipStateId_idx" ON "relationship_affinity_proposals"("relationshipStateId");

-- CreateIndex
CREATE INDEX "relationship_affinity_proposals_personId_idx" ON "relationship_affinity_proposals"("personId");

-- CreateIndex
CREATE INDEX "relationship_affinity_proposals_userId_idx" ON "relationship_affinity_proposals"("userId");

-- CreateIndex
CREATE INDEX "relationship_affinity_proposals_conversationId_idx" ON "relationship_affinity_proposals"("conversationId");

-- CreateIndex
CREATE INDEX "relationship_affinity_proposals_status_idx" ON "relationship_affinity_proposals"("status");

-- CreateIndex
CREATE INDEX "relationship_affinity_proposals_source_idx" ON "relationship_affinity_proposals"("source");

-- CreateIndex
CREATE INDEX "relationship_affinity_proposals_createdAt_idx" ON "relationship_affinity_proposals"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_affinity_evidence_relationshipStateId_evidenceKey_key" ON "relationship_affinity_evidence"("relationshipStateId", "evidenceKey");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_proposalId_idx" ON "relationship_affinity_evidence"("proposalId");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_relationshipStateId_idx" ON "relationship_affinity_evidence"("relationshipStateId");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_personId_idx" ON "relationship_affinity_evidence"("personId");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_userId_idx" ON "relationship_affinity_evidence"("userId");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_conversationId_idx" ON "relationship_affinity_evidence"("conversationId");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_messageId_idx" ON "relationship_affinity_evidence"("messageId");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_evidenceType_idx" ON "relationship_affinity_evidence"("evidenceType");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_polarity_idx" ON "relationship_affinity_evidence"("polarity");

-- CreateIndex
CREATE INDEX "relationship_affinity_evidence_createdAt_idx" ON "relationship_affinity_evidence"("createdAt");

-- CreateIndex
CREATE INDEX "memory_embeddings_memoryId_idx" ON "memory_embeddings"("memoryId");

-- CreateIndex
CREATE UNIQUE INDEX "memory_embeddings_memoryId_provider_model_dimensions_key" ON "memory_embeddings"("memoryId", "provider", "model", "dimensions");

CREATE INDEX "memory_change_proposals_reportId_idx" ON "memory_change_proposals"("reportId");

-- CreateIndex
CREATE INDEX "memory_change_proposals_userId_idx" ON "memory_change_proposals"("userId");

-- CreateIndex
CREATE INDEX "memory_change_proposals_conversationId_idx" ON "memory_change_proposals"("conversationId");

-- CreateIndex
CREATE INDEX "memory_change_proposals_channel_idx" ON "memory_change_proposals"("channel");

-- CreateIndex
CREATE INDEX "memory_change_proposals_status_idx" ON "memory_change_proposals"("status");

-- CreateIndex
CREATE INDEX "memory_change_proposals_proposalType_idx" ON "memory_change_proposals"("proposalType");

-- CreateIndex
CREATE INDEX "memory_change_proposals_riskLevel_idx" ON "memory_change_proposals"("riskLevel");

-- CreateIndex
CREATE INDEX "memory_change_proposals_confidence_idx" ON "memory_change_proposals"("confidence");

-- CreateIndex
CREATE INDEX "memory_risk_flags_reportId_idx" ON "memory_risk_flags"("reportId");

-- CreateIndex
CREATE INDEX "memory_risk_flags_type_idx" ON "memory_risk_flags"("type");

-- CreateIndex
CREATE INDEX "memory_risk_flags_severity_idx" ON "memory_risk_flags"("severity");

-- CreateIndex
CREATE INDEX "memory_risk_flags_status_idx" ON "memory_risk_flags"("status");

-- CreateIndex
CREATE INDEX "growth_log_proposals_reportId_idx" ON "growth_log_proposals"("reportId");

-- CreateIndex
CREATE INDEX "growth_log_proposals_status_idx" ON "growth_log_proposals"("status");

-- CreateIndex
CREATE INDEX "growth_log_proposals_createdAt_idx" ON "growth_log_proposals"("createdAt");

-- CreateIndex
CREATE INDEX "dream_jobs_status_idx" ON "dream_jobs"("status");

-- CreateIndex
CREATE INDEX "dream_jobs_triggerType_idx" ON "dream_jobs"("triggerType");

-- CreateIndex
CREATE INDEX "dream_jobs_scope_idx" ON "dream_jobs"("scope");

-- CreateIndex
CREATE INDEX "dream_jobs_createdAt_idx" ON "dream_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "dream_daily_notes_date_idx" ON "dream_daily_notes"("date");

-- CreateIndex
CREATE INDEX "dream_daily_notes_scope_idx" ON "dream_daily_notes"("scope");

-- CreateIndex
CREATE INDEX "dream_daily_notes_userId_idx" ON "dream_daily_notes"("userId");

-- CreateIndex
CREATE INDEX "dream_daily_notes_status_idx" ON "dream_daily_notes"("status");

-- CreateIndex
CREATE INDEX "dream_signals_signalType_idx" ON "dream_signals"("signalType");

-- CreateIndex
CREATE INDEX "dream_signals_confidence_idx" ON "dream_signals"("confidence");

-- CreateIndex
CREATE INDEX "dream_signals_strength_idx" ON "dream_signals"("strength");

-- CreateIndex
CREATE INDEX "dream_signals_riskLevel_idx" ON "dream_signals"("riskLevel");

-- CreateIndex
CREATE INDEX "dream_signals_status_idx" ON "dream_signals"("status");

-- CreateIndex
CREATE INDEX "dream_diary_entries_date_idx" ON "dream_diary_entries"("date");

-- CreateIndex
CREATE INDEX "dream_diary_entries_visibility_idx" ON "dream_diary_entries"("visibility");

-- CreateIndex
CREATE INDEX "dream_diary_entries_status_idx" ON "dream_diary_entries"("status");

-- CreateIndex
CREATE INDEX "dream_consolidation_reports_phase_idx" ON "dream_consolidation_reports"("phase");

-- CreateIndex
CREATE INDEX "dream_consolidation_reports_createdAt_idx" ON "dream_consolidation_reports"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "dream_locks_lockKey_key" ON "dream_locks"("lockKey");

-- CreateIndex
CREATE INDEX "dream_locks_expiresAt_idx" ON "dream_locks"("expiresAt");

-- CreateIndex
CREATE INDEX "external_page_snapshots_url_idx" ON "external_page_snapshots"("url");

-- CreateIndex
CREATE INDEX "external_page_snapshots_tool_idx" ON "external_page_snapshots"("tool");

-- CreateIndex
CREATE INDEX "external_page_snapshots_createdAt_idx" ON "external_page_snapshots"("createdAt");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_state_events" ADD CONSTRAINT "runtime_state_events_runtimeStateId_fkey" FOREIGN KEY ("runtimeStateId") REFERENCES "runtime_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_links" ADD CONSTRAINT "identity_links_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_links" ADD CONSTRAINT "identity_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link_proposals" ADD CONSTRAINT "identity_link_proposals_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link_proposals" ADD CONSTRAINT "identity_link_proposals_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link_proposals" ADD CONSTRAINT "identity_link_proposals_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_states" ADD CONSTRAINT "relationship_states_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_state_events" ADD CONSTRAINT "relationship_state_events_relationshipStateId_fkey" FOREIGN KEY ("relationshipStateId") REFERENCES "relationship_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_state_events" ADD CONSTRAINT "relationship_state_events_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_state_events" ADD CONSTRAINT "relationship_state_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_affinity_proposals" ADD CONSTRAINT "relationship_affinity_proposals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dream_consolidation_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_affinity_proposals" ADD CONSTRAINT "relationship_affinity_proposals_relationshipStateId_fkey" FOREIGN KEY ("relationshipStateId") REFERENCES "relationship_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_affinity_proposals" ADD CONSTRAINT "relationship_affinity_proposals_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_affinity_evidence" ADD CONSTRAINT "relationship_affinity_evidence_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "relationship_affinity_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_affinity_evidence" ADD CONSTRAINT "relationship_affinity_evidence_relationshipStateId_fkey" FOREIGN KEY ("relationshipStateId") REFERENCES "relationship_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_affinity_evidence" ADD CONSTRAINT "relationship_affinity_evidence_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_change_proposals" ADD CONSTRAINT "memory_change_proposals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dream_consolidation_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_risk_flags" ADD CONSTRAINT "memory_risk_flags_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dream_consolidation_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_log_proposals" ADD CONSTRAINT "growth_log_proposals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dream_consolidation_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_daily_notes" ADD CONSTRAINT "dream_daily_notes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "dream_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_signals" ADD CONSTRAINT "dream_signals_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "dream_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_diary_entries" ADD CONSTRAINT "dream_diary_entries_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "dream_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_consolidation_reports" ADD CONSTRAINT "dream_consolidation_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "dream_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
