import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { users } from "./auth";

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
});

export type DiningSession = typeof diningSessions.$inferSelect;
export type InsertDiningSession = typeof diningSessions.$inferInsert;

export const sessionSwipes = pgTable("session_swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => diningSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull(),
  liked: boolean("liked").notNull(),
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
