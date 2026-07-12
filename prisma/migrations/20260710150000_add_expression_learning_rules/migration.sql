UPDATE "expression_learning_examples"
SET "status" = 'disabled'
WHERE "status" = 'pending';

CREATE TABLE "expression_learning_rules" (
  "id" TEXT NOT NULL,
  "ruleText" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'global',
  "scene" TEXT,
  "strength" TEXT NOT NULL DEFAULT 'soft',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "publishedPath" TEXT,
  "publishedRuleKey" TEXT,
  "publishedContentHash" TEXT,
  "publishedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expression_learning_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expression_learning_rule_evidences" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "exampleId" TEXT NOT NULL,
  "relation" TEXT NOT NULL DEFAULT 'supports',
  "coverage" TEXT NOT NULL DEFAULT 'partial',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expression_learning_rule_evidences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expression_learning_rules_status_scope_idx"
  ON "expression_learning_rules"("status", "scope");
CREATE INDEX "expression_learning_rules_scene_status_idx"
  ON "expression_learning_rules"("scene", "status");
CREATE INDEX "expression_learning_rules_kind_idx"
  ON "expression_learning_rules"("kind");
CREATE INDEX "expression_learning_rules_createdAt_idx"
  ON "expression_learning_rules"("createdAt");

CREATE UNIQUE INDEX "expression_learning_rule_evidences_ruleId_exampleId_key"
  ON "expression_learning_rule_evidences"("ruleId", "exampleId");
CREATE INDEX "expression_learning_rule_evidences_exampleId_idx"
  ON "expression_learning_rule_evidences"("exampleId");
CREATE INDEX "expression_learning_rule_evidences_relation_idx"
  ON "expression_learning_rule_evidences"("relation");

ALTER TABLE "expression_learning_rule_evidences"
  ADD CONSTRAINT "expression_learning_rule_evidences_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "expression_learning_rules"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expression_learning_rule_evidences"
  ADD CONSTRAINT "expression_learning_rule_evidences_exampleId_fkey"
  FOREIGN KEY ("exampleId") REFERENCES "expression_learning_examples"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
