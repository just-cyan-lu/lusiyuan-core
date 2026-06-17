ALTER TABLE "runtime_state_events"
  ADD COLUMN "sourceRuntimeEventIds" JSONB,
  ADD COLUMN "sourceMessageIds" JSONB;
