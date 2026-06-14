-- Add runtime update strategy switch.
ALTER TABLE "runtime_states" ADD COLUMN "updateStrategy" TEXT NOT NULL DEFAULT 'rules';
