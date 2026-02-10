import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { insertGroupSchema, joinGroupSchema, groupPreferencesSchema, persistentGroups, diningSessions, users } from "@shared/schema";
import type { WSMessage, Group, Restaurant, GroupMember } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth";
import { registerSocialRoutes } from "./social-routes";
import { sendPushToGroupMembers, saveGroupPushSubscription, getVapidPublicKey } from "./push";
import { logBatchAnalyticsEvents, getAnalyticsSummary, getCuisineDemand, getRestaurantAnalytics } from "./analytics";
import { db } from "./db";
import { eq, and, inArray } from "drizzle-orm";

const sessionUserMap: Map<string, string> = new Map();

interface WSClient {
  ws: WebSocket;
  groupId: string;
  memberId: string;
}

const clients: Map<string, WSClient[]> = new Map();

function broadcast(groupId: string, message: WSMessage, excludeMemberId?: string) {
  const groupClients = clients.get(groupId) || [];
  const data = JSON.stringify(message);
  
  for (const client of groupClients) {
    if (excludeMemberId && client.memberId === excludeMemberId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

export function notifyUser(_userId: string, _notification: { type: string; message: string; data?: any }) {
}

export function notifyUsers(_userIds: string[], _notification: { type: string; message: string; data?: any }) {
}

async function sendSync(ws: WebSocket, groupId: string) {
  const group = await storage.getGroup(groupId);
  if (!group) return;

  const restaurants = await storage.getRestaurantsForGroup(groupId);
  const matches = await storage.getMatchesForGroup(groupId);

  const message: WSMessage = {
    type: "sync",
    group,
    restaurants,
    matches
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication before other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  registerSocialRoutes(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const groupId = url.searchParams.get("groupId");
    const memberId = url.searchParams.get("memberId");

    if (!groupId || !memberId) {
      ws.close();
      return;
    }

    const client: WSClient = { ws, groupId, memberId };
    const groupClients = clients.get(groupId) || [];
    groupClients.push(client);
    clients.set(groupId, groupClients);

    await sendSync(ws, groupId);

    ws.on("close", () => {
      const groupClients = clients.get(groupId) || [];
      const filtered = groupClients.filter(c => c.ws !== ws);
      if (filtered.length > 0) {
        clients.set(groupId, filtered);
      } else {
        clients.delete(groupId);
      }
    });
  });

  app.post("/api/groups", async (req, res) => {
    try {
      const data = insertGroupSchema.parse(req.body);
      const result = await storage.createGroup(data);
      // Return leaderToken separately so client can store it, but strip from group object
      const { leaderToken, ...groupWithoutToken } = result.group;
      res.json({ 
        group: groupWithoutToken, 
        memberId: result.memberId,
        leaderToken 
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/groups/join", async (req, res) => {
    try {
      const data = joinGroupSchema.parse(req.body);
      const result = await storage.joinGroup(data);
      
      if (!result) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      const member = result.group.members.find(m => m.id === result.memberId);
      if (member) {
        broadcast(result.group.id, { type: "member_joined", member }, result.memberId);
      }

      res.json(result);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.get("/api/groups/:id", async (req, res) => {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    // Strip leaderToken from response for security
    const { leaderToken, ...groupWithoutToken } = group;
    res.json(groupWithoutToken);
  });

  app.post("/api/groups/:id/join-session", isAuthenticated, async (req, res) => {
    try {
      const groupId = String(req.params.id);
      const userId = (req.user as any)?.claims?.sub || "";

      const [persistentGroup] = await db
        .select()
        .from(persistentGroups)
        .where(eq(persistentGroups.id, groupId as string));

      if (!persistentGroup) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      const allMemberIds = [persistentGroup.ownerId, ...persistentGroup.memberIds];
      if (!allMemberIds.includes(userId)) {
        res.status(403).json({ error: "You are not a member of this crew" });
        return;
      }

      const sessionResults = await db
        .select()
        .from(diningSessions)
        .where(eq(diningSessions.groupId, groupId as string));
      const activeSession = sessionResults.find(
        s => s.status === "active" || (!s.endedAt && !s.status)
      );

      if (!activeSession) {
        res.status(404).json({ error: "No active session found" });
        return;
      }

      const crewUserIds = [persistentGroup.ownerId, ...persistentGroup.memberIds];
      const crewUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, crewUserIds));
      const userMap = new Map(crewUsers.map(u => [u.id, u]));

      const currentUser = userMap.get(userId);
      const displayName = currentUser
        ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ")
          || currentUser.email?.split("@")[0]
          || "Member"
        : "Member";

      let memGroup = await storage.getGroup(groupId);

      if (!memGroup) {
        const ownerUser = userMap.get(persistentGroup.ownerId);
        const ownerName = ownerUser
          ? [ownerUser.firstName, ownerUser.lastName].filter(Boolean).join(" ")
            || ownerUser.email?.split("@")[0]
            || "Host"
          : "Host";

        const hostMemberId = randomUUID();
        const host: GroupMember = {
          id: hostMemberId,
          name: ownerName,
          isHost: true,
          joinedAt: Date.now(),
          doneSwiping: false,
        };

        memGroup = {
          id: groupId,
          code: persistentGroup.inviteCode,
          name: persistentGroup.name,
          members: [host],
          preferences: activeSession.preferences as any,
          status: "waiting",
          createdAt: Date.now(),
          leaderToken: randomUUID(),
        };
        await storage.updateGroup(groupId, memGroup);

        sessionUserMap.set(`${groupId}:${persistentGroup.ownerId}`, hostMemberId);
      }

      const existingMemberId = sessionUserMap.get(`${groupId}:${userId}`);
      if (existingMemberId) {
        const existingMember = memGroup.members.find(m => m.id === existingMemberId);
        if (existingMember) {
          res.json({ memberId: existingMemberId, group: memGroup });
          return;
        }
      }

      const memberId = randomUUID();
      const newMember: GroupMember = {
        id: memberId,
        name: displayName,
        isHost: false,
        joinedAt: Date.now(),
        doneSwiping: false,
      };

      memGroup.members.push(newMember);
      await storage.updateGroup(groupId, memGroup);
      sessionUserMap.set(`${groupId}:${userId}`, memberId);

      broadcast(groupId, { type: "member_joined", member: newMember }, memberId);

      res.json({ memberId, group: memGroup });
    } catch (error) {
      console.error("Error joining session:", error);
      res.status(500).json({ error: "Failed to join session" });
    }
  });

  // Reclaim leadership using stored leader token
  app.post("/api/groups/:id/reclaim-leadership", async (req, res) => {
    try {
      const { leaderToken, memberName } = req.body;
      
      if (!leaderToken || typeof leaderToken !== 'string') {
        res.status(400).json({ error: "Leader token required" });
        return;
      }
      
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }
      
      // Verify the token matches
      if (group.leaderToken !== leaderToken) {
        res.status(403).json({ error: "Invalid leader token" });
        return;
      }
      
      // Find the current host
      const currentHost = group.members.find(m => m.isHost);
      
      // Check if the leader is already in the group
      const existingMember = currentHost && currentHost.name === (memberName || currentHost.name) 
        ? currentHost 
        : null;
      
      if (existingMember) {
        // Leader is still in the group, just return their memberId
        const { leaderToken: _, ...groupWithoutToken } = group;
        res.json({ group: groupWithoutToken, memberId: existingMember.id, rejoined: true });
        return;
      }
      
      // Leader left and needs to rejoin - create new member with host privileges
      const memberId = randomUUID();
      const newHost: GroupMember = {
        id: memberId,
        name: memberName || "Leader",
        isHost: true,
        joinedAt: Date.now(),
        doneSwiping: false
      };
      
      // Demote old host if exists
      const updatedMembers = group.members.map(m => ({ ...m, isHost: false }));
      updatedMembers.push(newHost);
      
      const updatedGroup = { ...group, members: updatedMembers };
      await storage.updateGroup(req.params.id, updatedGroup);
      
      // Broadcast member joined
      broadcast(req.params.id, { type: "member_joined", member: newHost }, memberId);
      
      const { leaderToken: _, ...groupWithoutToken } = updatedGroup;
      res.json({ group: groupWithoutToken, memberId, rejoined: false });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Start swiping session - sets preferences and changes status to swiping
  app.post("/api/groups/:id/start-session", async (req, res) => {
    try {
      const { hostMemberId, preferences } = req.body;
      
      // Validate preferences
      const validatedPreferences = groupPreferencesSchema.parse(preferences);
      
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      // Verify the requester is the host
      const hostMember = group.members.find(m => m.id === hostMemberId && m.isHost);
      if (!hostMember) {
        res.status(403).json({ error: "Only the host can start the session" });
        return;
      }
      
      const updatedGroup = await storage.updateGroupPreferences(req.params.id, validatedPreferences);
      if (!updatedGroup) {
        res.status(500).json({ error: "Failed to update preferences" });
        return;
      }
      
      // Update status to swiping
      await storage.updateGroupStatus(req.params.id, "swiping");

      broadcast(req.params.id, { type: "preferences_updated", preferences: validatedPreferences });
      broadcast(req.params.id, { type: "status_changed", status: "swiping" });

      res.json(updatedGroup);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.get("/api/groups/:id/restaurants", async (req, res) => {
    const restaurants = await storage.getRestaurantsForGroup(req.params.id);
    res.json(restaurants);
  });

  app.post("/api/groups/:id/restaurants/load-more", async (req, res) => {
    const restaurants = await storage.loadMoreRestaurants(req.params.id);
    const group = await storage.getGroup(req.params.id);
    const matches = await storage.getMatchesForGroup(req.params.id);
    
    if (group) {
      broadcast(req.params.id, {
        type: "sync",
        group,
        restaurants,
        matches,
      });
    }
    
    res.json(restaurants);
  });

  app.post("/api/groups/:id/swipe", async (req, res) => {
    try {
      const { restaurantId, liked, memberId, superLiked } = req.body;
      
      if (!restaurantId || typeof liked !== "boolean" || !memberId) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }

      const swipe = await storage.recordSwipe(req.params.id, memberId, restaurantId, liked);
      
      broadcast(req.params.id, { 
        type: "swipe_made", 
        memberId, 
        restaurantId 
      }, memberId);

      if (liked) {
        const matches = await storage.getMatchesForGroup(req.params.id);
        const matchedRestaurant = matches.find(r => r.id === restaurantId);
        
        if (matchedRestaurant) {
          broadcast(req.params.id, { 
            type: "match_found", 
            restaurant: matchedRestaurant 
          });
        }
      }

      res.json(swipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.get("/api/groups/:id/matches", async (req, res) => {
    const matches = await storage.getMatchesForGroup(req.params.id);
    res.json(matches);
  });

  // Nudge members who haven't swiped yet
  app.post("/api/groups/:id/nudge", async (req, res) => {
    const { restaurantId, fromMemberId } = req.body;
    
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const fromMember = group.members.find(m => m.id === fromMemberId);
    const restaurants = await storage.getRestaurantsForGroup(req.params.id);
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!fromMember || !restaurant) {
      res.status(400).json({ error: "Invalid member or restaurant" });
      return;
    }

    const membersToNudge = await storage.getMembersWhoHaventSwiped(req.params.id, restaurantId);
    const nudgeTargets = membersToNudge.filter(m => m.id !== fromMemberId);
    
    // Send nudge to all members who haven't swiped (except the sender)
    const nudgeMessage = {
      type: "nudge" as const,
      fromMemberName: fromMember.name,
      restaurantName: restaurant.name,
      targetMemberIds: nudgeTargets.map(m => m.id),
    };

    broadcast(req.params.id, nudgeMessage, fromMemberId);

    res.json({ 
      success: true, 
      nudgedCount: nudgeTargets.length 
    });
  });

  // Mark member as done swiping
  const doneSwipingSchema = z.object({
    memberId: z.string().min(1)
  });

  app.post("/api/groups/:id/done-swiping", async (req, res) => {
    try {
      const { memberId } = doneSwipingSchema.parse(req.body);
      
      const result = await storage.markMemberDoneSwiping(req.params.id, memberId);
      if (!result) {
        res.status(404).json({ error: "Group or member not found" });
        return;
      }

      broadcast(req.params.id, { 
        type: "member_done_swiping", 
        memberId: result.member.id,
        memberName: result.member.name
      });

      // Check if ALL members are now done swiping
      const allDone = result.group.members.every(m => m.doneSwiping);
      if (allDone && result.group.members.length > 0) {
        // Send push notification to all group members
        sendPushToGroupMembers(req.params.id, {
          title: "Everyone's done swiping!",
          body: `Your group "${result.group.name}" has finished swiping. Check out your matches!`,
          url: `/group/${req.params.id}/matches`,
          data: { groupId: req.params.id, type: "all_done_swiping" }
        });
        
        // Also broadcast via WebSocket for users who are still on the page
        broadcast(req.params.id, { type: "all_done_swiping" });
      }

      res.json({ success: true, group: result.group });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });
  
  // Group push notification subscription endpoints
  app.get("/api/groups/:id/push/vapid-key", (req, res) => {
    const vapidKey = getVapidPublicKey();
    if (!vapidKey) {
      res.status(500).json({ error: "VAPID keys not configured" });
      return;
    }
    res.json({ vapidKey });
  });
  
  const groupPushSubscribeSchema = z.object({
    memberId: z.string(),
    subscription: z.object({
      endpoint: z.string(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string()
      })
    })
  });
  
  app.post("/api/groups/:id/push/subscribe", async (req, res) => {
    try {
      const { memberId, subscription } = groupPushSubscribeSchema.parse(req.body);
      const groupId = req.params.id;
      
      // Verify group exists
      const group = await storage.getGroup(groupId);
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }
      
      // Verify member is in the group
      const member = group.members.find(m => m.id === memberId);
      if (!member) {
        res.status(403).json({ error: "Member not in group" });
        return;
      }
      
      await saveGroupPushSubscription(groupId, memberId, subscription);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid subscription data" });
    }
  });

  // Send a live reaction during swiping
  const reactionSchema = z.object({
    memberId: z.string(),
    memberName: z.string(),
    reaction: z.enum(["fire", "heart", "drool", "thumbsup", "eyes", "star"]),
    restaurantId: z.string(),
  });

  app.post("/api/groups/:id/reaction", async (req, res) => {
    try {
      const parsed = reactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid reaction data" });
        return;
      }
      
      const { memberId, memberName, reaction, restaurantId } = parsed.data;
      
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      // Verify member is in the group
      const member = group.members.find(m => m.id === memberId);
      if (!member) {
        res.status(403).json({ error: "Member not in group" });
        return;
      }

      broadcast(req.params.id, {
        type: "live_reaction",
        memberId,
        memberName: member.name,
        reaction,
        restaurantId
      });

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Remove a member from the group (host only)
  app.delete("/api/groups/:id/members/:memberId", async (req, res) => {
    const { id: groupId, memberId: targetMemberId } = req.params;
    const { hostMemberId } = req.body;

    const group = await storage.getGroup(groupId);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    // Verify the requester is the host
    const hostMember = group.members.find(m => m.id === hostMemberId && m.isHost);
    if (!hostMember) {
      res.status(403).json({ error: "Only the host can remove members" });
      return;
    }

    // Can't remove the host
    const targetMember = group.members.find(m => m.id === targetMemberId);
    if (!targetMember) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (targetMember.isHost) {
      res.status(400).json({ error: "Cannot remove the host" });
      return;
    }

    const updatedGroup = await storage.removeMember(groupId, targetMemberId);
    
    // Broadcast to all members including the one being removed
    broadcast(groupId, { 
      type: "member_removed", 
      memberId: targetMemberId,
      memberName: targetMember.name
    });

    res.json({ success: true, group: updatedGroup });
  });

  // Update group preferences (host only, outside of session start)
  app.patch("/api/groups/:id/preferences", async (req, res) => {
    try {
      const { hostMemberId, preferences } = req.body;
      
      // Validate preferences
      const validatedPreferences = groupPreferencesSchema.parse(preferences);
      
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      // Verify the requester is the host
      const hostMember = group.members.find(m => m.id === hostMemberId && m.isHost);
      if (!hostMember) {
        res.status(403).json({ error: "Only the host can update preferences" });
        return;
      }

      const updatedGroup = await storage.updateGroupPreferences(req.params.id, validatedPreferences);
      if (!updatedGroup) {
        res.status(500).json({ error: "Failed to update preferences" });
        return;
      }

      broadcast(req.params.id, { type: "preferences_updated", preferences: validatedPreferences });

      res.json({ success: true, group: updatedGroup });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/analytics/events", async (req, res) => {
    try {
      const { events } = req.body;
      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ error: "Events array required" });
        return;
      }
      if (events.length > 50) {
        res.status(400).json({ error: "Max 50 events per batch" });
        return;
      }
      await logBatchAnalyticsEvents(events);
      res.json({ success: true, count: events.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to log events" });
    }
  });

  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const summary = await getAnalyticsSummary(Math.min(days, 365));
      res.json(summary);
    } catch (error) {
      console.error("[Analytics] Summary error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/demand", async (req, res) => {
    try {
      const { cuisine, latMin, latMax, lngMin, lngMax } = req.query;
      if (!cuisine || typeof cuisine !== "string") {
        res.status(400).json({ error: "cuisine query parameter required" });
        return;
      }
      const demand = await getCuisineDemand(
        cuisine,
        latMin as string | undefined,
        latMax as string | undefined,
        lngMin as string | undefined,
        lngMax as string | undefined
      );
      res.json(demand);
    } catch (error) {
      console.error("[Analytics] Demand error:", error);
      res.status(500).json({ error: "Failed to fetch demand" });
    }
  });

  app.get("/api/analytics/restaurant/:restaurantId", async (req, res) => {
    try {
      const result = await getRestaurantAnalytics(req.params.restaurantId);
      if (!result) {
        res.json({ message: "No data available for this restaurant" });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error("[Analytics] Restaurant error:", error);
      res.status(500).json({ error: "Failed to fetch restaurant analytics" });
    }
  });

  return httpServer;
}
