-- Prevent duplicate matches when concurrent swipes race on the same restaurant.
-- The unique index also covers the session_id-only list query as a prefix.
CREATE UNIQUE INDEX IF NOT EXISTS "session_matches_session_restaurant_unique_idx"
  ON "session_matches" ("session_id", "restaurant_id");
