CREATE TABLE IF NOT EXISTS blockzzle_scores (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL,
  lines INTEGER NOT NULL,
  best_clear INTEGER NOT NULL,
  tier TEXT NOT NULL,
  duration_seconds INTEGER,
  board_version TEXT,
  client_version TEXT,
  browser_player_id TEXT,
  day_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  rejected INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_blockzzle_scores_day_score
  ON blockzzle_scores (day_key, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_blockzzle_scores_score
  ON blockzzle_scores (score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_blockzzle_scores_created_at
  ON blockzzle_scores (created_at);

CREATE INDEX IF NOT EXISTS idx_blockzzle_scores_browser_created_at
  ON blockzzle_scores (browser_player_id, created_at);
