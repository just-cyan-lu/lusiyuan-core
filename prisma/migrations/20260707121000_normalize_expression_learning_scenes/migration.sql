UPDATE "expression_learning_examples"
SET "scene" = CASE
  WHEN "scene" IN ('general', 'chat', 'reply') THEN "scene"
  WHEN "scene" ILIKE '%chat%' THEN 'chat'
  WHEN "scene" ILIKE '%reply%' OR "sourceType" ILIKE '%xiaohongshu%' THEN 'reply'
  ELSE 'general'
END;

UPDATE "expression_learning_training_records"
SET "scene" = CASE
  WHEN "scene" IN ('general', 'chat', 'reply') THEN "scene"
  WHEN "scene" ILIKE '%chat%' THEN 'chat'
  WHEN "scene" ILIKE '%reply%' OR "sourceType" ILIKE '%xiaohongshu%' THEN 'reply'
  ELSE 'general'
END;
