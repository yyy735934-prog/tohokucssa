PRAGMA foreign_keys = OFF;

CREATE TABLE admin_users_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','host','reviewer')),
  display_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000),
  is_super INTEGER NOT NULL DEFAULT 0
);

INSERT INTO admin_users_v2 SELECT id, email, password_hash, role, display_name, created_at, is_super FROM admin_users;

DROP TABLE admin_users;

ALTER TABLE admin_users_v2 RENAME TO admin_users;

PRAGMA foreign_keys = ON;
