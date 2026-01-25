import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { storage } from "./storage";
import { insertGroupSchema, joinGroupSchema, groupPreferencesSchema } from "@shared/schema";
import type { WSMessage, Group, Restaurant } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerSocialRoutes } from "./social-routes";

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
      res.json(result);
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
    res.json(group);
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
      const { restaurantId, liked, memberId } = req.body;
      
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

      res.json({ success: true, group: result.group });
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

  return httpServer;
}
