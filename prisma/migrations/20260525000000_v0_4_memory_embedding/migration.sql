-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Upgrade Memory table: new structured fields
ALTER TABLE "Memory"
  ADD COLUMN "scope"          TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN "summary"        TEXT,
  ADD COLUMN "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  ADD COLUMN "status"         TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "tags"           JSONB,
  ADD COLUMN "entities"       JSONB,
  ADD COLUMN "channel"        TEXT,
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "lastAccessedAt" TIMESTAMPTZ,
  ADD COLUMN "accessCount"    INTEGER NOT NULL DEFAULT 0;

-- New indexes on Memory
CREATE INDEX IF NOT EXISTS "Memory_status_scope_type_idx" ON "Memory" ("status", "scope", "type");
CREATE INDEX IF NOT EXISTS "Memory_userId_status_idx"    ON "Memory" ("userId", "status");

-- Create MemoryEmbedding table (no vector column yet — added separately)
CREATE TABLE "MemoryEmbedding" (
  "id"          TEXT NOT NULL,
  "memoryId"    TEXT NOT NULL,
  "provider"    TEXT NOT NULL,
  "model"       TEXT NOT NULL,
  "dimensions"  INTEGER NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "MemoryEmbedding_pkey" PRIMARY KEY ("id")
);

-- Add the vector column
ALTER TABLE "MemoryEmbedding"
  ADD COLUMN "embedding" vector(1024);

-- Foreign key
ALTER TABLE "MemoryEmbedding"
  ADD CONSTRAINT "MemoryEmbedding_memoryId_fkey"
  FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE;

-- Unique and regular indexes
CREATE UNIQUE INDEX "MemoryEmbedding_memoryId_provider_model_dimensions_key"
  ON "MemoryEmbedding" ("memoryId", "provider", "model", "dimensions");

CREATE INDEX "MemoryEmbedding_memoryId_idx" ON "MemoryEmbedding" ("memoryId");

-- HNSW vector index (partial: only for our provider/model/dimensions)
CREATE INDEX IF NOT EXISTS "memory_embedding_hnsw_idx"
  ON "MemoryEmbedding"
  USING hnsw (embedding vector_cosine_ops)
  WHERE provider = 'siliconflow'
    AND model = 'Qwen/Qwen3-Embedding-4B'
    AND dimensions = 1024;
