-- 活动管理平台 · D1 建表
-- 用法: wrangler d1 execute event-platform-db --file=schema.sql

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    UNIQUE NOT NULL,
  password_hash TEXT    DEFAULT '',
  role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'host', 'reviewer')),
  display_name  TEXT    NOT NULL DEFAULT '',
  is_super      INTEGER NOT NULL DEFAULT 0,
  profile       TEXT    NOT NULL DEFAULT '{}',
  google_linked INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  event_date      TEXT    NOT NULL,
  location        TEXT    NOT NULL DEFAULT '',
  content         TEXT    NOT NULL DEFAULT '',
  notes           TEXT    NOT NULL DEFAULT '',
  capacity        INTEGER,
  lock_at         INTEGER,
  status          TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'open', 'active', 'closed')),
  custom_fields   TEXT    NOT NULL DEFAULT '[]',
  plan            TEXT,
  activity_type   TEXT,
  image_key       TEXT,
  pinned          INTEGER DEFAULT 0,
  created_by      INTEGER REFERENCES admin_users(id),
  submitter_name  TEXT,
  submitter_email TEXT,
  submitter_phone TEXT,
  submitter_note  TEXT,
  submitted_at    INTEGER,
  reviewed_by     INTEGER REFERENCES admin_users(id),
  reviewed_at     INTEGER,
  reject_reason   TEXT,
  event_mode      TEXT    NOT NULL DEFAULT 'standard' CHECK (event_mode IN ('standard', 'gathering')),
  gathering_state TEXT    CHECK (gathering_state IN ('recruiting', 'arrangement_pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  gathering_category TEXT,
  template_id     INTEGER REFERENCES gathering_templates(id),
  week_key        TEXT,
  min_participants INTEGER,
  formation_deadline INTEGER,
  arrangement_due_at INTEGER,
  arrangement_confirmed_at INTEGER,
  arrangement_confirmed_by INTEGER REFERENCES admin_users(id),
  admin_takeover_at INTEGER,
  requires_host   INTEGER NOT NULL DEFAULT 0,
  carpool_enabled INTEGER NOT NULL DEFAULT 0,
  cancel_reason   TEXT,
  cancelled_at    INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_gathering_state ON events(event_mode, gathering_state, formation_deadline);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_template_week ON events(template_id, week_key) WHERE template_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS signups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      INTEGER NOT NULL REFERENCES events(id),
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL,
  phone         TEXT    NOT NULL DEFAULT '',
  data          TEXT    NOT NULL DEFAULT '{}',
  token         TEXT,
  checked_in    INTEGER NOT NULL DEFAULT 0,
  checked_in_at INTEGER,
  user_id       INTEGER REFERENCES admin_users(id),
  signup_status TEXT    NOT NULL DEFAULT 'joined' CHECK (signup_status IN ('joined', 'ride_pending', 'ride_assigned', 'general_waitlist', 'cancelled')),
  transport_mode TEXT   NOT NULL DEFAULT 'self' CHECK (transport_mode IN ('self', 'driver', 'passenger', 'public_transport')),
  vehicle_note  TEXT    NOT NULL DEFAULT '',
  seats_offered INTEGER NOT NULL DEFAULT 0,
  assigned_driver_signup_id INTEGER,
  cancelled_at  INTEGER,
  cancel_type   TEXT,
  cancel_reason TEXT,
  attendance_status TEXT NOT NULL DEFAULT 'pending' CHECK (attendance_status IN ('pending', 'attended', 'excused', 'no_show')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_signups_event ON signups(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_event_email ON signups(event_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_token ON signups(token) WHERE token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_event_user ON signups(event_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signups_gathering_status ON signups(event_id, signup_status, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES admin_users(id),
  type       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  event_id   INTEGER,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT    NOT NULL,
  target_type TEXT    NOT NULL,
  target_id   INTEGER,
  detail      TEXT    NOT NULL DEFAULT '',
  actor       TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

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
