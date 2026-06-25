CREATE TABLE "expression_learning_training_records" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "scope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'started',
    "contextText" TEXT,
    "draftText" TEXT,
    "finalText" TEXT,
    "outcome" TEXT,
    "ownerAction" TEXT,
    "ownerNote" TEXT,
    "reasonText" TEXT,
    "generatedQuestion" JSONB,
    "generatedDraft" JSONB,
    "analysisSnapshot" JSONB,
    "exportPayload" JSONB,
    "rawPayload" JSONB,
    "exampleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expression_learning_training_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expression_learning_training_records_sourceType_idx"
ON "expression_learning_training_records"("sourceType");

CREATE INDEX "expression_learning_training_records_platform_scene_idx"
ON "expression_learning_training_records"("platform", "scene");

CREATE INDEX "expression_learning_training_records_status_idx"
ON "expression_learning_training_records"("status");

CREATE INDEX "expression_learning_training_records_outcome_idx"
ON "expression_learning_training_records"("outcome");

CREATE INDEX "expression_learning_training_records_exampleId_idx"
ON "expression_learning_training_records"("exampleId");

CREATE INDEX "expression_learning_training_records_createdAt_idx"
ON "expression_learning_training_records"("createdAt");

ALTER TABLE "expression_learning_training_records"
ADD CONSTRAINT "expression_learning_training_records_exampleId_fkey"
FOREIGN KEY ("exampleId") REFERENCES "expression_learning_examples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
