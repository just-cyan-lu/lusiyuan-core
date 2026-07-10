CREATE TABLE "expression_learning_distillation_batches" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "scene" TEXT,
  "organization" TEXT NOT NULL DEFAULT 'unorganized',
  "fromTime" TIMESTAMP(3),
  "toTime" TIMESTAMP(3),
  "sourceExampleIds" JSONB NOT NULL,
  "sourceCount" INTEGER NOT NULL,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "rawOutput" JSONB,
  "error" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expression_learning_distillation_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expression_learning_distillation_candidates" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "ruleText" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'global',
  "scene" TEXT,
  "strength" TEXT NOT NULL DEFAULT 'soft',
  "coverage" TEXT NOT NULL DEFAULT 'partial',
  "reason" TEXT,
  "sourceExampleIds" JSONB NOT NULL,
  "matchType" TEXT NOT NULL DEFAULT 'new',
  "matchedRuleId" TEXT,
  "matchReason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "createdRuleId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expression_learning_distillation_candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expression_learning_distillation_batches_status_idx"
  ON "expression_learning_distillation_batches"("status");
CREATE INDEX "expression_learning_distillation_batches_createdAt_idx"
  ON "expression_learning_distillation_batches"("createdAt");
CREATE INDEX "expression_learning_distillation_candidates_batchId_status_idx"
  ON "expression_learning_distillation_candidates"("batchId", "status");
CREATE INDEX "expression_learning_distillation_candidates_matchedRuleId_idx"
  ON "expression_learning_distillation_candidates"("matchedRuleId");
CREATE INDEX "expression_learning_distillation_candidates_createdRuleId_idx"
  ON "expression_learning_distillation_candidates"("createdRuleId");
CREATE INDEX "expression_learning_distillation_candidates_matchType_idx"
  ON "expression_learning_distillation_candidates"("matchType");

ALTER TABLE "expression_learning_distillation_candidates"
  ADD CONSTRAINT "expression_learning_distillation_candidates_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "expression_learning_distillation_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expression_learning_distillation_candidates"
  ADD CONSTRAINT "expression_learning_distillation_candidates_matchedRuleId_fkey"
  FOREIGN KEY ("matchedRuleId") REFERENCES "expression_learning_rules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expression_learning_distillation_candidates"
  ADD CONSTRAINT "expression_learning_distillation_candidates_createdRuleId_fkey"
  FOREIGN KEY ("createdRuleId") REFERENCES "expression_learning_rules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
