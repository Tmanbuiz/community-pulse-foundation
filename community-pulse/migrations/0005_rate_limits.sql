-- Rate limit tracking for public submission endpoints
-- Prevents spam by tracking submissions per IP per hour
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,  -- 'volunteers' or 'enquiries'
  submission_count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL,  -- ISO timestamp of the start of the current hour
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  UNIQUE(ip_address, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint
  ON rate_limits(ip_address, endpoint, window_start);
