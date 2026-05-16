-- Native push tokens (FCM for Android, APNs for iOS).
-- Run once against the production database before shipping the FCM
-- send path; the new endpoint /api/push/subscribe-native upserts here.

CREATE TABLE IF NOT EXISTS "native_push_subscriptions" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" varchar NOT NULL REFERENCES "users"("id"),
    "token" text NOT NULL UNIQUE,
    "platform" varchar(10) NOT NULL,
    "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "native_push_user_idx" ON "native_push_subscriptions" ("user_id");
