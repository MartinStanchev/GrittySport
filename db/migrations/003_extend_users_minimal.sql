ALTER TABLE users
    ADD COLUMN timezone VARCHAR(100),
    ADD COLUMN units_preference VARCHAR(10) NOT NULL DEFAULT 'metric';
