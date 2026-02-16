import { randomUUID } from "crypto";
import type { 
  Group, 
  GroupMember, 
  GroupPreferences, 
  Restaurant, 
  Swipe,
  InsertGroup,
  JoinGroup 
} from "@shared/schema";
import { anonymousGroups, anonymousGroupSwipes, restaurantCache } from "@shared/schema";
import { fetchRestaurantsFromYelp } from "./yelp";
import { findUnanimousMatches } from "./match-logic";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface IStorage {
  createGroup(data: InsertGroup): Promise<{ group: Group; memberId: string }>;
  joinGroup(data: JoinGroup): Promise<{ group: Group; memberId: string } | null>;
  getGroup(id: string): Promise<Group | undefined>;
  getGroupByCode(code: string): Promise<Group | undefined>;
  updateGroup(groupId: string, group: Group): Promise<Group | undefined>;
  updateGroupPreferences(groupId: string, preferences: GroupPreferences): Promise<Group | undefined>;
  updateGroupStatus(groupId: string, status: Group["status"]): Promise<Group | undefined>;
  addMember(groupId: string, member: GroupMember): Promise<Group | undefined>;
  removeMember(groupId: string, memberId: string): Promise<Group | undefined>;
  getRestaurantsForGroup(groupId: string): Promise<Restaurant[]>;
  loadMoreRestaurants(groupId: string): Promise<Restaurant[]>;
  recordSwipe(groupId: string, memberId: string, restaurantId: string, liked: boolean): Promise<Swipe>;
  getSwipesForGroup(groupId: string): Promise<Swipe[]>;
  getMatchesForGroup(groupId: string): Promise<Restaurant[]>;
  getMembersWhoHaventSwiped(groupId: string, restaurantId: string): Promise<GroupMember[]>;
  markMemberDoneSwiping(groupId: string, memberId: string): Promise<{ group: Group; member: GroupMember } | undefined>;
  deleteSwipe(groupId: string, memberId: string, restaurantId: string): Promise<void>;
}

