-- Drop the old non-unique index, add unique constraint to prevent duplicate signups
DROP INDEX IF EXISTS idx_signups_email;
CREATE UNIQUE INDEX idx_signups_event_email ON signups(event_id, email);
