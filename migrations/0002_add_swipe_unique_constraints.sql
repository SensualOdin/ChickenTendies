-- Prevent duplicate swipes in anonymous groups
CREATE UNIQUE INDEX IF NOT EXISTS "anon_swipe_unique_idx"
  ON "anonymous_group_swipes" ("group_id", "member_id", "restaurant_id");

-- Prevent duplicate swipes in authenticated sessions
CREATE UNIQUE INDEX IF NOT EXISTS "session_swipe_unique_idx"
  ON "session_swipes" ("session_id", "user_id", "restaurant_id");
