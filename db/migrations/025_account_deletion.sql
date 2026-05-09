-- 025_account_deletion.sql
-- Account deletion (GDPR Art. 17 "right to erasure"). All other user-scoped
-- tables already cascade from users.id, so deleting a user purges everything.
--
-- The exception is user_consents: under GDPR Art. 7(1) the controller must be
-- able to prove consent was given, so we keep the consent rows but anonymize
-- them on account delete. user_id becomes NULL (via ON DELETE SET NULL) and
-- the application clears ip_address / user_agent in the same transaction.
-- consent_type, version, and accepted_at remain as aggregate proof of consent.

ALTER TABLE user_consents
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE user_consents
    DROP CONSTRAINT user_consents_user_id_fkey;

ALTER TABLE user_consents
    ADD CONSTRAINT user_consents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
