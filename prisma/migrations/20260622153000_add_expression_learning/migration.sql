ALTER TABLE "xiaohongshu_comments"
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "xiaohongshu_posts"
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "xiaohongshu_reply_drafts"
ADD COLUMN "originalContent" TEXT;

UPDATE "xiaohongshu_reply_drafts"
SET "originalContent" = "content";

ALTER TABLE "xiaohongshu_reply_drafts"
ALTER COLUMN "originalContent" SET NOT NULL;

CREATE TABLE "xiaohongshu_replies" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "externalId" TEXT,
    "content" TEXT NOT NULL,
    "authorMode" TEXT NOT NULL DEFAULT 'owner_as_siyuan',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "publishedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "xiaohongshu_replies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expression_learning_examples" (
    "id" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "platform" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'platform',
    "contextText" TEXT NOT NULL,
    "draftText" TEXT,
    "finalText" TEXT,
    "outcome" TEXT NOT NULL,
    "ownerAction" TEXT NOT NULL,
    "ownerNote" TEXT,
    "lesson" TEXT NOT NULL,
    "reasoning" TEXT,
    "strategy" TEXT,
    "tone" TEXT,
    "avoidances" JSONB,
    "tags" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "status" TEXT NOT NULL DEFAULT 'active',
    "analysisVersion" INTEGER NOT NULL DEFAULT 1,
    "embeddingStatus" TEXT NOT NULL DEFAULT 'pending',
    "embeddingError" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expression_learning_examples_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expression_learning_embeddings" (
    "id" TEXT NOT NULL,
    "exampleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expression_learning_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "xiaohongshu_replies_commentId_key" ON "xiaohongshu_replies"("commentId");
CREATE UNIQUE INDEX "xiaohongshu_replies_externalId_key" ON "xiaohongshu_replies"("externalId");
CREATE INDEX "xiaohongshu_replies_authorMode_idx" ON "xiaohongshu_replies"("authorMode");
CREATE INDEX "xiaohongshu_replies_source_idx" ON "xiaohongshu_replies"("source");
CREATE INDEX "xiaohongshu_replies_publishedAt_idx" ON "xiaohongshu_replies"("publishedAt");

CREATE UNIQUE INDEX "expression_learning_examples_sourceRef_key" ON "expression_learning_examples"("sourceRef");
CREATE INDEX "expression_learning_examples_platform_scene_status_idx" ON "expression_learning_examples"("platform", "scene", "status");
CREATE INDEX "expression_learning_examples_scope_status_idx" ON "expression_learning_examples"("scope", "status");
CREATE INDEX "expression_learning_examples_outcome_idx" ON "expression_learning_examples"("outcome");
CREATE INDEX "expression_learning_examples_ownerAction_idx" ON "expression_learning_examples"("ownerAction");
CREATE INDEX "expression_learning_examples_createdAt_idx" ON "expression_learning_examples"("createdAt");

CREATE INDEX "expression_learning_embeddings_exampleId_idx" ON "expression_learning_embeddings"("exampleId");
CREATE UNIQUE INDEX "expression_learning_embeddings_exampleId_provider_model_dim_key"
ON "expression_learning_embeddings"("exampleId", "provider", "model", "dimensions");

CREATE UNIQUE INDEX "xiaohongshu_comments_postId_externalId_key"
ON "xiaohongshu_comments"("postId", "externalId");

ALTER TABLE "xiaohongshu_replies"
ADD CONSTRAINT "xiaohongshu_replies_commentId_fkey"
FOREIGN KEY ("commentId") REFERENCES "xiaohongshu_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expression_learning_embeddings"
ADD CONSTRAINT "expression_learning_embeddings_exampleId_fkey"
FOREIGN KEY ("exampleId") REFERENCES "expression_learning_examples"("id") ON DELETE CASCADE ON UPDATE CASCADE;
