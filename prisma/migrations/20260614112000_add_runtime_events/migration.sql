-- Add runtime event journal.
CREATE TABLE "runtime_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 30,
    "topic" TEXT,
    "moodSignal" TEXT,
    "energySignal" TEXT,
    "stressSignal" TEXT,
    "socialSignal" TEXT,
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

CREATE INDEX "runtime_events_eventType_idx" ON "runtime_events"("eventType");
CREATE INDEX "runtime_events_source_idx" ON "runtime_events"("source");
CREATE INDEX "runtime_events_status_idx" ON "runtime_events"("status");
CREATE INDEX "runtime_events_userId_idx" ON "runtime_events"("userId");
CREATE INDEX "runtime_events_conversationId_idx" ON "runtime_events"("conversationId");
CREATE INDEX "runtime_events_createdAt_idx" ON "runtime_events"("createdAt");
