-- One row per player; progress accumulates across runs.
CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,          -- random id kept in the player's browser (never shown publicly)
  name         TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  best_points  INTEGER NOT NULL DEFAULT 0,
  runs         INTEGER NOT NULL DEFAULT 0,
  deliveries   INTEGER NOT NULL DEFAULT 0,
  total_profit INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_total ON players (total_points DESC, updated_at);

-- Every finished run, for history and duplicate/rate checks.
CREATE TABLE IF NOT EXISTS runs (
  id         TEXT PRIMARY KEY,            -- client-generated, so a retried submit is not counted twice
  player_id  TEXT NOT NULL REFERENCES players (id),
  start_id   TEXT NOT NULL,
  outcome    TEXT NOT NULL,
  profit     INTEGER NOT NULL,
  drive_time REAL NOT NULL,
  distance   INTEGER NOT NULL,
  points     INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_player ON runs (player_id, created_at);