const mockRestaurants: Restaurant[] = [
  {
    id: "r1",
    name: "Bella Italia",
    cuisine: "Italian",
    priceRange: "$$",
    rating: 4.5,
    reviewCount: 324,
    imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop",
    address: "123 Main St",
    distance: 0.8,
    dietaryOptions: ["vegetarian"],
    description: "Authentic Italian cuisine with homemade pasta, wood-fired pizzas, and an extensive wine selection in a cozy atmosphere.",
    transactions: ["delivery", "pickup"],
    highlights: ["Date Night", "Italian Cuisine"]
  },
  {
    id: "r2",
    name: "Tokyo Garden",
    cuisine: "Japanese",
    priceRange: "$$$",
    rating: 4.7,
    reviewCount: 512,
    imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=600&fit=crop",
    address: "456 Oak Ave",
    distance: 1.2,
    dietaryOptions: ["gluten-free", "pescatarian"],
    description: "Premium sushi and traditional Japanese dishes crafted by master chefs using the freshest ingredients flown in daily.",
    transactions: ["delivery", "pickup"],
    highlights: ["Date Night", "Japanese Cuisine"]
  },
  {
    id: "r3",
    name: "El Mariachi",
    cuisine: "Mexican",
    priceRange: "$",
    rating: 4.3,
    reviewCount: 287,
    imageUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=600&fit=crop",
    address: "789 Elm St",
    distance: 0.5,
    dietaryOptions: ["vegetarian", "vegan"],
    description: "Vibrant Mexican cantina serving authentic street tacos, fresh guacamole, and the best margaritas in town.",
    transactions: ["delivery", "pickup"],
    highlights: ["Casual Eats", "Mexican Cuisine"]
  },
  {
    id: "r4",
    name: "The Grill House",
    cuisine: "Steakhouse",
    priceRange: "$$$$",
    rating: 4.8,
    reviewCount: 456,
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop",
    address: "321 Pine Rd",
    distance: 2.1,
    dietaryOptions: [],
    description: "Prime cuts of aged beef, classic steakhouse sides, and an award-winning wine cellar in an upscale setting.",
    transactions: ["pickup"],
    highlights: ["Date Night", "Highly Rated"]
  },
  {
    id: "r5",
    name: "Spice Route",
    cuisine: "Indian",
    priceRange: "$$",
    rating: 4.4,
    reviewCount: 198,
    imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop",
    address: "555 Spice Ln",
    distance: 1.5,
    dietaryOptions: ["vegetarian", "vegan", "gluten-free"],
    description: "A culinary journey through India with aromatic curries, fresh naan bread, and authentic regional specialties.",
    transactions: ["delivery", "pickup"],
    highlights: ["Indian Cuisine", "Casual Eats"]
  },
  {
    id: "r6",
    name: "Golden Dragon",
    cuisine: "Chinese",
    priceRange: "$$",
    rating: 4.2,
    reviewCount: 345,
    imageUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&h=600&fit=crop",
    address: "888 Dragon Way",
    distance: 0.9,
    dietaryOptions: ["vegetarian"],
    description: "Traditional Cantonese and Szechuan dishes featuring dim sum, hand-pulled noodles, and Peking duck.",
    transactions: ["delivery", "pickup"],
    highlights: ["Chinese Cuisine", "Casual Eats"]
  },
  {
    id: "r7",
    name: "Mediterranean Breeze",
    cuisine: "Mediterranean",
    priceRange: "$$",
    rating: 4.6,
    reviewCount: 267,
    imageUrl: "https://images.unsplash.com/photo-1544124065-6e44b000ca18?w=800&h=600&fit=crop",
    address: "222 Olive St",
    distance: 1.8,
    dietaryOptions: ["vegetarian", "gluten-free"],
    description: "Fresh Mediterranean flavors with grilled meats, falafel, hummus, and vibrant salads in a casual setting.",
    transactions: ["delivery", "pickup"],
    highlights: ["Mediterranean Cuisine", "Brunch Spot"]
  },
  {
    id: "r8",
    name: "Bangkok Street",
    cuisine: "Thai",
    priceRange: "$",
    rating: 4.4,
    reviewCount: 178,
    imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&h=600&fit=crop",
    address: "444 Thai Ave",
    distance: 1.1,
    dietaryOptions: ["vegetarian", "vegan"],
    description: "Authentic Thai street food experience with pad thai, green curry, and refreshing Thai iced tea.",
    transactions: ["delivery", "pickup"],
    highlights: ["Thai Cuisine", "Casual Eats"]
  },
  {
    id: "r9",
    name: "Seoul Kitchen",
    cuisine: "Korean",
    priceRange: "$$",
    rating: 4.5,
    reviewCount: 234,
    imageUrl: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=600&fit=crop",
    address: "777 Seoul Blvd",
    distance: 2.3,
    dietaryOptions: ["gluten-free"],
    description: "Korean BBQ at your table with premium marinated meats, banchan, and traditional Korean dishes.",
    transactions: ["pickup"],
    highlights: ["Korean Cuisine", "Date Night"]
  },
  {
    id: "r10",
    name: "Burger Barn",
    cuisine: "Burger",
    priceRange: "$",
    rating: 4.3,
    reviewCount: 567,
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop",
    address: "111 Burger Ln",
    distance: 0.4,
    dietaryOptions: ["vegetarian"],
    description: "Gourmet burgers with locally sourced beef, creative toppings, hand-cut fries, and craft milkshakes.",
    transactions: ["delivery", "pickup"],
    highlights: ["Casual Eats", "Quick Bites"]
  },
  {
    id: "r11",
    name: "Pizzeria Napoli",
    cuisine: "Pizza",
    priceRange: "$$",
    rating: 4.6,
    reviewCount: 423,
    imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=600&fit=crop",
    address: "333 Pizza Way",
    distance: 0.7,
    dietaryOptions: ["vegetarian"],
    description: "Neapolitan-style pizzas baked in a wood-fired oven with imported Italian ingredients and fresh toppings.",
    transactions: ["delivery", "pickup"],
    highlights: ["Italian Cuisine", "Casual Eats"]
  },
  {
    id: "r12",
    name: "Ocean Catch",
    cuisine: "Seafood",
    priceRange: "$$$",
    rating: 4.7,
    reviewCount: 289,
    imageUrl: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop",
    address: "999 Harbor Dr",
    distance: 3.2,
    dietaryOptions: ["gluten-free", "pescatarian"],
    description: "Fresh catches of the day, raw bar, lobster rolls, and seafood platters with stunning waterfront views.",
    transactions: ["pickup"],
    highlights: ["Seafood", "Date Night", "Highly Rated"]
  }
];

