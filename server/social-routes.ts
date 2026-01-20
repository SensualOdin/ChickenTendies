import type { Express, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { 
  friendships, 
  persistentGroups, 
  diningSessions, 
  sessionSwipes,
  sessionMatches,
  notifications,
  users
} from "@shared/schema";
import { eq, or, and, inArray, desc, sql } from "drizzle-orm";
import { fetchRestaurantsFromYelp } from "./yelp";
import type { GroupPreferences, Restaurant } from "@shared/schema";

function getUserId(req: Request): string {
  return (req.user as any)?.claims?.sub || "";
}

function getUserClaims(req: Request): { sub: string; first_name?: string; last_name?: string; email?: string } {
  return (req.user as any)?.claims || {};
}

const sessionRestaurantCache: Map<string, Restaurant[]> = new Map();

export function registerSocialRoutes(app: Express): void {
  
  app.get("/api/friends", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const friendshipList = await db
        .select()
        .from(friendships)
        .where(
          and(
            or(
              eq(friendships.requesterId, userId),
              eq(friendships.addresseeId, userId)
            ),
            eq(friendships.status, "accepted")
          )
        );
      
      const friendIds = friendshipList.map(f => 
        f.requesterId === userId ? f.addresseeId : f.requesterId
      );
      
      if (friendIds.length === 0) {
        return res.json([]);
      }
      
      const friends = await db
        .select()
        .from(users)
        .where(inArray(users.id, friendIds));
      
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get("/api/friends/requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const requests = await db
        .select({
          friendship: friendships,
          requester: users,
        })
        .from(friendships)
        .innerJoin(users, eq(friendships.requesterId, users.id))
        .where(
          and(
            eq(friendships.addresseeId, userId),
            eq(friendships.status, "pending")
          )
        );
      
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  app.post("/api/friends/request", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (targetUser.id === userId) {
        return res.status(400).json({ message: "Cannot add yourself as a friend" });
      }
      
      const existing = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(
              eq(friendships.requesterId, userId),
              eq(friendships.addresseeId, targetUser.id)
            ),
            and(
              eq(friendships.requesterId, targetUser.id),
              eq(friendships.addresseeId, userId)
            )
          )
        );
      
      if (existing.length > 0) {
        return res.status(400).json({ message: "Friend request already exists" });
      }
      
      const [friendship] = await db
        .insert(friendships)
        .values({
          requesterId: userId,
          addresseeId: targetUser.id,
          status: "pending",
        })
        .returning();
      
      await db.insert(notifications).values({
        userId: targetUser.id,
        type: "friend_request",
        title: "New Friend Request",
        message: `${getUserClaims(req).first_name || "Someone"} wants to be your friend!`,
        data: { friendshipId: friendship.id, requesterId: userId },
      });
      
      res.json(friendship);
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  app.post("/api/friends/:id/accept", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const friendshipId = req.params.id;
      
      const [updated] = await db
        .update(friendships)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(
          and(
            eq(friendships.id, friendshipId),
            eq(friendships.addresseeId, userId),
            eq(friendships.status, "pending")
          )
        )
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Friend request not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      res.status(500).json({ message: "Failed to accept friend request" });
    }
  });

  app.post("/api/friends/:id/decline", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const friendshipId = req.params.id;
      
      const [updated] = await db
        .update(friendships)
        .set({ status: "declined", respondedAt: new Date() })
        .where(
          and(
            eq(friendships.id, friendshipId),
            eq(friendships.addresseeId, userId),
            eq(friendships.status, "pending")
          )
        )
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Friend request not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error declining friend request:", error);
      res.status(500).json({ message: "Failed to decline friend request" });
    }
  });

  app.delete("/api/friends/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const friendId = req.params.id;
      
      await db
        .delete(friendships)
        .where(
          and(
            or(
              and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, friendId)),
              and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, userId))
            ),
            eq(friendships.status, "accepted")
          )
        );
      
      res.json({ message: "Friend removed" });
    } catch (error) {
      console.error("Error removing friend:", error);
      res.status(500).json({ message: "Failed to remove friend" });
    }
  });

  app.get("/api/crews", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const groups = await db
        .select()
        .from(persistentGroups)
        .where(
          or(
            eq(persistentGroups.ownerId, userId),
            sql`${userId} = ANY(${persistentGroups.memberIds})`
          )
        )
        .orderBy(desc(persistentGroups.updatedAt));
      
      res.json(groups);
    } catch (error) {
      console.error("Error fetching crews:", error);
      res.status(500).json({ message: "Failed to fetch crews" });
    }
  });

  app.post("/api/crews", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { name, memberIds } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }
      
      const [group] = await db
        .insert(persistentGroups)
        .values({
          name,
          ownerId: userId,
          memberIds: memberIds || [],
        })
        .returning();
      
      if (memberIds && memberIds.length > 0) {
        for (const memberId of memberIds) {
          await db.insert(notifications).values({
            userId: memberId,
            type: "crew_invite",
            title: "You've been added to a crew!",
            message: `You're now part of "${name}"`,
            data: { groupId: group.id },
          });
        }
      }
      
      res.json(group);
    } catch (error) {
      console.error("Error creating crew:", error);
      res.status(500).json({ message: "Failed to create crew" });
    }
  });

  app.get("/api/crews/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const groupId = req.params.id;
      
      const [group] = await db
        .select()
        .from(persistentGroups)
        .where(eq(persistentGroups.id, groupId));
      
      if (!group) {
        return res.status(404).json({ message: "Crew not found" });
      }
      
      const allMemberIds = [group.ownerId, ...group.memberIds];
      const members = await db
        .select()
        .from(users)
        .where(inArray(users.id, allMemberIds));
      
      res.json({ ...group, members });
    } catch (error) {
      console.error("Error fetching crew:", error);
      res.status(500).json({ message: "Failed to fetch crew" });
    }
  });

  app.post("/api/crews/:id/members", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const groupId = req.params.id;
      const { memberId } = req.body;
      
      const [group] = await db
        .select()
        .from(persistentGroups)
        .where(eq(persistentGroups.id, groupId));
      
      if (!group) {
        return res.status(404).json({ message: "Crew not found" });
      }
      
      if (group.ownerId !== userId) {
        return res.status(403).json({ message: "Only the owner can add members" });
      }
      
      if (group.memberIds.includes(memberId)) {
        return res.status(400).json({ message: "Member already in crew" });
      }
      
      const [updated] = await db
        .update(persistentGroups)
        .set({ 
          memberIds: [...group.memberIds, memberId],
          updatedAt: new Date()
        })
        .where(eq(persistentGroups.id, groupId))
        .returning();
      
      await db.insert(notifications).values({
        userId: memberId,
        type: "crew_invite",
        title: "You've been added to a crew!",
        message: `You're now part of "${group.name}"`,
        data: { groupId: group.id },
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error adding member to crew:", error);
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  app.delete("/api/crews/:id/members/:memberId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id: groupId, memberId } = req.params;
      
      const [group] = await db
        .select()
        .from(persistentGroups)
        .where(eq(persistentGroups.id, groupId));
      
      if (!group) {
        return res.status(404).json({ message: "Crew not found" });
      }
      
      if (group.ownerId !== userId && memberId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const [updated] = await db
        .update(persistentGroups)
        .set({ 
          memberIds: group.memberIds.filter(id => id !== memberId),
          updatedAt: new Date()
        })
        .where(eq(persistentGroups.id, groupId))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error removing member from crew:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.get("/api/crews/:id/sessions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const groupId = req.params.id;
      
      const sessions = await db
        .select()
        .from(diningSessions)
        .where(eq(diningSessions.groupId, groupId))
        .orderBy(desc(diningSessions.startedAt));
      
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.post("/api/crews/:id/sessions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const groupId = req.params.id;
      const { preferences } = req.body;
      
      const [group] = await db
        .select()
        .from(persistentGroups)
        .where(eq(persistentGroups.id, groupId));
      
      if (!group) {
        return res.status(404).json({ message: "Crew not found" });
      }
      
      const [session] = await db
        .insert(diningSessions)
        .values({
          groupId,
          createdById: userId,
          preferences,
          status: "active",
        })
        .returning();
      
      const memberIds = [group.ownerId, ...group.memberIds].filter(id => id !== userId);
      for (const memberId of memberIds) {
        await db.insert(notifications).values({
          userId: memberId,
          type: "session_started",
          title: "New dining session!",
          message: `Someone started a new session in "${group.name}" - join the hunt!`,
          data: { sessionId: session.id, groupId: group.id },
        });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id;
      
      const [session] = await db
        .select()
        .from(diningSessions)
        .where(eq(diningSessions.id, sessionId));
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const [group] = await db
        .select()
        .from(persistentGroups)
        .where(eq(persistentGroups.id, session.groupId));
      
      res.json({ session, group });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.get("/api/sessions/:id/restaurants", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id;
      
      let restaurants = sessionRestaurantCache.get(sessionId);
      
      if (!restaurants) {
        const [session] = await db
          .select()
          .from(diningSessions)
          .where(eq(diningSessions.id, sessionId));
        
        if (!session || !session.preferences) {
          return res.status(404).json({ message: "Session not found or no preferences set" });
        }
        
        restaurants = await fetchRestaurantsFromYelp(session.preferences as GroupPreferences);
        
        if (restaurants.length > 0) {
          sessionRestaurantCache.set(sessionId, restaurants);
        }
      }
      
      res.json(restaurants);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  });

  app.post("/api/sessions/:id/swipe", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const sessionId = req.params.id;
      const { restaurantId, liked, restaurantData } = req.body;
      
      const [swipe] = await db
        .insert(sessionSwipes)
        .values({
          sessionId,
          userId,
          restaurantId,
          liked,
        })
        .returning();
      
      if (liked) {
        const [session] = await db
          .select()
          .from(diningSessions)
          .where(eq(diningSessions.id, sessionId));
        
        if (session) {
          const [group] = await db
            .select()
            .from(persistentGroups)
            .where(eq(persistentGroups.id, session.groupId));
          
          if (group) {
            const allMemberIds = [group.ownerId, ...group.memberIds];
            
            const likesForRestaurant = await db
              .select()
              .from(sessionSwipes)
              .where(
                and(
                  eq(sessionSwipes.sessionId, sessionId),
                  eq(sessionSwipes.restaurantId, restaurantId),
                  eq(sessionSwipes.liked, true)
                )
              );
            
            const likedByUsers = new Set(likesForRestaurant.map(s => s.userId));
            if (allMemberIds.every(id => likedByUsers.has(id))) {
              const existingMatch = await db
                .select()
                .from(sessionMatches)
                .where(
                  and(
                    eq(sessionMatches.sessionId, sessionId),
                    eq(sessionMatches.restaurantId, restaurantId)
                  )
                );
              
              if (existingMatch.length === 0) {
                await db.insert(sessionMatches).values({
                  sessionId,
                  restaurantId,
                  restaurantData: restaurantData || null,
                });
              }
            }
          }
        }
      }
      
      res.json(swipe);
    } catch (error) {
      console.error("Error recording swipe:", error);
      res.status(500).json({ message: "Failed to record swipe" });
    }
  });

  app.get("/api/sessions/:id/swipes", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id;
      
      const swipes = await db
        .select()
        .from(sessionSwipes)
        .where(eq(sessionSwipes.sessionId, sessionId));
      
      res.json(swipes);
    } catch (error) {
      console.error("Error fetching swipes:", error);
      res.status(500).json({ message: "Failed to fetch swipes" });
    }
  });

  app.get("/api/sessions/:id/matches", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id;
      
      const matches = await db
        .select()
        .from(sessionMatches)
        .where(eq(sessionMatches.sessionId, sessionId))
        .orderBy(desc(sessionMatches.matchedAt));
      
      res.json(matches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      
      res.json(userNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const notificationId = req.params.id;
      
      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        );
      
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, userId));
      
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to update notifications" });
    }
  });
}
