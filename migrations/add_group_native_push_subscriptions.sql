-- Per-group native push tokens (FCM/APNs) for anonymous-party members.
-- Pairs with native_push_subscriptions (user-scoped) — that table covers
-- authenticated crew flows; this one covers the "guest joins a party with
-- only a code" flow where there's no user_id to key on. Run once.

CREATE TABLE IF NOT EXISTS "group_native_push_subscriptions" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "group_id" varchar NOT NULL,
    "member_id" varchar NOT NULL,
    "token" text NOT NULL,
    "platform" varchar(10) NOT NULL,
    "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "group_native_push_group_idx" ON "group_native_push_subscriptions" ("group_id");
CREATE INDEX IF NOT EXISTS "group_native_push_token_idx" ON "group_native_push_subscriptions" ("token");
