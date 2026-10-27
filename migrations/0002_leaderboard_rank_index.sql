-- The leaderboard order, so the top list and a player's position read only the rows they need
-- instead of sorting every player (D1 bills every row a query reads).
CREATE INDEX IF NOT EXISTS players_rank
  ON players (total_points DESC, best_points DESC, deliveries DESC, total_profit DESC, created_at)
  WHERE runs > 0;
