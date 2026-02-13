import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, text, integer, boolean, jsonb, serial, real, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const friendshipStatusEnum = ["pending", "accepted", "declined", "blocked"] as const;
export type FriendshipStatus = typeof friendshipStatusEnum[number];

export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  addresseeId: varchar("addressee_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;

export const persistentGroups = pgTable("persistent_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  memberIds: text("member_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  inviteCode: varchar("invite_code", { length: 10 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PersistentGroup = typeof persistentGroups.$inferSelect;
export type InsertPersistentGroup = typeof persistentGroups.$inferInsert;

export const diningSessionStatusEnum = ["active", "completed", "cancelled"] as const;
export type DiningSessionStatus = typeof diningSessionStatusEnum[number];

export const diningSessions = pgTable("dining_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => persistentGroups.id),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  preferences: jsonb("preferences"),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  visitedRestaurantId: varchar("visited_restaurant_id"),
  visitedRestaurantData: jsonb("visited_restaurant_data"),
  visitedAt: timestamp("visited_at"),
});

export type DiningSession = typeof diningSessions.$inferSelect;
export type InsertDiningSession = typeof diningSessions.$inferInsert;

export const sessionSwipes = pgTable("session_swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => diningSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull(),
  liked: boolean("liked").notNull(),
  superLiked: boolean("super_liked").notNull().default(false),
  swipedAt: timestamp("swiped_at").defaultNow(),
});

export type SessionSwipe = typeof sessionSwipes.$inferSelect;
export type InsertSessionSwipe = typeof sessionSwipes.$inferInsert;

export const sessionMatches = pgTable("session_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => diningSessions.id),
  restaurantId: varchar("restaurant_id").notNull(),
  restaurantData: jsonb("restaurant_data"),
  matchedAt: timestamp("matched_at").defaultNow(),
});

export type SessionMatch = typeof sessionMatches.$inferSelect;
export type InsertSessionMatch = typeof sessionMatches.$inferInsert;

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message"),
  data: jsonb("data"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

export const groupPushSubscriptions = pgTable("group_push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull(),
  memberId: varchar("member_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type GroupPushSubscription = typeof groupPushSubscriptions.$inferSelect;
export type InsertGroupPushSubscription = typeof groupPushSubscriptions.$inferInsert;

export const diningHistory = pgTable("dining_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => persistentGroups.id),
  sessionId: varchar("session_id").references(() => diningSessions.id),
  restaurantId: varchar("restaurant_id").notNull(),
  restaurantName: varchar("restaurant_name", { length: 200 }).notNull(),
  restaurantData: jsonb("restaurant_data"),
  visitedAt: timestamp("visited_at").defaultNow(),
  rating: integer("rating"),
  notes: text("notes"),
});

export type DiningHistory = typeof diningHistory.$inferSelect;
export type InsertDiningHistory = typeof diningHistory.$inferInsert;

export const achievementTypeEnum = [
  "first_match",
  "super_liker",
  "adventurous_eater",
  "crew_leader",
  "social_butterfly",
  "foodie_veteran",
  "match_maker",
  "explorer",
  "sushi_squad",
  "five_star_only",
  "budget_boss",
  "pizza_pal",
  "taco_tuesday"
] as const;
export type AchievementType = typeof achievementTypeEnum[number];

export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  achievementType: varchar("achievement_type", { length: 50 }).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  data: jsonb("data"),
});

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

export const analyticsActionEnum = ["swipe_left", "swipe_right", "super_like", "click_details"] as const;
export type AnalyticsAction = typeof analyticsActionEnum[number];

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  sessionId: varchar("session_id"),
  restaurantId: varchar("restaurant_id").notNull(),
  restaurantName: varchar("restaurant_name", { length: 300 }),
  action: varchar("action", { length: 30 }).notNull(),
  cuisineTags: jsonb("cuisine_tags"),
  priceRange: varchar("price_range", { length: 10 }),
  distanceMiles: real("distance_miles"),
  userLat: varchar("user_lat", { length: 20 }),
  userLng: varchar("user_lng", { length: 20 }),
  dayOfWeek: integer("day_of_week"),
  hourOfDay: integer("hour_of_day"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("analytics_cuisine_idx").on(table.cuisineTags),
  index("analytics_geo_idx").on(table.userLat, table.userLng),
  index("analytics_restaurant_idx").on(table.restaurantId),
  index("analytics_action_idx").on(table.action),
  index("analytics_created_idx").on(table.createdAt),
]);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({ id: true, createdAt: true });
export type InsertAnalyticsEventInput = z.infer<typeof insertAnalyticsEventSchema>;

export const anonymousGroups = pgTable("anonymous_groups", {
  id: varchar("id").primaryKey(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  members: jsonb("members").notNull().default(sql`'[]'::jsonb`),
  preferences: jsonb("preferences"),
  status: varchar("status", { length: 20 }).notNull().default("waiting"),
  leaderToken: varchar("leader_token"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AnonymousGroup = typeof anonymousGroups.$inferSelect;

export const anonymousGroupSwipes = pgTable("anonymous_group_swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => anonymousGroups.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull(),
  restaurantId: varchar("restaurant_id").notNull(),
  liked: boolean("liked").notNull(),
  swipedAt: timestamp("swiped_at").defaultNow(),
}, (table) => [
  index("anon_swipe_group_idx").on(table.groupId),
  index("anon_swipe_group_restaurant_idx").on(table.groupId, table.restaurantId),
]);

export type AnonymousGroupSwipe = typeof anonymousGroupSwipes.$inferSelect;

export const restaurantCache = pgTable("restaurant_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => anonymousGroups.id, { onDelete: "cascade" }),
  restaurants: jsonb("restaurants").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RestaurantCacheEntry = typeof restaurantCache.$inferSelect;

export const googlePlacesCache = pgTable("google_places_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cacheKey: varchar("cache_key", { length: 500 }).notNull().unique(),
  googleRating: real("google_rating"),
  googleReviewCount: integer("google_review_count"),
  googleMapsUrl: text("google_maps_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("google_cache_key_idx").on(table.cacheKey),
]);
