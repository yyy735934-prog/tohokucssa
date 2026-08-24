-- “组个局”MVP additive migration. Run once against event-platform-db.

CREATE TABLE IF NOT EXISTS gathering_templates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  category         TEXT    NOT NULL CHECK (category IN ('karaoke', 'sport', 'outdoor', 'salon', 'boardgame', 'movie', 'other')),
  sport_name       TEXT    NOT NULL DEFAULT '',
  title_template   TEXT    NOT NULL,
  description      TEXT    NOT NULL DEFAULT '',
  notes            TEXT    NOT NULL DEFAULT '',
  region           TEXT    NOT NULL DEFAULT '',
  default_location TEXT    NOT NULL DEFAULT '',
  event_weekday    INTEGER NOT NULL DEFAULT 6 CHECK (event_weekday BETWEEN 1 AND 7),
  event_time       TEXT    NOT NULL DEFAULT '14:00',
  publish_weekday  INTEGER NOT NULL DEFAULT 1 CHECK (publish_weekday BETWEEN 1 AND 7),
  publish_time     TEXT    NOT NULL DEFAULT '08:00',
  decision_weekday INTEGER NOT NULL DEFAULT 5 CHECK (decision_weekday BETWEEN 1 AND 7),
  decision_time    TEXT    NOT NULL DEFAULT '18:00',
  min_participants INTEGER NOT NULL DEFAULT 4 CHECK (min_participants > 0),
  max_participants INTEGER CHECK (max_participants IS NULL OR max_participants >= min_participants),
  requires_host    INTEGER NOT NULL DEFAULT 0,
  host_user_id     INTEGER REFERENCES admin_users(id),
  carpool_enabled  INTEGER NOT NULL DEFAULT 0,
  approval_status  TEXT    NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'approved', 'paused')),
  approved_by      INTEGER REFERENCES admin_users(id),
  approved_at      INTEGER,
  created_by       INTEGER NOT NULL REFERENCES admin_users(id),
  created_at       INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

ALTER TABLE events ADD COLUMN event_mode TEXT NOT NULL DEFAULT 'standard' CHECK (event_mode IN ('standard', 'gathering'));
ALTER TABLE events ADD COLUMN gathering_state TEXT CHECK (gathering_state IN ('recruiting', 'arrangement_pending', 'confirmed', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE events ADD COLUMN gathering_category TEXT;
ALTER TABLE events ADD COLUMN template_id INTEGER REFERENCES gathering_templates(id);
ALTER TABLE events ADD COLUMN week_key TEXT;
ALTER TABLE events ADD COLUMN min_participants INTEGER;
ALTER TABLE events ADD COLUMN formation_deadline INTEGER;
ALTER TABLE events ADD COLUMN arrangement_due_at INTEGER;
ALTER TABLE events ADD COLUMN arrangement_confirmed_at INTEGER;
ALTER TABLE events ADD COLUMN arrangement_confirmed_by INTEGER REFERENCES admin_users(id);
ALTER TABLE events ADD COLUMN admin_takeover_at INTEGER;
ALTER TABLE events ADD COLUMN requires_host INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN carpool_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN cancel_reason TEXT;
ALTER TABLE events ADD COLUMN cancelled_at INTEGER;

ALTER TABLE signups ADD COLUMN user_id INTEGER REFERENCES admin_users(id);
ALTER TABLE signups ADD COLUMN signup_status TEXT NOT NULL DEFAULT 'joined' CHECK (signup_status IN ('joined', 'ride_pending', 'ride_assigned', 'general_waitlist', 'cancelled'));
ALTER TABLE signups ADD COLUMN transport_mode TEXT NOT NULL DEFAULT 'self' CHECK (transport_mode IN ('self', 'driver', 'passenger', 'public_transport'));
ALTER TABLE signups ADD COLUMN vehicle_note TEXT NOT NULL DEFAULT '';
ALTER TABLE signups ADD COLUMN seats_offered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signups ADD COLUMN assigned_driver_signup_id INTEGER;
ALTER TABLE signups ADD COLUMN cancelled_at INTEGER;
ALTER TABLE signups ADD COLUMN cancel_type TEXT;
ALTER TABLE signups ADD COLUMN cancel_reason TEXT;
ALTER TABLE signups ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'pending' CHECK (attendance_status IN ('pending', 'attended', 'excused', 'no_show'));

CREATE INDEX IF NOT EXISTS idx_events_gathering_state ON events(event_mode, gathering_state, formation_deadline);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_template_week ON events(template_id, week_key) WHERE template_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_event_user ON signups(event_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signups_gathering_status ON signups(event_id, signup_status, created_at);
CREATE INDEX IF NOT EXISTS idx_gathering_templates_schedule ON gathering_templates(approval_status, publish_weekday, publish_time);

CREATE TABLE IF NOT EXISTS gathering_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type    TEXT    NOT NULL,
  template_id INTEGER REFERENCES gathering_templates(id),
  event_id    INTEGER REFERENCES events(id),
  week_key    TEXT,
  status      TEXT    NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  detail      TEXT    NOT NULL DEFAULT '',
  started_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_gathering_jobs_lookup ON gathering_jobs(job_type, template_id, event_id, week_key, started_at DESC);

ALTER TABLE admin_users ADD COLUMN google_linked INTEGER NOT NULL DEFAULT 0;
