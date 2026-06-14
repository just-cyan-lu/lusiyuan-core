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

CREATE INDEX "identity_link_proposals_sourceUserId_idx"
  ON "identity_link_proposals"("sourceUserId");

CREATE INDEX "identity_link_proposals_targetPersonId_idx"
  ON "identity_link_proposals"("targetPersonId");

CREATE INDEX "identity_link_proposals_targetUserId_idx"
  ON "identity_link_proposals"("targetUserId");

CREATE INDEX "identity_link_proposals_status_idx"
  ON "identity_link_proposals"("status");

CREATE INDEX "identity_link_proposals_confidence_idx"
  ON "identity_link_proposals"("confidence");

CREATE INDEX "identity_link_proposals_createdAt_idx"
  ON "identity_link_proposals"("createdAt");

ALTER TABLE "identity_link_proposals"
  ADD CONSTRAINT "identity_link_proposals_sourceUserId_fkey"
  FOREIGN KEY ("sourceUserId") REFERENCES "app_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity_link_proposals"
  ADD CONSTRAINT "identity_link_proposals_targetPersonId_fkey"
  FOREIGN KEY ("targetPersonId") REFERENCES "person_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity_link_proposals"
  ADD CONSTRAINT "identity_link_proposals_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "app_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
