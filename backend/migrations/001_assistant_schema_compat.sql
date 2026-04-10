ALTER TABLE chat_sessions ADD COLUMN conversation_summary VARCHAR(2000);
ALTER TABLE chat_sessions ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active';
UPDATE chat_sessions
SET conversation_summary = context_summary
WHERE conversation_summary IS NULL AND context_summary IS NOT NULL;

ALTER TABLE chat_messages ADD COLUMN message TEXT;
ALTER TABLE chat_messages ADD COLUMN ui_payload JSON;
ALTER TABLE chat_messages ADD COLUMN selected_tool VARCHAR(128);
ALTER TABLE chat_messages ADD COLUMN consent_status VARCHAR(32);
UPDATE chat_messages
SET message = content
WHERE message IS NULL AND content IS NOT NULL;