function dbRowToGroup(row: typeof anonymousGroups.$inferSelect): Group {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    members: (row.members as GroupMember[]) || [],
    preferences: (row.preferences as GroupPreferences) || null,
    status: row.status as Group["status"],
    createdAt: row.createdAt ? row.createdAt.getTime() : Date.now(),
    leaderToken: row.leaderToken || undefined,
  };
}

export class DbStorage implements IStorage {
  private pendingRestaurantFetch: Map<string, Promise<Restaurant[]>>;

  constructor() {
    this.pendingRestaurantFetch = new Map();
  }

  async createGroup(data: InsertGroup): Promise<{ group: Group; memberId: string }> {
    const id = randomUUID();
    const memberId = randomUUID();
    const code = generateCode();
    const leaderToken = randomUUID();

    const host: GroupMember = {
      id: memberId,
      name: data.hostName,
      isHost: true,
      joinedAt: Date.now(),
      doneSwiping: false
    };

    const [row] = await db.insert(anonymousGroups).values({
      id,
      code,
      name: data.name,
      members: [host],
      preferences: null,
      status: "waiting",
      leaderToken,
    }).returning();

    const group = dbRowToGroup(row);
    return { group, memberId };
  }

  async joinGroup(data: JoinGroup): Promise<{ group: Group; memberId: string } | null> {
    const group = await this.getGroupByCode(data.code);
    if (!group) return null;

    const memberId = randomUUID();
    const member: GroupMember = {
      id: memberId,
      name: data.memberName,
      isHost: false,
      joinedAt: Date.now(),
      doneSwiping: false
    };

    const updatedMembers = [...group.members, member];
    await db.update(anonymousGroups)
      .set({ members: updatedMembers })
      .where(eq(anonymousGroups.id, group.id));

    group.members = updatedMembers;
    return { group, memberId };
  }

  async getGroup(id: string): Promise<Group | undefined> {
    const [row] = await db.select().from(anonymousGroups).where(eq(anonymousGroups.id, id));
    if (!row) return undefined;
    return dbRowToGroup(row);
  }

  async getGroupByCode(code: string): Promise<Group | undefined> {
    const [row] = await db.select().from(anonymousGroups)
      .where(eq(anonymousGroups.code, code.toUpperCase()));
    if (!row) return undefined;
    return dbRowToGroup(row);
  }

  async updateGroup(groupId: string, updatedGroup: Group): Promise<Group | undefined> {
    const [row] = await db.update(anonymousGroups)
      .set({
        name: updatedGroup.name,
        members: updatedGroup.members,
        preferences: updatedGroup.preferences,
        status: updatedGroup.status,
        leaderToken: updatedGroup.leaderToken,
      })
      .where(eq(anonymousGroups.id, groupId))
      .returning();
    if (!row) return undefined;
    return dbRowToGroup(row);
  }

  async updateGroupPreferences(groupId: string, preferences: GroupPreferences): Promise<Group | undefined> {
    const [row] = await db.update(anonymousGroups)
      .set({ preferences, status: "swiping" })
      .where(eq(anonymousGroups.id, groupId))
      .returning();
    if (!row) return undefined;
    return dbRowToGroup(row);
  }

