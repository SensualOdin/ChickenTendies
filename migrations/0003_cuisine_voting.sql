ALTER TABLE "anonymous_groups" ADD COLUMN IF NOT EXISTS "cuisine_deck" jsonb;
ALTER TABLE "anonymous_groups" ADD COLUMN IF NOT EXISTS "matched_cuisines" jsonb;

CREATE TABLE IF NOT EXISTS "anonymous_group_cuisine_votes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" varchar NOT NULL REFERENCES "anonymous_groups"("id") ON DELETE CASCADE,
  "member_id" varchar NOT NULL,
  "cuisine" varchar NOT NULL,
  "liked" boolean NOT NULL,
  "voted_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agcv_group_idx" ON "anonymous_group_cuisine_votes" ("group_id");
CREATE INDEX IF NOT EXISTS "agcv_group_cuisine_idx" ON "anonymous_group_cuisine_votes" ("group_id","cuisine","liked");
CREATE UNIQUE INDEX IF NOT EXISTS "agcv_unique_idx" ON "anonymous_group_cuisine_votes" ("group_id","member_id","cuisine");
