CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_name  TEXT    NOT NULL UNIQUE,
  folder_path   TEXT    NOT NULL,
  status        TEXT    NOT NULL CHECK(status IN ('IDLE','IN_USE','CORRUPT')) DEFAULT 'IDLE',
  slot_id       INTEGER,
  ws_port       INTEGER,
  cdp_port      INTEGER,
  pids          TEXT,
  allocated_at  TEXT,
  last_active   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  window_width  INTEGER NOT NULL DEFAULT 1920,
  window_height INTEGER NOT NULL DEFAULT 1080,
  launch_args   TEXT    NOT NULL DEFAULT '',
  note          TEXT    NOT NULL DEFAULT '',
  launch_config TEXT    NOT NULL DEFAULT '{}',
  group_id      INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  tags          TEXT    NOT NULL DEFAULT '[]'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_in_use
  ON profiles(slot_id)
  WHERE status='IN_USE';
