ALTER TABLE "xiaohongshu_posts"
ADD COLUMN "authorName" TEXT,
ADD COLUMN "imageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "imageAlts" JSONB;
