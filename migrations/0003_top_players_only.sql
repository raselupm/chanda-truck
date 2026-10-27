-- Keep only the leaderboard itself: at most 100 rows (the worker drops whoever falls off the bottom).
-- Each player's own totals live in their browser; a run only touches the database when it scores points.
CREATE TABLE IF NOT EXISTS leaders (
  id           TEXT PRIMARY KEY,          -- random id kept in the player's browser (never shown publicly)
  name         TEXT NOT NULL,
  total_points INTEGER NOT NULL,
  best_points  INTEGER NOT NULL,
  runs         INTEGER NOT NULL,
  deliveries   INTEGER NOT NULL,
  total_profit INTEGER NOT NULL,
  best_route   TEXT,                      -- start point id of the best run
  created_at   INTEGER NOT NULL,
  last_run_id  TEXT,                      -- a retried submit of the same run is not counted twice
  last_run_at  INTEGER NOT NULL
);

-- Carry over the current top 100; every other row is deleted
INSERT OR IGNORE INTO leaders
SELECT p.id, p.name, p.total_points, p.best_points, p.runs, p.deliveries, p.total_profit,
  (SELECT r.start_id FROM runs r WHERE r.player_id = p.id ORDER BY r.points DESC, r.profit DESC, r.created_at ASC LIMIT 1),
  p.created_at, NULL, p.updated_at
FROM players p WHERE p.runs > 0 AND p.total_points > 0
ORDER BY p.total_points DESC, p.best_points DESC, p.deliveries DESC, p.total_profit DESC, p.created_at ASC
LIMIT 100;

-- The full history is no longer needed
DROP TABLE IF EXISTS runs;
DROP TABLE IF EXISTS players;
