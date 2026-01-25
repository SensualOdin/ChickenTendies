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
  users,
  pushSubscriptions,
  diningHistory,
  userAchievements,
  achievementTypeEnum
} from "@shared/schema";
import { eq, or, and, inArray, desc, sql } from "drizzle-orm";
import { fetchRestaurantsFromYelp } from "./yelp";
import type { GroupPreferences, Restaurant } from "@shared/schema";
import { notifyUser, notifyUsers } from "./routes";
import { sendPushToUsers, getVapidPublicKey } from "./push";

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
      
      notifyUser(targetUser.id, {
        type: "friend_request",
        message: `${getUserClaims(req).first_name || "Someone"} sent you a friend request!`,
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
      
      const generateInviteCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };
      
      const [group] = await db
        .insert(persistentGroups)
        .values({
          name,
          ownerId: userId,
          memberIds: memberIds || [],
          inviteCode: generateInviteCode(),
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

  app.post("/api/crews/join", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { inviteCode } = req.body;
      
      if (!inviteCode) {
        return res.status(400).json({ message: "Invite code is required" });
      }
      
      const [group] = await db
        .select()
        .from(persistentGroups)
        .where(eq(persistentGroups.inviteCode, inviteCode.toUpperCase().trim()));
      
      if (!group) {
        return res.status(404).json({ message: "Invalid invite code" });
      }
      
      if (group.ownerId === userId) {
        return res.status(400).json({ message: "You're already the owner of this crew" });
      }
      
      if (group.memberIds.includes(userId)) {
        return res.status(400).json({ message: "You're already a member of this crew" });
      }
      
      const [updated] = await db
        .update(persistentGroups)
        .set({
          memberIds: [...group.memberIds, userId],
          updatedAt: new Date(),
        })
        .where(eq(persistentGroups.id, group.id))
        .returning();
      
      await db.insert(notifications).values({
        userId: group.ownerId,
        type: "member_joined",
        title: "New crew member!",
        message: `Someone joined "${group.name}" using the invite code`,
        data: { groupId: group.id, memberId: userId },
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error joining crew:", error);
      res.status(500).json({ message: "Failed to join crew" });
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

  app.delete("/api/crews/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const groupId = req.params.id;
      
      const [group] = await db
        .select()
        .from(persistentGroups)
        .where(eq(persistentGroups.id, groupId));
      
      if (!group) {
        return res.status(404).json({ message: "Crew not found" });
      }
      
      if (group.ownerId !== userId) {
        return res.status(403).json({ message: "Only the owner can delete the crew" });
      }
      
      await db
        .delete(persistentGroups)
        .where(eq(persistentGroups.id, groupId));
      
      res.json({ message: "Crew deleted successfully" });
    } catch (error) {
      console.error("Error deleting crew:", error);
      res.status(500).json({ message: "Failed to delete crew" });
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
      
      notifyUsers(memberIds, {
        type: "session_started",
        message: `A new dining session started in "${group.name}"!`,
        data: { sessionId: session.id, groupId: group.id, groupName: group.name },
      });

      sendPushToUsers(memberIds, {
        title: "New dining session!",
        body: `Someone started a new session in "${group.name}" - join the hunt!`,
        url: "/dashboard",
        data: { sessionId: session.id, groupId: group.id },
      });
      
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

  app.get("/api/crews/:id/visited-restaurants", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const groupId = req.params.id;
      
      const sessions = await db
        .select({
          visitedRestaurantId: diningSessions.visitedRestaurantId,
          visitedRestaurantData: diningSessions.visitedRestaurantData,
          visitedAt: diningSessions.visitedAt,
        })
        .from(diningSessions)
        .where(
          and(
            eq(diningSessions.groupId, groupId),
            sql`${diningSessions.visitedRestaurantId} IS NOT NULL`
          )
        );
      
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching visited restaurants:", error);
      res.status(500).json({ message: "Failed to fetch visited restaurants" });
    }
  });

  app.post("/api/sessions/:id/swipe", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const sessionId = req.params.id;
      const { restaurantId, liked, superLiked = false, restaurantData } = req.body;
      
      const [swipe] = await db
        .insert(sessionSwipes)
        .values({
          sessionId,
          userId,
          restaurantId,
          liked,
          superLiked,
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
            const superLikeCount = likesForRestaurant.filter(s => s.superLiked).length;
            
            const allLiked = allMemberIds.every(id => likedByUsers.has(id));
            const hasSuperLikeBoost = superLikeCount >= 1 && likedByUsers.size >= Math.ceil(allMemberIds.length * 0.6);
            
            if (allLiked || hasSuperLikeBoost) {
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
                
                const restaurantInfo = restaurantData as { name?: string } | null;
                await db.insert(diningHistory).values({
                  groupId: group.id,
                  sessionId,
                  restaurantId,
                  restaurantName: restaurantInfo?.name || "Restaurant",
                  restaurantData,
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

  app.post("/api/sessions/:id/visited", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id;
      const userId = getUserId(req);
      const { restaurantId, restaurantData } = req.body;
      
      if (!restaurantId) {
        return res.status(400).json({ message: "Restaurant ID is required" });
      }
      
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
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const isMember = group.ownerId === userId || group.memberIds.includes(userId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to update this session" });
      }
      
      const [updated] = await db
        .update(diningSessions)
        .set({
          visitedRestaurantId: restaurantId,
          visitedRestaurantData: restaurantData || null,
          visitedAt: new Date(),
        })
        .where(eq(diningSessions.id, sessionId))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error logging restaurant visit:", error);
      res.status(500).json({ message: "Failed to log visit" });
    }
  });

  // Get all visited restaurants for the current user across all their crews
  app.get("/api/sessions/visited-restaurants", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      // Get all crews the user is a member of
      const userCrewMemberships = await db
        .select({ crewId: crewMembers.crewId })
        .from(crewMembers)
        .where(eq(crewMembers.userId, userId));
      
      const crewIds = userCrewMemberships.map(m => m.crewId);
      
      if (crewIds.length === 0) {
        res.json({ restaurantIds: [] });
        return;
      }
      
      // Get all sessions for those crews that have visited restaurants
      const visitedSessions = await db
        .select({
          visitedRestaurantId: diningSessions.visitedRestaurantId,
        })
        .from(diningSessions)
        .where(
          and(
            inArray(diningSessions.crewId, crewIds),
            sql`${diningSessions.visitedRestaurantId} IS NOT NULL`
          )
        );
      
      const restaurantIds = visitedSessions
        .map(s => s.visitedRestaurantId)
        .filter((id): id is string => id !== null);
      
      res.json({ restaurantIds });
    } catch (error) {
      console.error("Error fetching visited restaurants:", error);
      res.status(500).json({ message: "Failed to fetch visited restaurants" });
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

  app.get("/api/push/vapid-key", (req: Request, res: Response) => {
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      return res.status(503).json({ message: "Push notifications not configured" });
    }
    res.json({ publicKey });
  });

  app.post("/api/push/subscribe", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { endpoint, keys } = req.body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }

      await db.delete(pushSubscriptions).where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

      await db.insert(pushSubscriptions).values({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      res.json({ message: "Subscription saved" });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.delete("/api/push/subscribe", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { endpoint } = req.body;

      if (endpoint) {
        await db.delete(pushSubscriptions).where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.endpoint, endpoint)
          )
        );
      } else {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      }

      res.json({ message: "Subscription removed" });
    } catch (error) {
      console.error("Error removing push subscription:", error);
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  app.get("/api/crews/:id/history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const groupId = req.params.id;
      
      const history = await db
        .select()
        .from(diningHistory)
        .where(eq(diningHistory.groupId, groupId))
        .orderBy(desc(diningHistory.visitedAt));
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching dining history:", error);
      res.status(500).json({ message: "Failed to fetch dining history" });
    }
  });

  app.post("/api/crews/:id/history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const groupId = req.params.id;
      const { sessionId, restaurantId, restaurantName, restaurantData, rating, notes } = req.body;
      
      const [entry] = await db
        .insert(diningHistory)
        .values({
          groupId,
          sessionId,
          restaurantId,
          restaurantName,
          restaurantData,
          rating,
          notes,
        })
        .returning();
      
      res.json(entry);
    } catch (error) {
      console.error("Error adding dining history:", error);
      res.status(500).json({ message: "Failed to add dining history" });
    }
  });

  app.get("/api/achievements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const achievements = await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId))
        .orderBy(desc(userAchievements.unlockedAt));
      
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get("/api/achievements/available", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const achievementDefinitions = [
        { type: "first_match", name: "First Match", description: "Find your first restaurant match with a crew", icon: "trophy" },
        { type: "super_liker", name: "Super Liker", description: "Use super like 10 times", icon: "sparkles" },
        { type: "adventurous_eater", name: "Adventurous Eater", description: "Match on 5 different cuisine types", icon: "utensils" },
        { type: "crew_leader", name: "Crew Leader", description: "Create 3 or more crews", icon: "users" },
        { type: "social_butterfly", name: "Social Butterfly", description: "Have 5 or more friends", icon: "heart" },
        { type: "foodie_veteran", name: "Foodie Veteran", description: "Complete 25 dining sessions", icon: "award" },
        { type: "match_maker", name: "Match Maker", description: "Find 10 total matches across all sessions", icon: "flame" },
        { type: "explorer", name: "Explorer", description: "Swipe through 100 restaurants", icon: "map" },
        { type: "sushi_squad", name: "Sushi Squad", description: "Match on 3 sushi or Japanese restaurants", icon: "utensils" },
        { type: "five_star_only", name: "5 Star Only", description: "Match on 5 restaurants rated 4.5 stars or higher", icon: "sparkles" },
        { type: "budget_boss", name: "Budget Boss", description: "Match on 5 budget-friendly ($ price) restaurants", icon: "award" },
        { type: "pizza_pal", name: "Pizza Pal", description: "Match on 3 pizza restaurants", icon: "flame" },
        { type: "taco_tuesday", name: "Taco Tuesday", description: "Match on 3 Mexican restaurants", icon: "utensils" },
      ];
      
      res.json(achievementDefinitions);
    } catch (error) {
      console.error("Error fetching achievement definitions:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get("/api/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const [swipeCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sessionSwipes)
        .where(eq(sessionSwipes.userId, userId));
      
      const [superLikeCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sessionSwipes)
        .where(and(eq(sessionSwipes.userId, userId), eq(sessionSwipes.superLiked, true)));
      
      const userGroups = await db
        .select()
        .from(persistentGroups)
        .where(
          or(
            eq(persistentGroups.ownerId, userId),
            sql`${userId} = ANY(${persistentGroups.memberIds})`
          )
        );
      
      const groupIds = userGroups.map(g => g.id);
      
      let matchCount = 0;
      let historyCount = 0;
      
      if (groupIds.length > 0) {
        const sessions = await db
          .select()
          .from(diningSessions)
          .where(inArray(diningSessions.groupId, groupIds));
        
        const sessionIds = sessions.map(s => s.id);
        
        if (sessionIds.length > 0) {
          const [matches] = await db
            .select({ count: sql<number>`count(*)` })
            .from(sessionMatches)
            .where(inArray(sessionMatches.sessionId, sessionIds));
          matchCount = Number(matches?.count || 0);
        }
        
        const [history] = await db
          .select({ count: sql<number>`count(*)` })
          .from(diningHistory)
          .where(inArray(diningHistory.groupId, groupIds));
        historyCount = Number(history?.count || 0);
      }
      
      const achievementCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId));
      
      res.json({
        totalSwipes: Number(swipeCount?.count || 0),
        superLikes: Number(superLikeCount?.count || 0),
        totalMatches: matchCount,
        placesVisited: historyCount,
        crewCount: userGroups.length,
        achievementCount: Number(achievementCount[0]?.count || 0),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
}
