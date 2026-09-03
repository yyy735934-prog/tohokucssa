-- Add multiple candidate hosts and per-event host acceptance offers.
-- Safe to run after migrate-gatherings.sql.

CREATE TABLE IF NOT EXISTS gathering_template_hosts (
  template_id INTEGER NOT NULL REFERENCES gathering_templates(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES admin_users(id),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (template_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gathering_template_hosts_user ON gathering_template_hosts(user_id, template_id);

INSERT OR IGNORE INTO gathering_template_hosts (template_id, user_id)
SELECT id, host_user_id FROM gathering_templates WHERE host_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS gathering_host_offers (
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES admin_users(id),
  accept_token TEXT    NOT NULL UNIQUE,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'closed')),
  responded_at INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gathering_host_offers_event ON gathering_host_offers(event_id, status);

-- Preserve already-generated gatherings that had a single assigned host.
INSERT OR IGNORE INTO gathering_host_offers (event_id, user_id, accept_token, status, responded_at)
SELECT id, created_by, lower(hex(randomblob(16))), 'accepted', COALESCE(submitted_at, created_at)
FROM events
WHERE event_mode = 'gathering' AND created_by IS NOT NULL;
