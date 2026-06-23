CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "system_setting_events" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB NOT NULL,
    "changedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_setting_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "system_settings_updatedAt_idx" ON "system_settings"("updatedAt");
CREATE INDEX "system_setting_events_key_idx" ON "system_setting_events"("key");
CREATE INDEX "system_setting_events_createdAt_idx" ON "system_setting_events"("createdAt");
