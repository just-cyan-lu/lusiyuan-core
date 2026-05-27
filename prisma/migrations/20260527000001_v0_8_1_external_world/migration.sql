-- v0.8.1: External World Perception Layer

-- ExternalPageSnapshot: 页面读取历史
CREATE TABLE "ExternalPageSnapshot" (
  "id"             TEXT PRIMARY KEY,
  "url"            TEXT NOT NULL,
  "tool"           TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "screenshotPath" TEXT,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "ExternalPageSnapshot_url_idx" ON "ExternalPageSnapshot"("url");
CREATE INDEX "ExternalPageSnapshot_tool_idx" ON "ExternalPageSnapshot"("tool");
CREATE INDEX "ExternalPageSnapshot_createdAt_idx" ON "ExternalPageSnapshot"("createdAt");

-- ExternalInboxItem: 平台 inbox/评论条目
CREATE TABLE "ExternalInboxItem" (
  "id"          TEXT PRIMARY KEY,
  "platform"    TEXT NOT NULL,
  "sourceId"    TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "authorName"  TEXT,
  "postTitle"   TEXT,
  "postUrl"     TEXT,
  "summary"     TEXT,
  "draftId"     TEXT,
  "syncedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "ExternalInboxItem_platform_sourceId_key" ON "ExternalInboxItem"("platform", "sourceId");
CREATE INDEX "ExternalInboxItem_platform_idx" ON "ExternalInboxItem"("platform");
CREATE INDEX "ExternalInboxItem_type_idx" ON "ExternalInboxItem"("type");
CREATE INDEX "ExternalInboxItem_syncedAt_idx" ON "ExternalInboxItem"("syncedAt");
