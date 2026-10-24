-- Mark facts the user explicitly asked Grit to forget. Forgotten rows stay
-- inactive and act as markers: summarizing a conversation that began before the
-- forget skips them, and summaries_redacted_at tracks whether past session
-- summaries were scrubbed (NULL = redaction still owed; retried by the scheduler).
-- Decayed/superseded facts keep forgotten_at NULL.
ALTER TABLE chat_facts
    ADD COLUMN forgotten_at TIMESTAMPTZ,
    ADD COLUMN summaries_redacted_at TIMESTAMPTZ;

CREATE INDEX idx_chat_facts_user_forgotten ON chat_facts(user_id, forgotten_at)
    WHERE forgotten_at IS NOT NULL;
