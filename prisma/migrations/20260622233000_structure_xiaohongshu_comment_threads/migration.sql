DROP TABLE IF EXISTS "xiaohongshu_replies";

ALTER TABLE "xiaohongshu_comments"
  DROP COLUMN IF EXISTS "commenterHistory",
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "replyToId" TEXT,
  ADD COLUMN "authorUserId" TEXT,
  ADD COLUMN "isAuthor" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "replyToAuthorName" TEXT,
  ADD COLUMN "replyToAuthorUserId" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "xiaohongshu_comments"
  ADD CONSTRAINT "xiaohongshu_comments_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "xiaohongshu_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "xiaohongshu_comments_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "xiaohongshu_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "xiaohongshu_comments_parentId_idx" ON "xiaohongshu_comments"("parentId");
CREATE INDEX "xiaohongshu_comments_replyToId_idx" ON "xiaohongshu_comments"("replyToId");
CREATE INDEX "xiaohongshu_comments_postId_parentId_sortOrder_idx" ON "xiaohongshu_comments"("postId", "parentId", "sortOrder");
CREATE INDEX "xiaohongshu_comments_isAuthor_idx" ON "xiaohongshu_comments"("isAuthor");
