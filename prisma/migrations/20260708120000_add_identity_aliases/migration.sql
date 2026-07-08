CREATE TABLE "identity_aliases" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "sourceUserId" TEXT,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'self_identification',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "mentionCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "identity_aliases_personId_normalizedValue_key" ON "identity_aliases"("personId", "normalizedValue");
CREATE INDEX "identity_aliases_personId_idx" ON "identity_aliases"("personId");
CREATE INDEX "identity_aliases_sourceUserId_idx" ON "identity_aliases"("sourceUserId");
CREATE INDEX "identity_aliases_normalizedValue_idx" ON "identity_aliases"("normalizedValue");
CREATE INDEX "identity_aliases_lastSeenAt_idx" ON "identity_aliases"("lastSeenAt");

ALTER TABLE "identity_aliases"
ADD CONSTRAINT "identity_aliases_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity_aliases"
ADD CONSTRAINT "identity_aliases_sourceUserId_fkey"
FOREIGN KEY ("sourceUserId") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
