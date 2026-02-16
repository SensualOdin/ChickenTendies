-- Indexes for session_swipes (queried on every swipe in authenticated flow)
CREATE INDEX IF NOT EXISTS "session_swipes_session_restaurant_idx"
  ON "session_swipes" USING btree ("session_id", "restaurant_id", "liked");

-- Indexes for dining_sessions (queried for active sessions)
CREATE INDEX IF NOT EXISTS "dining_sessions_group_status_idx"
  ON "dining_sessions" USING btree ("group_id", "status");

-- Indexes for notifications (queried on every dashboard load)
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx"
  ON "notifications" USING btree ("user_id", "created_at");

-- Indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx"
  ON "push_subscriptions" USING btree ("user_id");

-- Indexes for friendships
CREATE INDEX IF NOT EXISTS "friendships_requester_idx"
  ON "friendships" USING btree ("requester_id");
CREATE INDEX IF NOT EXISTS "friendships_addressee_idx"
  ON "friendships" USING btree ("addressee_id");

-- Indexes for persistent_groups
CREATE INDEX IF NOT EXISTS "persistent_groups_owner_idx"
  ON "persistent_groups" USING btree ("owner_id");
