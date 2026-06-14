-- Add real-person identities and migrate relationship state from User to PersonIdentity.
CREATE TABLE "person_identities" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "identity_links" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto_singleton',
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "person_identities_label_idx" ON "person_identities"("label");
CREATE UNIQUE INDEX "identity_links_userId_key" ON "identity_links"("userId");
CREATE INDEX "identity_links_personId_idx" ON "identity_links"("personId");
CREATE INDEX "identity_links_source_idx" ON "identity_links"("source");

INSERT INTO "person_identities" ("id", "label", "note", "createdAt", "updatedAt")
SELECT
  'person_' || rs."id",
  COALESCE(u."displayName", u."externalId"),
  '由既有 RelationshipState 迁移生成。',
  rs."createdAt",
  CURRENT_TIMESTAMP
FROM "relationship_states" rs
JOIN "app_users" u ON u."id" = rs."userId";

INSERT INTO "person_identities" ("id", "label", "note", "createdAt", "updatedAt")
SELECT
  'person_user_' || u."id",
  COALESCE(u."displayName", u."externalId"),
  '由既有 User 自动生成的单人身份。',
  u."createdAt",
  CURRENT_TIMESTAMP
FROM "app_users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "relationship_states" rs WHERE rs."userId" = u."id"
);

INSERT INTO "identity_links" ("id", "personId", "userId", "source", "verifiedBy", "createdAt")
SELECT
  'link_' || u."id",
  COALESCE('person_' || rs."id", 'person_user_' || u."id"),
  u."id",
  'auto_singleton',
  NULL,
  CURRENT_TIMESTAMP
FROM "app_users" u
LEFT JOIN "relationship_states" rs ON rs."userId" = u."id";

ALTER TABLE "relationship_states" ADD COLUMN "personId" TEXT;

UPDATE "relationship_states"
SET "personId" = 'person_' || "id";

ALTER TABLE "relationship_states" ALTER COLUMN "personId" SET NOT NULL;

ALTER TABLE "relationship_state_events" ADD COLUMN "personId" TEXT;

UPDATE "relationship_state_events" rse
SET "personId" = rs."personId"
FROM "relationship_states" rs
WHERE rs."id" = rse."relationshipStateId";

ALTER TABLE "relationship_state_events" ALTER COLUMN "personId" SET NOT NULL;
ALTER TABLE "relationship_state_events" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "relationship_states" DROP CONSTRAINT "relationship_states_userId_fkey";
ALTER TABLE "relationship_state_events" DROP CONSTRAINT "relationship_state_events_userId_fkey";

DROP INDEX "relationship_states_userId_key";
DROP INDEX "relationship_states_userId_idx";

ALTER TABLE "relationship_states" DROP COLUMN "userId";

CREATE UNIQUE INDEX "relationship_states_personId_key" ON "relationship_states"("personId");
CREATE INDEX "relationship_states_personId_idx" ON "relationship_states"("personId");
CREATE INDEX "relationship_state_events_personId_idx" ON "relationship_state_events"("personId");

ALTER TABLE "identity_links" ADD CONSTRAINT "identity_links_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_links" ADD CONSTRAINT "identity_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relationship_states" ADD CONSTRAINT "relationship_states_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relationship_state_events" ADD CONSTRAINT "relationship_state_events_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relationship_state_events" ADD CONSTRAINT "relationship_state_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