  async updateGroupStatus(groupId: string, status: Group["status"]): Promise<Group | undefined> {
    const existing = await this.getGroup(groupId);
    if (!existing) return undefined;

    const updates: Record<string, unknown> = { status };

    if (status === "swiping") {
      updates.members = existing.members.map(m => ({ ...m, doneSwiping: false }));
      await db.delete(restaurantCache).where(eq(restaurantCache.groupId, groupId));
      await db.delete(anonymousGroupSwipes).where(eq(anonymousGroupSwipes.groupId, groupId));
      this.pendingRestaurantFetch.delete(groupId);
    }

    const [row] = await db.update(anonymousGroups)
      .set(updates)
      .where(eq(anonymousGroups.id, groupId))
      .returning();
    if (!row) return undefined;
    return dbRowToGroup(row);
  }

  async addMember(groupId: string, member: GroupMember): Promise<Group | undefined> {
    const group = await this.getGroup(groupId);
    if (!group) return undefined;

    const updatedMembers = [...group.members, member];
    const [row] = await db.update(anonymousGroups)
      .set({ members: updatedMembers })
      .where(eq(anonymousGroups.id, groupId))
      .returning();
    if (!row) return undefined;
    return dbRowToGroup(row);
  }

  async removeMember(groupId: string, memberId: string): Promise<Group | undefined> {
    const group = await this.getGroup(groupId);
    if (!group) return undefined;

    const updatedMembers = group.members.filter(m => m.id !== memberId);
    const [row] = await db.update(anonymousGroups)
      .set({ members: updatedMembers })
      .where(eq(anonymousGroups.id, groupId))
      .returning();
    if (!row) return undefined;
    return dbRowToGroup(row);
  }

  async getRestaurantsForGroup(groupId: string): Promise<Restaurant[]> {
    const group = await this.getGroup(groupId);
    if (!group || !group.preferences) return mockRestaurants;

    const [cached] = await db.select().from(restaurantCache)
      .where(eq(restaurantCache.groupId, groupId));
    if (cached && Array.isArray(cached.restaurants) && (cached.restaurants as Restaurant[]).length > 0) {
      return cached.restaurants as Restaurant[];
    }

    const pendingFetch = this.pendingRestaurantFetch.get(groupId);
    if (pendingFetch) {
      return pendingFetch;
    }

    const fetchPromise = this.fetchAndCacheRestaurants(groupId, group);
    this.pendingRestaurantFetch.set(groupId, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.pendingRestaurantFetch.delete(groupId);
    }
  }

  private async fetchAndCacheRestaurants(groupId: string, group: Group): Promise<Restaurant[]> {
    try {
      const yelpRestaurants = await fetchRestaurantsFromYelp(group.preferences!);
      
      if (yelpRestaurants.length > 0) {
        await this.cacheRestaurants(groupId, yelpRestaurants);
        return yelpRestaurants;
      }
    } catch (error) {
      console.error("Error fetching from Yelp:", error);
    }

    let filtered = [...mockRestaurants];

    if (group.preferences!.priceRange.length > 0) {
      filtered = filtered.filter(r => group.preferences!.priceRange.includes(r.priceRange));
    }

    if (group.preferences!.cuisineTypes.length > 0) {
      filtered = filtered.filter(r => group.preferences!.cuisineTypes.includes(r.cuisine));
    }

    filtered = filtered.filter(r => r.distance <= group.preferences!.radius);

    const result = filtered.length > 0 ? filtered : mockRestaurants;
    await this.cacheRestaurants(groupId, result);
    return result;
  }

  private async cacheRestaurants(groupId: string, restaurants: Restaurant[]): Promise<void> {
    const [existing] = await db.select().from(restaurantCache)
      .where(eq(restaurantCache.groupId, groupId));

    if (existing) {
      await db.update(restaurantCache)
        .set({ restaurants })
        .where(eq(restaurantCache.groupId, groupId));
    } else {
      await db.insert(restaurantCache).values({ groupId, restaurants });
    }
  }

