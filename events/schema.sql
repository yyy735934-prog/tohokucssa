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
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

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
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_signups_event ON signups(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_event_email ON signups(event_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_token ON signups(token) WHERE token IS NOT NULL;

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
