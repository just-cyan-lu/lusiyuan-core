CREATE TABLE "platform_comment_publish_attempts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "draftId" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "target" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "verification" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_comment_publish_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_comment_publish_attempts_platform_status_idx" ON "platform_comment_publish_attempts"("platform", "status");
CREATE INDEX "platform_comment_publish_attempts_commentId_createdAt_idx" ON "platform_comment_publish_attempts"("commentId", "createdAt");
CREATE INDEX "platform_comment_publish_attempts_draftId_idx" ON "platform_comment_publish_attempts"("draftId");

ALTER TABLE "platform_comment_publish_attempts" ADD CONSTRAINT "platform_comment_publish_attempts_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "xiaohongshu_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_comment_publish_attempts" ADD CONSTRAINT "platform_comment_publish_attempts_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "xiaohongshu_reply_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
