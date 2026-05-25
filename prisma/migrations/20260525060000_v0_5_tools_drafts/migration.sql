-- Add ToolCallLog table
CREATE TABLE "ToolCallLog" (
  "id"             TEXT NOT NULL,
  "toolName"       TEXT NOT NULL,
  "riskLevel"      TEXT NOT NULL,
  "status"         TEXT NOT NULL,
  "userId"         TEXT,
  "conversationId" TEXT,
  "messageId"      TEXT,
  "channel"        TEXT,
  "input"          JSONB,
  "output"         JSONB,
  "error"          TEXT,
  "blocked"        BOOLEAN NOT NULL DEFAULT false,
  "blockReason"    TEXT,
  "durationMs"     INTEGER,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ToolCallLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ToolCallLog_toolName_idx"      ON "ToolCallLog" ("toolName");
CREATE INDEX "ToolCallLog_userId_idx"        ON "ToolCallLog" ("userId");
CREATE INDEX "ToolCallLog_conversationId_idx" ON "ToolCallLog" ("conversationId");
CREATE INDEX "ToolCallLog_status_idx"        ON "ToolCallLog" ("status");
CREATE INDEX "ToolCallLog_createdAt_idx"     ON "ToolCallLog" ("createdAt");

-- Add Draft table
CREATE TABLE "Draft" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT,
  "conversationId" TEXT,
  "channel"        TEXT,
  "type"           TEXT NOT NULL,
  "title"          TEXT,
  "content"        TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'draft',
  "metadata"       JSONB,
  "createdByTool"  TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Draft_userId_idx"        ON "Draft" ("userId");
CREATE INDEX "Draft_conversationId_idx" ON "Draft" ("conversationId");
CREATE INDEX "Draft_type_idx"          ON "Draft" ("type");
CREATE INDEX "Draft_status_idx"        ON "Draft" ("status");
CREATE INDEX "Draft_createdAt_idx"     ON "Draft" ("createdAt");
