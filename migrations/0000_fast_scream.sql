CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"restaurant_id" varchar NOT NULL,
	"restaurant_name" varchar(300),
	"action" varchar(30) NOT NULL,
	"cuisine_tags" jsonb,
	"price_range" varchar(10),
	"distance_miles" real,
	"user_lat" varchar(20),
	"user_lng" varchar(20),
	"day_of_week" integer,
	"hour_of_day" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "anonymous_group_swipes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"liked" boolean NOT NULL,
	"swiped_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "anonymous_groups" (
	"id" varchar PRIMARY KEY NOT NULL,
	"code" varchar(6) NOT NULL,
	"name" varchar(200) NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferences" jsonb,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"leader_token" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "anonymous_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "dining_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"session_id" varchar,
	"restaurant_id" varchar NOT NULL,
	"restaurant_name" varchar(200) NOT NULL,
	"restaurant_data" jsonb,
	"visited_at" timestamp DEFAULT now(),
	"rating" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dining_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"created_by_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"preferences" jsonb,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"visited_restaurant_id" varchar,
	"visited_restaurant_data" jsonb,
	"visited_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" varchar NOT NULL,
	"addressee_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "google_places_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" varchar(500) NOT NULL,
	"google_rating" real,
	"google_review_count" integer,
	"google_maps_url" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "google_places_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "group_push_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lifecycle_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" varchar(100) NOT NULL,
	"user_id" varchar,
	"group_id" varchar,
	"session_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "persistent_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"owner_id" varchar NOT NULL,
	"member_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"invite_code" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "persistent_groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restaurant_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"restaurants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"restaurant_data" jsonb,
	"matched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_swipes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"liked" boolean NOT NULL,
	"super_liked" boolean DEFAULT false NOT NULL,
	"swiped_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"achievement_type" varchar(50) NOT NULL,
	"unlocked_at" timestamp DEFAULT now(),
	"data" jsonb
);
--> statement-breakpoint
ALTER TABLE "anonymous_group_swipes" ADD CONSTRAINT "anonymous_group_swipes_group_id_anonymous_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."anonymous_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_history" ADD CONSTRAINT "dining_history_group_id_persistent_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."persistent_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_history" ADD CONSTRAINT "dining_history_session_id_dining_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dining_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_sessions" ADD CONSTRAINT "dining_sessions_group_id_persistent_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."persistent_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_sessions" ADD CONSTRAINT "dining_sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persistent_groups" ADD CONSTRAINT "persistent_groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_cache" ADD CONSTRAINT "restaurant_cache_group_id_anonymous_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."anonymous_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_matches" ADD CONSTRAINT "session_matches_session_id_dining_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dining_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_swipes" ADD CONSTRAINT "session_swipes_session_id_dining_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dining_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_swipes" ADD CONSTRAINT "session_swipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_cuisine_idx" ON "analytics_events" USING btree ("cuisine_tags");--> statement-breakpoint
CREATE INDEX "analytics_geo_idx" ON "analytics_events" USING btree ("user_lat","user_lng");--> statement-breakpoint
CREATE INDEX "analytics_restaurant_idx" ON "analytics_events" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "analytics_action_idx" ON "analytics_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "analytics_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "anon_swipe_group_idx" ON "anonymous_group_swipes" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "anon_swipe_group_restaurant_idx" ON "anonymous_group_swipes" USING btree ("group_id","restaurant_id");--> statement-breakpoint
CREATE INDEX "google_cache_key_idx" ON "google_places_cache" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "lifecycle_event_name_idx" ON "lifecycle_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "lifecycle_created_idx" ON "lifecycle_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lifecycle_group_idx" ON "lifecycle_events" USING btree ("group_id","event_name");