-- v0.7 Reflection Agent tables

CREATE TABLE "ReflectionJob" (
  "id"             TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "triggerType"    TEXT NOT NULL,
  "scope"          TEXT NOT NULL,
  "userId"         TEXT,
  "conversationId" TEXT,
  "channel"        TEXT,
  "messageFrom"    TIMESTAMP(3),
  "messageTo"      TIMESTAMP(3),
  "messageLimit"   INTEGER,
  "error"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt"      TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  CONSTRAINT "ReflectionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReflectionReport" (
  "id"         TEXT NOT NULL,
  "jobId"      TEXT NOT NULL,
  "summary"    TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "rawOutput"  JSONB,
  "metadata"   JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReflectionReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReflectionReport_jobId_key" ON "ReflectionReport"("jobId");

CREATE TABLE "MemoryProposal" (
  "id"               TEXT NOT NULL,
  "reportId"         TEXT NOT NULL,
  "proposalType"     TEXT NOT NULL,
  "targetMemoryId"   TEXT,
  "scope"            TEXT NOT NULL,
  "type"             TEXT NOT NULL,
  "content"          TEXT NOT NULL,
  "summary"          TEXT,
  "tags"             JSONB,
  "entities"         JSONB,
  "reason"           TEXT NOT NULL,
  "confidence"       DOUBLE PRECISION NOT NULL,
  "riskLevel"        TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "reviewedBy"       TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "appliedMemoryId"  TEXT,
  "sourceMessageIds" JSONB,
  "metadata"         JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemoryProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReflectionRiskFlag" (
  "id"                TEXT NOT NULL,
  "reportId"          TEXT NOT NULL,
  "type"              TEXT NOT NULL,
  "severity"          TEXT NOT NULL,
  "description"       TEXT NOT NULL,
  "suggestedAction"   TEXT,
  "relatedMessageIds" JSONB,
  "status"            TEXT NOT NULL DEFAULT 'open',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReflectionRiskFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrowthLogProposal" (
  "id"               TEXT NOT NULL,
  "reportId"         TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "content"          TEXT NOT NULL,
  "tags"             JSONB,
  "confidence"       DOUBLE PRECISION NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "sourceMessageIds" JSONB,
  "appliedMemoryId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthLogProposal_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ReflectionJob_status_idx"         ON "ReflectionJob"("status");
CREATE INDEX "ReflectionJob_triggerType_idx"     ON "ReflectionJob"("triggerType");
CREATE INDEX "ReflectionJob_conversationId_idx"  ON "ReflectionJob"("conversationId");
CREATE INDEX "ReflectionJob_createdAt_idx"       ON "ReflectionJob"("createdAt");

CREATE INDEX "ReflectionReport_createdAt_idx"    ON "ReflectionReport"("createdAt");

CREATE INDEX "MemoryProposal_reportId_idx"       ON "MemoryProposal"("reportId");
CREATE INDEX "MemoryProposal_status_idx"         ON "MemoryProposal"("status");
CREATE INDEX "MemoryProposal_proposalType_idx"   ON "MemoryProposal"("proposalType");
CREATE INDEX "MemoryProposal_riskLevel_idx"      ON "MemoryProposal"("riskLevel");
CREATE INDEX "MemoryProposal_confidence_idx"     ON "MemoryProposal"("confidence");

CREATE INDEX "ReflectionRiskFlag_reportId_idx"   ON "ReflectionRiskFlag"("reportId");
CREATE INDEX "ReflectionRiskFlag_type_idx"       ON "ReflectionRiskFlag"("type");
CREATE INDEX "ReflectionRiskFlag_severity_idx"   ON "ReflectionRiskFlag"("severity");
CREATE INDEX "ReflectionRiskFlag_status_idx"     ON "ReflectionRiskFlag"("status");

CREATE INDEX "GrowthLogProposal_reportId_idx"    ON "GrowthLogProposal"("reportId");
CREATE INDEX "GrowthLogProposal_status_idx"      ON "GrowthLogProposal"("status");
CREATE INDEX "GrowthLogProposal_createdAt_idx"   ON "GrowthLogProposal"("createdAt");

-- Foreign keys
ALTER TABLE "ReflectionReport"   ADD CONSTRAINT "ReflectionReport_jobId_fkey"
  FOREIGN KEY ("jobId")     REFERENCES "ReflectionJob"("id")     ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryProposal"     ADD CONSTRAINT "MemoryProposal_reportId_fkey"
  FOREIGN KEY ("reportId")  REFERENCES "ReflectionReport"("id")  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReflectionRiskFlag" ADD CONSTRAINT "ReflectionRiskFlag_reportId_fkey"
  FOREIGN KEY ("reportId")  REFERENCES "ReflectionReport"("id")  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GrowthLogProposal"  ADD CONSTRAINT "GrowthLogProposal_reportId_fkey"
  FOREIGN KEY ("reportId")  REFERENCES "ReflectionReport"("id")  ON DELETE CASCADE ON UPDATE CASCADE;
