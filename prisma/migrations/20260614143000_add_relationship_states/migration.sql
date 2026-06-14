-- Add per-user relationship state and relationship change events.
CREATE TABLE "relationship_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relationshipLabel" TEXT NOT NULL DEFAULT '刚认识',
    "familiarity" INTEGER NOT NULL DEFAULT 8,
    "trust" INTEGER NOT NULL DEFAULT 8,
    "closeness" INTEGER NOT NULL DEFAULT 5,
    "tension" INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE "relationship_state_events" (
    "id" TEXT NOT NULL,
    "relationshipStateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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

CREATE UNIQUE INDEX "relationship_states_userId_key" ON "relationship_states"("userId");
CREATE INDEX "relationship_states_userId_idx" ON "relationship_states"("userId");
CREATE INDEX "relationship_states_updatedAt_idx" ON "relationship_states"("updatedAt");
CREATE INDEX "relationship_state_events_relationshipStateId_idx" ON "relationship_state_events"("relationshipStateId");
CREATE INDEX "relationship_state_events_userId_idx" ON "relationship_state_events"("userId");
CREATE INDEX "relationship_state_events_eventType_idx" ON "relationship_state_events"("eventType");
CREATE INDEX "relationship_state_events_source_idx" ON "relationship_state_events"("source");
CREATE INDEX "relationship_state_events_createdAt_idx" ON "relationship_state_events"("createdAt");

ALTER TABLE "relationship_states" ADD CONSTRAINT "relationship_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relationship_state_events" ADD CONSTRAINT "relationship_state_events_relationshipStateId_fkey" FOREIGN KEY ("relationshipStateId") REFERENCES "relationship_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relationship_state_events" ADD CONSTRAINT "relationship_state_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
