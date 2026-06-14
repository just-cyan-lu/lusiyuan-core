-- CreateTable
CREATE TABLE "runtime_states" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'global',
    "moodLabel" TEXT NOT NULL DEFAULT '平稳',
    "moodScore" INTEGER NOT NULL DEFAULT 10,
    "energyLevel" INTEGER NOT NULL DEFAULT 62,
    "stressLevel" INTEGER NOT NULL DEFAULT 24,
    "socialBattery" INTEGER NOT NULL DEFAULT 58,
    "currentGoal" TEXT,
    "currentFocus" TEXT,
    "currentActivity" TEXT,
    "recentEventSummary" TEXT,
    "statusNote" TEXT,
    "autoUpdateEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updateMode" TEXT NOT NULL DEFAULT 'balanced',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runtime_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_state_events" (
    "id" TEXT NOT NULL,
    "runtimeStateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT,
    "summary" TEXT NOT NULL,
    "patch" JSONB,
    "before" JSONB,
    "after" JSONB,
    "userId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_state_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "runtime_states_key_key" ON "runtime_states"("key");

-- CreateIndex
CREATE INDEX "runtime_state_events_runtimeStateId_idx" ON "runtime_state_events"("runtimeStateId");

-- CreateIndex
CREATE INDEX "runtime_state_events_eventType_idx" ON "runtime_state_events"("eventType");

-- CreateIndex
CREATE INDEX "runtime_state_events_source_idx" ON "runtime_state_events"("source");

-- CreateIndex
CREATE INDEX "runtime_state_events_createdAt_idx" ON "runtime_state_events"("createdAt");

-- AddForeignKey
ALTER TABLE "runtime_state_events" ADD CONSTRAINT "runtime_state_events_runtimeStateId_fkey" FOREIGN KEY ("runtimeStateId") REFERENCES "runtime_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
