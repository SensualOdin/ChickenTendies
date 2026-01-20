import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
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

  app.patch("/api/groups/:id/preferences", async (req, res) => {
    try {
      const preferences = groupPreferencesSchema.parse(req.body);
      const group = await storage.updateGroupPreferences(req.params.id, preferences);
      
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      broadcast(group.id, { type: "preferences_updated", preferences });
      broadcast(group.id, { type: "status_changed", status: "swiping" });

      res.json(group);
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

  return httpServer;
}
