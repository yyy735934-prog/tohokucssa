-- 活动管理平台 · D1 建表 + 种子数据
-- 用法: wrangler d1 execute event-platform-db --file=schema.sql

CREATE TABLE IF NOT EXISTS admin_users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role       TEXT    NOT NULL DEFAULT 'host' CHECK (role IN ('host', 'reviewer')),
  display_name TEXT  NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  event_date    TEXT    NOT NULL,
  location      TEXT    NOT NULL DEFAULT '',
  content       TEXT    NOT NULL DEFAULT '',
  notes         TEXT    NOT NULL DEFAULT '',
  capacity      INTEGER,
  status        TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'open', 'active', 'closed')),
  created_by    INTEGER NOT NULL REFERENCES admin_users(id),
  submitted_at  INTEGER,
  reviewed_by   INTEGER REFERENCES admin_users(id),
  reviewed_at   INTEGER,
  reject_reason TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
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
  checked_in    INTEGER NOT NULL DEFAULT 0,
  checked_in_at INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_signups_event ON signups(event_id);
CREATE INDEX IF NOT EXISTS idx_signups_email ON signups(event_id, email);
