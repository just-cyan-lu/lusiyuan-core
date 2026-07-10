CREATE TABLE "external_identity_research_jobs" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "sourceUserId" TEXT,
    "sourceMessageId" TEXT,
    "queryAliases" JSONB NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'identity_alias',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identity_research_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_identity_candidates" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "candidateKey" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "role" TEXT,
    "summary" TEXT NOT NULL,
    "publicReach" TEXT,
    "region" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sources" JSONB NOT NULL,
    "evidence" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "promptedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "confirmationMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identity_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_identity_candidates_personId_candidateKey_key"
  ON "external_identity_candidates"("personId", "candidateKey");
CREATE INDEX "external_identity_research_jobs_personId_idx" ON "external_identity_research_jobs"("personId");
CREATE INDEX "external_identity_research_jobs_status_idx" ON "external_identity_research_jobs"("status");
CREATE INDEX "external_identity_research_jobs_sourceUserId_idx" ON "external_identity_research_jobs"("sourceUserId");
CREATE INDEX "external_identity_research_jobs_createdAt_idx" ON "external_identity_research_jobs"("createdAt");
CREATE INDEX "external_identity_candidates_jobId_idx" ON "external_identity_candidates"("jobId");
CREATE INDEX "external_identity_candidates_personId_status_idx" ON "external_identity_candidates"("personId", "status");
CREATE INDEX "external_identity_candidates_status_promptedAt_idx" ON "external_identity_candidates"("status", "promptedAt");
CREATE INDEX "external_identity_candidates_createdAt_idx" ON "external_identity_candidates"("createdAt");

ALTER TABLE "external_identity_research_jobs"
  ADD CONSTRAINT "external_identity_research_jobs_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_identity_candidates"
  ADD CONSTRAINT "external_identity_candidates_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "external_identity_research_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_identity_candidates"
  ADD CONSTRAINT "external_identity_candidates_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
