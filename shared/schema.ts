import { z } from "zod";

// Dietary restrictions enum
export const dietaryRestrictions = [
  "vegetarian",
  "vegan", 
  "gluten-free",
  "halal",
  "kosher",
  "dairy-free",
  "nut-free",
  "pescatarian"
] as const;

export type DietaryRestriction = typeof dietaryRestrictions[number];

// Cuisine types
export const cuisineTypes = [
  "Italian",
  "Mexican",
  "Chinese",
  "Japanese",
  "Indian",
  "Thai",
  "American",
  "Mediterranean",
  "French",
  "Korean",
  "Vietnamese",
  "Greek",
  "Middle Eastern",
  "Spanish",
  "Seafood",
  "Steakhouse",
  "Pizza",
  "Burger",
  "Sushi",
  "BBQ"
] as const;

export type CuisineType = typeof cuisineTypes[number];

// Price range
export const priceRanges = ["$", "$$", "$$$", "$$$$"] as const;
export type PriceRange = typeof priceRanges[number];

// Group member
export const groupMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  isHost: z.boolean().default(false),
  joinedAt: z.number(),
  doneSwiping: z.boolean().default(false)
});

export type GroupMember = z.infer<typeof groupMemberSchema>;

// Group preferences
export const groupPreferencesSchema = z.object({
  zipCode: z.string().min(1).max(100), // Can be zip code or full address
  radius: z.number().min(1).max(50).default(10),
  dietaryRestrictions: z.array(z.enum(dietaryRestrictions)).default([]),
  cuisineTypes: z.array(z.enum(cuisineTypes)).default([]),
  priceRange: z.array(z.enum(priceRanges)).default(["$", "$$", "$$$"]),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  trySomethingNew: z.boolean().optional().default(false), // Hide cuisines already matched on
  excludeCuisines: z.array(z.string()).optional().default([]), // Cuisines to exclude
  excludeVisited: z.boolean().optional().default(false), // Exclude restaurants crew has already visited
});

export type GroupPreferences = z.infer<typeof groupPreferencesSchema>;

// Group
export const groupSchema = z.object({
  id: z.string(),
  code: z.string().length(6),
  name: z.string().min(1),
  members: z.array(groupMemberSchema),
  preferences: groupPreferencesSchema.nullable(),
  status: z.enum(["waiting", "configuring", "swiping", "completed"]).default("waiting"),
  createdAt: z.number(),
  leaderToken: z.string().optional()
});

export type Group = z.infer<typeof groupSchema>;

// Restaurant
export const restaurantSchema = z.object({
  id: z.string(),
  name: z.string(),
  cuisine: z.enum(cuisineTypes),
  priceRange: z.enum(priceRanges),
  rating: z.number().min(0).max(5),
  reviewCount: z.number(),
  imageUrl: z.string(),
  address: z.string(),
  distance: z.number(),
  dietaryOptions: z.array(z.enum(dietaryRestrictions)).default([]),
  description: z.string(),
  yelpUrl: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  phone: z.string().optional(),
  transactions: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
});

export type Restaurant = z.infer<typeof restaurantSchema>;

// Swipe
export const swipeSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  memberId: z.string(),
  restaurantId: z.string(),
  liked: z.boolean(),
  swipedAt: z.number()
});

export type Swipe = z.infer<typeof swipeSchema>;

// Match (restaurant all members liked)
export const matchSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  restaurantId: z.string(),
  matchedAt: z.number()
});

export type Match = z.infer<typeof matchSchema>;

// Insert schemas
export const insertGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  hostName: z.string().min(1, "Your name is required")
});

export type InsertGroup = z.infer<typeof insertGroupSchema>;

export const joinGroupSchema = z.object({
  code: z.string().length(6, "Code must be 6 characters"),
  memberName: z.string().min(1, "Your name is required")
});

export type JoinGroup = z.infer<typeof joinGroupSchema>;

// Reaction types for live reactions during swiping
export type ReactionType = "fire" | "heart" | "drool" | "thumbsup" | "eyes" | "star";

// WebSocket message types
export type WSMessage = 
  | { type: "member_joined"; member: GroupMember }
  | { type: "member_left"; memberId: string }
  | { type: "member_removed"; memberId: string; memberName: string }
  | { type: "preferences_updated"; preferences: GroupPreferences }
  | { type: "status_changed"; status: Group["status"] }
  | { type: "swipe_made"; memberId: string; restaurantId: string }
  | { type: "match_found"; restaurant: Restaurant }
  | { type: "sync"; group: Group; restaurants: Restaurant[]; matches: Restaurant[] }
  | { type: "nudge"; fromMemberName: string; restaurantName: string; targetMemberIds?: string[] }
  | { type: "member_done_swiping"; memberId: string; memberName: string }
  | { type: "live_reaction"; memberId: string; memberName: string; reaction: ReactionType; restaurantId: string }
  | { type: "all_done_swiping" };

// Export auth models
export * from "./models/auth";

// Export social models (friends, groups, sessions)
export * from "./models/social";
