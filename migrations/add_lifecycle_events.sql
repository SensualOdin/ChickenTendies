CREATE TABLE IF NOT EXISTS lifecycle_events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  user_id VARCHAR,
  group_id VARCHAR,
  session_id VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lifecycle_event_name_idx ON lifecycle_events (event_name);
CREATE INDEX IF NOT EXISTS lifecycle_created_idx ON lifecycle_events (created_at);
