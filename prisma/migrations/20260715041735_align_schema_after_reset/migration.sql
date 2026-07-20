/*
  Warnings:

  - You are about to drop the column `generatedProposalIds` on the `dream_consolidation_reports` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `confidence` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `conversationId` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `entities` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `importance` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `currentActivity` on the `runtime_states` table. All the data in the column will be lost.
  - You are about to drop the column `currentFocus` on the `runtime_states` table. All the data in the column will be lost.
  - You are about to drop the column `currentGoal` on the `runtime_states` table. All the data in the column will be lost.
  - You are about to drop the column `updateMode` on the `runtime_states` table. All the data in the column will be lost.
  - You are about to drop the column `updateStrategy` on the `runtime_states` table. All the data in the column will be lost.
  - You are about to drop the `memory_change_proposals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `relationship_affinity_evidence` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `relationship_affinity_proposals` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "memories" DROP CONSTRAINT "memories_userId_fkey";

-- DropForeignKey
ALTER TABLE "memory_change_proposals" DROP CONSTRAINT "memory_change_proposals_reportId_fkey";

-- DropForeignKey
ALTER TABLE "relationship_affinity_evidence" DROP CONSTRAINT "relationship_affinity_evidence_personId_fkey";

-- DropForeignKey
ALTER TABLE "relationship_affinity_evidence" DROP CONSTRAINT "relationship_affinity_evidence_proposalId_fkey";

-- DropForeignKey
ALTER TABLE "relationship_affinity_evidence" DROP CONSTRAINT "relationship_affinity_evidence_relationshipStateId_fkey";

-- DropForeignKey
ALTER TABLE "relationship_affinity_proposals" DROP CONSTRAINT "relationship_affinity_proposals_personId_fkey";

-- DropForeignKey
ALTER TABLE "relationship_affinity_proposals" DROP CONSTRAINT "relationship_affinity_proposals_relationshipStateId_fkey";

-- DropForeignKey
ALTER TABLE "relationship_affinity_proposals" DROP CONSTRAINT "relationship_affinity_proposals_reportId_fkey";

-- DropIndex
DROP INDEX "memories_importance_idx";

-- DropIndex
DROP INDEX "memories_userId_idx";

-- DropIndex
DROP INDEX "memories_userId_status_idx";

-- AlterTable
ALTER TABLE "dream_consolidation_reports" DROP COLUMN "generatedProposalIds";

-- AlterTable
ALTER TABLE "memories" DROP COLUMN "channel",
DROP COLUMN "confidence",
DROP COLUMN "conversationId",
DROP COLUMN "entities",
DROP COLUMN "importance",
DROP COLUMN "metadata",
DROP COLUMN "source",
DROP COLUMN "tags",
DROP COLUMN "userId",
ADD COLUMN     "lastMentionedAt" TIMESTAMP(3),
ADD COLUMN     "mentionDayKeys" JSONB,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "sourceMessageIds" JSONB,
ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'temp',
ADD COLUMN     "tierEnteredAt" TIMESTAMP(3),
ADD COLUMN     "tierMentionCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "scope" SET DEFAULT 'person';

-- AlterTable
ALTER TABLE "relationship_states" ADD COLUMN     "userIntroduction" TEXT;

-- AlterTable
ALTER TABLE "runtime_states" DROP COLUMN "currentActivity",
DROP COLUMN "currentFocus",
DROP COLUMN "currentGoal",
DROP COLUMN "updateMode",
DROP COLUMN "updateStrategy";

-- DropTable
DROP TABLE "memory_change_proposals";

-- DropTable
DROP TABLE "relationship_affinity_evidence";

-- DropTable
DROP TABLE "relationship_affinity_proposals";

-- CreateTable
CREATE TABLE "conversation_context_summaries" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromMessageId" TEXT NOT NULL,
    "toMessageId" TEXT NOT NULL,
    "fromCreatedAt" TIMESTAMP(3) NOT NULL,
    "toCreatedAt" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'auto_compact',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_context_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autonomous_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "currentStep" TEXT,
    "nextStep" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'admin',
    "lastRunAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autonomous_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autonomous_task_runs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "summary" TEXT,
    "plan" JSONB,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "autonomous_task_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autonomous_artifacts" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "runId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autonomous_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_review_proposals" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "relationshipStateId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "channel" TEXT,
    "source" TEXT NOT NULL DEFAULT 'dream',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "beforeSnapshot" JSONB,
    "proposedPatch" JSONB,
    "afterSnapshot" JSONB,
    "appliedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rawOutput" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_review_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_review_evidence" (
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
    "polarity" TEXT NOT NULL DEFAULT 'neutral',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "content" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "affectsFields" JSONB,
    "sourceMessageIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_review_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_embeddings" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_context_summaries_conversationId_status_toCrea_idx" ON "conversation_context_summaries"("conversationId", "status", "toCreatedAt");

-- CreateIndex
CREATE INDEX "conversation_context_summaries_toCreatedAt_idx" ON "conversation_context_summaries"("toCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_context_summaries_conversationId_toMessageId_key" ON "conversation_context_summaries"("conversationId", "toMessageId");

-- CreateIndex
CREATE INDEX "autonomous_tasks_status_idx" ON "autonomous_tasks"("status");

-- CreateIndex
CREATE INDEX "autonomous_tasks_type_idx" ON "autonomous_tasks"("type");

-- CreateIndex
CREATE INDEX "autonomous_tasks_priority_idx" ON "autonomous_tasks"("priority");

-- CreateIndex
CREATE INDEX "autonomous_tasks_lastRunAt_idx" ON "autonomous_tasks"("lastRunAt");

-- CreateIndex
CREATE INDEX "autonomous_task_runs_taskId_idx" ON "autonomous_task_runs"("taskId");

-- CreateIndex
CREATE INDEX "autonomous_task_runs_status_idx" ON "autonomous_task_runs"("status");

-- CreateIndex
CREATE INDEX "autonomous_task_runs_trigger_idx" ON "autonomous_task_runs"("trigger");

-- CreateIndex
CREATE INDEX "autonomous_task_runs_startedAt_idx" ON "autonomous_task_runs"("startedAt");

-- CreateIndex
CREATE INDEX "autonomous_artifacts_taskId_idx" ON "autonomous_artifacts"("taskId");

-- CreateIndex
CREATE INDEX "autonomous_artifacts_runId_idx" ON "autonomous_artifacts"("runId");

-- CreateIndex
CREATE INDEX "autonomous_artifacts_kind_idx" ON "autonomous_artifacts"("kind");

-- CreateIndex
CREATE INDEX "autonomous_artifacts_createdAt_idx" ON "autonomous_artifacts"("createdAt");

-- CreateIndex
CREATE INDEX "relationship_review_proposals_reportId_idx" ON "relationship_review_proposals"("reportId");

-- CreateIndex
CREATE INDEX "relationship_review_proposals_relationshipStateId_idx" ON "relationship_review_proposals"("relationshipStateId");

-- CreateIndex
CREATE INDEX "relationship_review_proposals_personId_idx" ON "relationship_review_proposals"("personId");

-- CreateIndex
CREATE INDEX "relationship_review_proposals_userId_idx" ON "relationship_review_proposals"("userId");

-- CreateIndex
CREATE INDEX "relationship_review_proposals_conversationId_idx" ON "relationship_review_proposals"("conversationId");

-- CreateIndex
CREATE INDEX "relationship_review_proposals_status_idx" ON "relationship_review_proposals"("status");

-- CreateIndex
CREATE INDEX "relationship_review_proposals_source_idx" ON "relationship_review_proposals"("source");

-- CreateIndex
CREATE INDEX "relationship_review_proposals_createdAt_idx" ON "relationship_review_proposals"("createdAt");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_proposalId_idx" ON "relationship_review_evidence"("proposalId");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_relationshipStateId_idx" ON "relationship_review_evidence"("relationshipStateId");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_personId_idx" ON "relationship_review_evidence"("personId");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_userId_idx" ON "relationship_review_evidence"("userId");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_conversationId_idx" ON "relationship_review_evidence"("conversationId");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_messageId_idx" ON "relationship_review_evidence"("messageId");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_evidenceType_idx" ON "relationship_review_evidence"("evidenceType");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_polarity_idx" ON "relationship_review_evidence"("polarity");

-- CreateIndex
CREATE INDEX "relationship_review_evidence_createdAt_idx" ON "relationship_review_evidence"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_review_evidence_relationshipStateId_evidenceKe_key" ON "relationship_review_evidence"("relationshipStateId", "evidenceKey");

-- CreateIndex
CREATE INDEX "message_embeddings_messageId_idx" ON "message_embeddings"("messageId");

-- CreateIndex
CREATE INDEX "message_embeddings_conversationId_idx" ON "message_embeddings"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "message_embeddings_messageId_provider_model_dimensions_key" ON "message_embeddings"("messageId", "provider", "model", "dimensions");

-- CreateIndex
CREATE INDEX "memories_personId_idx" ON "memories"("personId");

-- CreateIndex
CREATE INDEX "memories_tier_idx" ON "memories"("tier");

-- CreateIndex
CREATE INDEX "memories_personId_status_idx" ON "memories"("personId", "status");

-- CreateIndex
CREATE INDEX "memories_scope_status_tier_idx" ON "memories"("scope", "status", "tier");

-- CreateIndex
CREATE INDEX "memories_lastMentionedAt_idx" ON "memories"("lastMentionedAt");

-- AddForeignKey
ALTER TABLE "conversation_context_summaries" ADD CONSTRAINT "conversation_context_summaries_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autonomous_task_runs" ADD CONSTRAINT "autonomous_task_runs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "autonomous_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autonomous_artifacts" ADD CONSTRAINT "autonomous_artifacts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "autonomous_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autonomous_artifacts" ADD CONSTRAINT "autonomous_artifacts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "autonomous_task_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_review_proposals" ADD CONSTRAINT "relationship_review_proposals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dream_consolidation_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_review_proposals" ADD CONSTRAINT "relationship_review_proposals_relationshipStateId_fkey" FOREIGN KEY ("relationshipStateId") REFERENCES "relationship_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_review_proposals" ADD CONSTRAINT "relationship_review_proposals_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_review_evidence" ADD CONSTRAINT "relationship_review_evidence_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "relationship_review_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_review_evidence" ADD CONSTRAINT "relationship_review_evidence_relationshipStateId_fkey" FOREIGN KEY ("relationshipStateId") REFERENCES "relationship_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_review_evidence" ADD CONSTRAINT "relationship_review_evidence_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_embeddings" ADD CONSTRAINT "message_embeddings_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
