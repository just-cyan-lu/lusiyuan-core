-- Enable pgvector for memory embeddings.
CREATE EXTENSION IF NOT EXISTS vector;

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
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "channel" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "metadata" JSONB,
    "createdByTool" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "reflection_jobs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "triggerType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "channel" TEXT,
    "messageFrom" TIMESTAMP(3),
    "messageTo" TIMESTAMP(3),
    "messageLimit" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "reflection_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflection_reports" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "rawOutput" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reflection_reports_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "reflection_risk_flags" (
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

    CONSTRAINT "reflection_risk_flags_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "external_inbox_items" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT,
    "postTitle" TEXT,
    "postUrl" TEXT,
    "summary" TEXT,
    "draftId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_inbox_items_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "drafts_userId_idx" ON "drafts"("userId");

-- CreateIndex
CREATE INDEX "drafts_conversationId_idx" ON "drafts"("conversationId");

-- CreateIndex
CREATE INDEX "drafts_type_idx" ON "drafts"("type");

-- CreateIndex
CREATE INDEX "drafts_status_idx" ON "drafts"("status");

-- CreateIndex
CREATE INDEX "drafts_createdAt_idx" ON "drafts"("createdAt");

-- CreateIndex
CREATE INDEX "memory_embeddings_memoryId_idx" ON "memory_embeddings"("memoryId");

-- CreateIndex
CREATE UNIQUE INDEX "memory_embeddings_memoryId_provider_model_dimensions_key" ON "memory_embeddings"("memoryId", "provider", "model", "dimensions");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "memory_embeddings_hnsw_idx"
  ON "memory_embeddings"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "provider" = 'siliconflow'
    AND "model" = 'Qwen/Qwen3-Embedding-4B'
    AND "dimensions" = 1024;

-- CreateIndex
CREATE INDEX "reflection_jobs_status_idx" ON "reflection_jobs"("status");

-- CreateIndex
CREATE INDEX "reflection_jobs_triggerType_idx" ON "reflection_jobs"("triggerType");

-- CreateIndex
CREATE INDEX "reflection_jobs_conversationId_idx" ON "reflection_jobs"("conversationId");

-- CreateIndex
CREATE INDEX "reflection_jobs_createdAt_idx" ON "reflection_jobs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reflection_reports_jobId_key" ON "reflection_reports"("jobId");

-- CreateIndex
CREATE INDEX "reflection_reports_createdAt_idx" ON "reflection_reports"("createdAt");

-- CreateIndex
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
CREATE INDEX "reflection_risk_flags_reportId_idx" ON "reflection_risk_flags"("reportId");

-- CreateIndex
CREATE INDEX "reflection_risk_flags_type_idx" ON "reflection_risk_flags"("type");

-- CreateIndex
CREATE INDEX "reflection_risk_flags_severity_idx" ON "reflection_risk_flags"("severity");

-- CreateIndex
CREATE INDEX "reflection_risk_flags_status_idx" ON "reflection_risk_flags"("status");

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

-- CreateIndex
CREATE INDEX "external_inbox_items_platform_idx" ON "external_inbox_items"("platform");

-- CreateIndex
CREATE INDEX "external_inbox_items_type_idx" ON "external_inbox_items"("type");

-- CreateIndex
CREATE INDEX "external_inbox_items_syncedAt_idx" ON "external_inbox_items"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "external_inbox_items_platform_sourceId_key" ON "external_inbox_items"("platform", "sourceId");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflection_reports" ADD CONSTRAINT "reflection_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "reflection_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_change_proposals" ADD CONSTRAINT "memory_change_proposals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reflection_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflection_risk_flags" ADD CONSTRAINT "reflection_risk_flags_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reflection_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_log_proposals" ADD CONSTRAINT "growth_log_proposals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reflection_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_daily_notes" ADD CONSTRAINT "dream_daily_notes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "dream_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_signals" ADD CONSTRAINT "dream_signals_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "dream_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_diary_entries" ADD CONSTRAINT "dream_diary_entries_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "dream_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_consolidation_reports" ADD CONSTRAINT "dream_consolidation_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "dream_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
