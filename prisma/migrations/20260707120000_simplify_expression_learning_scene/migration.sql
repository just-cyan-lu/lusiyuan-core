DROP INDEX IF EXISTS "expression_learning_examples_platform_scene_status_idx";
DROP INDEX IF EXISTS "expression_learning_examples_scope_status_idx";
DROP INDEX IF EXISTS "expression_learning_training_records_platform_scene_idx";

ALTER TABLE "expression_learning_examples"
  DROP COLUMN IF EXISTS "platform",
  DROP COLUMN IF EXISTS "scope";

ALTER TABLE "expression_learning_training_records"
  DROP COLUMN IF EXISTS "platform",
  DROP COLUMN IF EXISTS "scope";

CREATE INDEX IF NOT EXISTS "expression_learning_examples_scene_status_idx"
  ON "expression_learning_examples"("scene", "status");

CREATE INDEX IF NOT EXISTS "expression_learning_training_records_scene_idx"
  ON "expression_learning_training_records"("scene");
