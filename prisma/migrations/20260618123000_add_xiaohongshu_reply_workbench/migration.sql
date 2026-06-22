CREATE TABLE "xiaohongshu_posts" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "postType" TEXT NOT NULL DEFAULT 'daily',
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xiaohongshu_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "xiaohongshu_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "externalId" TEXT,
    "authorName" TEXT,
    "content" TEXT NOT NULL,
    "commenterHistory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "replyNeed" TEXT NOT NULL DEFAULT 'unknown',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xiaohongshu_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "xiaohongshu_reply_drafts" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "commentType" TEXT NOT NULL,
    "awareness" TEXT,
    "voice" TEXT,
    "boundary" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xiaohongshu_reply_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "xiaohongshu_posts_externalId_key" ON "xiaohongshu_posts"("externalId");
CREATE INDEX "xiaohongshu_posts_status_idx" ON "xiaohongshu_posts"("status");
CREATE INDEX "xiaohongshu_posts_postType_idx" ON "xiaohongshu_posts"("postType");
CREATE INDEX "xiaohongshu_posts_createdAt_idx" ON "xiaohongshu_posts"("createdAt");
CREATE INDEX "xiaohongshu_comments_postId_idx" ON "xiaohongshu_comments"("postId");
CREATE INDEX "xiaohongshu_comments_status_idx" ON "xiaohongshu_comments"("status");
CREATE INDEX "xiaohongshu_comments_replyNeed_idx" ON "xiaohongshu_comments"("replyNeed");
CREATE INDEX "xiaohongshu_comments_createdAt_idx" ON "xiaohongshu_comments"("createdAt");
CREATE INDEX "xiaohongshu_reply_drafts_commentId_idx" ON "xiaohongshu_reply_drafts"("commentId");
CREATE INDEX "xiaohongshu_reply_drafts_risk_idx" ON "xiaohongshu_reply_drafts"("risk");
CREATE INDEX "xiaohongshu_reply_drafts_status_idx" ON "xiaohongshu_reply_drafts"("status");
CREATE INDEX "xiaohongshu_reply_drafts_createdAt_idx" ON "xiaohongshu_reply_drafts"("createdAt");

ALTER TABLE "xiaohongshu_comments" ADD CONSTRAINT "xiaohongshu_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "xiaohongshu_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "xiaohongshu_reply_drafts" ADD CONSTRAINT "xiaohongshu_reply_drafts_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "xiaohongshu_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
