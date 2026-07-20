-- The local mock publisher was only a development scaffold. Remove its fixture,
-- derived learning example, conversation mirror, audits, and persisted switches.
DELETE FROM "chat_messages"
WHERE "conversationId" IN (
  SELECT "id"
  FROM "chat_conversations"
  WHERE "channel" = 'xiaohongshu'
    AND "metadata" ->> 'postExternalId' = 'mock-xiaohongshu-island-note'
);

DELETE FROM "chat_conversations"
WHERE "channel" = 'xiaohongshu'
  AND "metadata" ->> 'postExternalId' = 'mock-xiaohongshu-island-note';

DELETE FROM "expression_learning_examples"
WHERE "sourceType" = 'xiaohongshu_comment'
  AND "sourceId" IN (
    SELECT "id"
    FROM "xiaohongshu_comments"
    WHERE "source" = 'mock_xiaohongshu'
  );

DELETE FROM "xiaohongshu_posts"
WHERE "source" = 'mock_xiaohongshu';

DELETE FROM "system_setting_events"
WHERE "key" IN ('MOCK_XIAOHONGSHU_PUBLISHER_ENABLED', 'MOCK_XIAOHONGSHU_PUBLISHER_URL');

DELETE FROM "system_settings"
WHERE "key" IN ('MOCK_XIAOHONGSHU_PUBLISHER_ENABLED', 'MOCK_XIAOHONGSHU_PUBLISHER_URL');
