-- Additive migration for the two-category/four-subtype model.
ALTER TABLE events ADD COLUMN event_subtype TEXT NOT NULL DEFAULT 'self_hosted';
ALTER TABLE events ADD COLUMN registration_mode TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE events ADD COLUMN registration_target TEXT;
ALTER TABLE events ADD COLUMN registration_email_subject TEXT;
ALTER TABLE events ADD COLUMN registration_email_body TEXT;
ALTER TABLE events ADD COLUMN schedule_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN schedule_changed_at INTEGER;
ALTER TABLE events ADD COLUMN schedule_changed_by INTEGER;
ALTER TABLE events ADD COLUMN chat_group_guid TEXT;
ALTER TABLE events ADD COLUMN chat_group_created_at INTEGER;
UPDATE events SET event_subtype = CASE WHEN event_mode = 'gathering' THEN 'scheduled' ELSE 'self_hosted' END;
ALTER TABLE signups ADD COLUMN schedule_confirmed_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signups ADD COLUMN schedule_reconfirm_status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE signups ADD COLUMN schedule_reconfirm_token TEXT;
ALTER TABLE signups ADD COLUMN chat_access_token TEXT;

CREATE TABLE IF NOT EXISTS event_host_assignments (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'removed')),
  invite_token TEXT UNIQUE,
  invited_by INTEGER REFERENCES admin_users(id),
  invited_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  responded_at INTEGER,
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE gathering_templates ADD COLUMN gathering_subtype TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE gathering_templates ADD COLUMN recurrence_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE gathering_templates ADD COLUMN allowed_weekdays_json TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,7]';
ALTER TABLE gathering_templates ADD COLUMN booking_horizon_days INTEGER NOT NULL DEFAULT 14;
ALTER TABLE gathering_templates ADD COLUMN publish_lead_minutes INTEGER;
ALTER TABLE gathering_templates ADD COLUMN formation_lead_minutes INTEGER;
CREATE TABLE IF NOT EXISTS gathering_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,
  formation_deadline INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'recruiting' CHECK (state IN ('recruiting', 'confirmed', 'cancelled', 'in_progress', 'completed')),
  min_participants INTEGER NOT NULL,
  max_participants INTEGER,
  confirmed_at INTEGER,
  registration_locked_at INTEGER,
  chat_group_guid TEXT,
  chat_group_created_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(event_id, event_date)
);
CREATE TABLE IF NOT EXISTS gathering_occurrence_selections (
  occurrence_id INTEGER NOT NULL REFERENCES gathering_occurrences(id) ON DELETE CASCADE,
  signup_id INTEGER NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'selected' CHECK (status IN ('selected', 'cancelled')),
  selected_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  cancelled_at INTEGER,
  PRIMARY KEY (occurrence_id, signup_id)
);
CREATE INDEX IF NOT EXISTS idx_events_subtype ON events(event_mode, event_subtype);
CREATE INDEX IF NOT EXISTS idx_occurrences_event_state ON gathering_occurrences(event_id, state, event_date);
CREATE INDEX IF NOT EXISTS idx_occurrence_selections_signup ON gathering_occurrence_selections(signup_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_schedule_reconfirm_token ON signups(schedule_reconfirm_token) WHERE schedule_reconfirm_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_chat_access_token ON signups(chat_access_token) WHERE chat_access_token IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_events_valid_type_insert
BEFORE INSERT ON events
WHEN NOT (
  (NEW.event_mode = 'standard' AND NEW.event_subtype IN ('self_hosted', 'assisted')) OR
  (NEW.event_mode = 'gathering' AND NEW.event_subtype IN ('scheduled', 'date_choice'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid event_mode/event_subtype combination');
END;

CREATE TRIGGER IF NOT EXISTS trg_events_valid_type_update
BEFORE UPDATE OF event_mode, event_subtype ON events
WHEN NOT (
  (NEW.event_mode = 'standard' AND NEW.event_subtype IN ('self_hosted', 'assisted')) OR
  (NEW.event_mode = 'gathering' AND NEW.event_subtype IN ('scheduled', 'date_choice'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid event_mode/event_subtype combination');
END;