  async loadMoreRestaurants(groupId: string): Promise<Restaurant[]> {
    const group = await this.getGroup(groupId);
    if (!group || !group.preferences) return [];

    const [cached] = await db.select().from(restaurantCache)
      .where(eq(restaurantCache.groupId, groupId));
    const existingRestaurants = (cached?.restaurants as Restaurant[]) || [];
    const existingIds = new Set(existingRestaurants.map(r => r.id));
    
    const newOffset = existingRestaurants.length;
    
    try {
      const yelpRestaurants = await fetchRestaurantsFromYelp(group.preferences, newOffset);
      
      const newRestaurants = yelpRestaurants.filter(r => !existingIds.has(r.id));
      
      if (newRestaurants.length > 0) {
        const combined = [...existingRestaurants, ...newRestaurants];
        await this.cacheRestaurants(groupId, combined);
        return combined;
      }
    } catch (error) {
      console.error("Error loading more restaurants from Yelp:", error);
    }

    return existingRestaurants;
  }

  async recordSwipe(groupId: string, memberId: string, restaurantId: string, liked: boolean): Promise<Swipe> {
    const swipeId = randomUUID();

    const [result] = await db.insert(anonymousGroupSwipes).values({
      id: swipeId,
      groupId,
      memberId,
      restaurantId,
      liked,
    }).onConflictDoNothing().returning();

    if (!result) {
      // Duplicate swipe — return existing data
      return { id: "duplicate", groupId, memberId, restaurantId, liked, swipedAt: Date.now() };
    }

    return {
      id: result.id,
      groupId: result.groupId,
      memberId: result.memberId,
      restaurantId: result.restaurantId,
      liked: result.liked,
      swipedAt: result.swipedAt ? result.swipedAt.getTime() : Date.now()
    };
  }

  async getSwipesForGroup(groupId: string): Promise<Swipe[]> {
    const rows = await db.select().from(anonymousGroupSwipes)
      .where(eq(anonymousGroupSwipes.groupId, groupId));

    return rows.map(row => ({
      id: row.id,
      groupId: row.groupId,
      memberId: row.memberId,
      restaurantId: row.restaurantId,
      liked: row.liked,
      swipedAt: row.swipedAt ? row.swipedAt.getTime() : Date.now()
    }));
  }

  async getMatchesForGroup(groupId: string): Promise<Restaurant[]> {
    const group = await this.getGroup(groupId);
    if (!group) return [];

    const swipes = await this.getSwipesForGroup(groupId);
    const restaurants = await this.getRestaurantsForGroup(groupId);
    const memberIds = group.members.map(m => m.id);

    return findUnanimousMatches(memberIds, restaurants, swipes);
  }

  async getMembersWhoHaventSwiped(groupId: string, restaurantId: string): Promise<GroupMember[]> {
    const group = await this.getGroup(groupId);
    if (!group) return [];

    const swipes = await this.getSwipesForGroup(groupId);
    const swipedMemberIds = new Set(
      swipes.filter(s => s.restaurantId === restaurantId).map(s => s.memberId)
    );

    return group.members.filter(m => !swipedMemberIds.has(m.id));
  }

  async markMemberDoneSwiping(groupId: string, memberId: string): Promise<{ group: Group; member: GroupMember } | undefined> {
    const group = await this.getGroup(groupId);
    if (!group) return undefined;

    const memberIndex = group.members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) return undefined;

    const updatedMembers = [...group.members];
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      doneSwiping: true
    };

    await db.update(anonymousGroups)
      .set({ members: updatedMembers })
      .where(eq(anonymousGroups.id, groupId));

    return {
      group: { ...group, members: updatedMembers },
      member: updatedMembers[memberIndex]
    };
  }

  async deleteSwipe(groupId: string, memberId: string, restaurantId: string): Promise<void> {
    await db.delete(anonymousGroupSwipes).where(
      and(
        eq(anonymousGroupSwipes.groupId, groupId),
        eq(anonymousGroupSwipes.memberId, memberId),
        eq(anonymousGroupSwipes.restaurantId, restaurantId),
      )
    );
  }
}

export const storage = new DbStorage();
