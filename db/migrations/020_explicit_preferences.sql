-- 020_explicit_preferences.sql
-- Add explicit_preference fact type for user-requested memories.

ALTER TABLE chat_facts DROP CONSTRAINT IF EXISTS chat_facts_fact_type_check;
ALTER TABLE chat_facts ADD CONSTRAINT chat_facts_fact_type_check CHECK (fact_type IN (
    'injury', 'health_condition', 'preference', 'goal',
    'schedule_constraint', 'equipment', 'sport_focus', 'explicit_preference'
));
