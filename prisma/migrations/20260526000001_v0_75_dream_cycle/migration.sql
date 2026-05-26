-- v0.75 Dream Cycle: DreamJob, DailyNote, DreamSignal, DreamDiaryEntry, DreamConsolidationReport, DreamLock

CREATE TABLE "DreamJob" (
    "id"             TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "triggerType"    TEXT NOT NULL,
    "scope"          TEXT NOT NULL,
    "userId"         TEXT,
    "conversationId" TEXT,
    "channel"        TEXT,
    "fromTime"       TIMESTAMP(3),
    "toTime"         TIMESTAMP(3),
    "phase"          TEXT,
    "error"          TEXT,
    "startedAt"      TIMESTAMP(3),
    "completedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata"       JSONB,
    CONSTRAINT "DreamJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DreamJob_status_idx"      ON "DreamJob"("status");
CREATE INDEX "DreamJob_triggerType_idx" ON "DreamJob"("triggerType");
CREATE INDEX "DreamJob_scope_idx"       ON "DreamJob"("scope");
CREATE INDEX "DreamJob_createdAt_idx"   ON "DreamJob"("createdAt");

CREATE TABLE "DailyNote" (
    "id"          TEXT NOT NULL,
    "jobId"       TEXT,
    "date"        TIMESTAMP(3) NOT NULL,
    "scope"       TEXT NOT NULL,
    "userId"      TEXT,
    "channel"     TEXT,
    "title"       TEXT,
    "summary"     TEXT NOT NULL,
    "keyPoints"   JSONB,
    "sourceStats" JSONB,
    "riskSummary" JSONB,
    "status"      TEXT NOT NULL DEFAULT 'active',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DailyNote_date_idx"   ON "DailyNote"("date");
CREATE INDEX "DailyNote_scope_idx"  ON "DailyNote"("scope");
CREATE INDEX "DailyNote_userId_idx" ON "DailyNote"("userId");
CREATE INDEX "DailyNote_status_idx" ON "DailyNote"("status");

ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "DreamJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DreamSignal" (
    "id"            TEXT NOT NULL,
    "jobId"         TEXT,
    "signalType"    TEXT NOT NULL,
    "content"       TEXT NOT NULL,
    "summary"       TEXT,
    "confidence"    DOUBLE PRECISION NOT NULL,
    "strength"      DOUBLE PRECISION NOT NULL,
    "riskLevel"     TEXT NOT NULL DEFAULT 'low',
    "sourceTypes"   JSONB,
    "sourceIds"     JSONB,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "tags"          JSONB,
    "entities"      JSONB,
    "status"        TEXT NOT NULL DEFAULT 'active',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DreamSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DreamSignal_signalType_idx"  ON "DreamSignal"("signalType");
CREATE INDEX "DreamSignal_confidence_idx"  ON "DreamSignal"("confidence");
CREATE INDEX "DreamSignal_strength_idx"    ON "DreamSignal"("strength");
CREATE INDEX "DreamSignal_riskLevel_idx"   ON "DreamSignal"("riskLevel");
CREATE INDEX "DreamSignal_status_idx"      ON "DreamSignal"("status");

ALTER TABLE "DreamSignal" ADD CONSTRAINT "DreamSignal_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "DreamJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DreamDiaryEntry" (
    "id"               TEXT NOT NULL,
    "jobId"            TEXT,
    "date"             TIMESTAMP(3) NOT NULL,
    "title"            TEXT,
    "content"          TEXT NOT NULL,
    "style"            TEXT NOT NULL DEFAULT 'lusiyuan_inner_diary',
    "grounded"         BOOLEAN NOT NULL DEFAULT true,
    "sourceSignalIds"  JSONB,
    "sourceMessageIds" JSONB,
    "visibility"       TEXT NOT NULL DEFAULT 'owner_only',
    "status"           TEXT NOT NULL DEFAULT 'active',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DreamDiaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DreamDiaryEntry_date_idx"       ON "DreamDiaryEntry"("date");
CREATE INDEX "DreamDiaryEntry_visibility_idx" ON "DreamDiaryEntry"("visibility");
CREATE INDEX "DreamDiaryEntry_status_idx"     ON "DreamDiaryEntry"("status");

ALTER TABLE "DreamDiaryEntry" ADD CONSTRAINT "DreamDiaryEntry_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "DreamJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DreamConsolidationReport" (
    "id"                   TEXT NOT NULL,
    "jobId"                TEXT,
    "summary"              TEXT NOT NULL,
    "phase"                TEXT NOT NULL,
    "candidateCount"       INTEGER NOT NULL DEFAULT 0,
    "promotedCount"        INTEGER NOT NULL DEFAULT 0,
    "rejectedCount"        INTEGER NOT NULL DEFAULT 0,
    "riskCount"            INTEGER NOT NULL DEFAULT 0,
    "generatedProposalIds" JSONB,
    "rawOutput"            JSONB,
    "metadata"             JSONB,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DreamConsolidationReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DreamConsolidationReport_phase_idx"     ON "DreamConsolidationReport"("phase");
CREATE INDEX "DreamConsolidationReport_createdAt_idx" ON "DreamConsolidationReport"("createdAt");

ALTER TABLE "DreamConsolidationReport" ADD CONSTRAINT "DreamConsolidationReport_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "DreamJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DreamLock" (
    "id"        TEXT NOT NULL,
    "lockKey"   TEXT NOT NULL,
    "owner"     TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DreamLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DreamLock_lockKey_key" ON "DreamLock"("lockKey");
CREATE INDEX "DreamLock_expiresAt_idx"      ON "DreamLock"("expiresAt");
