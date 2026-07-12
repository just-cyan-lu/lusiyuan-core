CREATE TABLE "expression_learning_dialogue_cases" (
  "id" TEXT NOT NULL,
  "scene" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "trainingFocus" TEXT,
  "rootContextText" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdFrom" TEXT NOT NULL DEFAULT 'manual',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expression_learning_dialogue_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expression_learning_dialogue_turns" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "parentTurnId" TEXT,
  "branchLabel" TEXT,
  "userText" TEXT NOT NULL,
  "pathText" TEXT,
  "draftText" TEXT,
  "finalText" TEXT,
  "outcome" TEXT,
  "ownerAction" TEXT,
  "ownerNote" TEXT,
  "analysisSnapshot" JSONB,
  "exampleId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expression_learning_dialogue_turns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expression_learning_dialogue_cases_scene_idx"
  ON "expression_learning_dialogue_cases"("scene");

CREATE INDEX "expression_learning_dialogue_cases_status_idx"
  ON "expression_learning_dialogue_cases"("status");

CREATE INDEX "expression_learning_dialogue_cases_createdAt_idx"
  ON "expression_learning_dialogue_cases"("createdAt");

CREATE INDEX "expression_learning_dialogue_turns_caseId_idx"
  ON "expression_learning_dialogue_turns"("caseId");

CREATE INDEX "expression_learning_dialogue_turns_parentTurnId_idx"
  ON "expression_learning_dialogue_turns"("parentTurnId");

CREATE INDEX "expression_learning_dialogue_turns_exampleId_idx"
  ON "expression_learning_dialogue_turns"("exampleId");

CREATE INDEX "expression_learning_dialogue_turns_status_idx"
  ON "expression_learning_dialogue_turns"("status");

CREATE INDEX "expression_learning_dialogue_turns_needsReview_idx"
  ON "expression_learning_dialogue_turns"("needsReview");

CREATE INDEX "expression_learning_dialogue_turns_createdAt_idx"
  ON "expression_learning_dialogue_turns"("createdAt");

ALTER TABLE "expression_learning_dialogue_turns"
  ADD CONSTRAINT "expression_learning_dialogue_turns_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "expression_learning_dialogue_cases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expression_learning_dialogue_turns"
  ADD CONSTRAINT "expression_learning_dialogue_turns_parentTurnId_fkey"
  FOREIGN KEY ("parentTurnId") REFERENCES "expression_learning_dialogue_turns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expression_learning_dialogue_turns"
  ADD CONSTRAINT "expression_learning_dialogue_turns_exampleId_fkey"
  FOREIGN KEY ("exampleId") REFERENCES "expression_learning_examples"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
