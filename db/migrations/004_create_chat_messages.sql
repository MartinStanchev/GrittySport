CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    context VARCHAR(50) NOT NULL DEFAULT 'free_chat'
        CHECK (context IN ('free_chat', 'program_creation', 'post_workout', 'criteria_edit')),
    program_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_user_context ON chat_messages(user_id, context);
CREATE INDEX idx_chat_messages_program_id ON chat_messages(program_id);
