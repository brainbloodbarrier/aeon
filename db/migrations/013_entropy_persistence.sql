-- Migration 013: Cross-session entropy persistence
-- Stores per-persona per-user entropy state across sessions
-- Supports temporal decay between sessions (Issue #36)

CREATE TABLE IF NOT EXISTS entropy_states (
  id SERIAL PRIMARY KEY,
  persona_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  entropy_value FLOAT NOT NULL DEFAULT 0.0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  session_count INTEGER DEFAULT 0,
  UNIQUE(persona_id, user_id)
);

-- Index for fast lookups by persona+user pair
CREATE INDEX IF NOT EXISTS idx_entropy_states_persona_user
  ON entropy_states (persona_id, user_id);
