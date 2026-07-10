import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { insertGroupSchema, joinGroupSchema, groupPreferencesSchema, cuisineVoteSchema, cuisineTypes, persistentGroups, diningSessions, users, anonymousGroups, groupNativePushSubscriptions } from "@shared/schema";
import type { WSMessage, Group, Restaurant, GroupMember, CuisineType } from "@shared/schema";
import { searchYelpRestaurantsByTerm } from "./yelp";
import { getCachedGoogleReviews } from "./google-places";
import { isAuthenticated, optionalAuth, registerAuthRoutes } from "./auth";
import { buildCuisineDeck, resolveCuisineWinners, findUnanimousCuisine } from "./cuisine-round";
import { registerSocialRoutes } from "./social-routes";
import { sendPushToGroupMembers, saveGroupPushSubscription, getVapidPublicKey } from "./push";
import { logAnalyticsEvent, logBatchAnalyticsEvents, getAnalyticsSummary, getCuisineDemand, getRestaurantAnalytics, getDemandReport, clampReportDays, CLIENT_ANALYTICS_ACTIONS } from "./analytics";
import { logLifecycleEvent } from "./lifecycle";
import { analyticsEvents } from "@shared/models/social";
import { db } from "./db";
import { authStorage } from "./auth/storage";
import { eq, and, inArray } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { generateCsrfToken, issueCsrfCookie, csrfMiddleware } from "./csrf";
import { TtlMap } from "./ttl-map";

// Dining sessions wrap up in minutes; 6h is the upper bound. Bounded so
// abandoned sessions don't grow these caches forever on Render.
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const createGroupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many groups created, please try again later" },
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many analytics events" },
});

const swipeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Swiping too fast, slow down!" },
});

// Brute-force protection for join-by-code endpoints (6-char codes).
// Exported so social-routes.ts can reuse it on /api/crews/join.
export const joinByCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many join attempts, please try again later" },
});

// Suggest is a Yelp-backed search per call — cap per-IP to avoid burning quota.
const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many suggestions, slow down a sec." },
});

export const sessionUserMap = new TtlMap<string, string>({
  ttlMs: SESSION_TTL_MS,
  maxEntries: 50_000,
});
export let appWss: InstanceType<typeof WebSocketServer> | null = null;

async function isAdminUser(req: any, res: any, next: any) {
  try {
    const userId = req.supabaseUser?.id;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const user = await authStorage.getUser(userId);
    if (!user?.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Authorization check failed" });
  }
}

interface WSClient {
  ws: WebSocket;
  groupId: string;
  memberId: string;
}

const clients: Map<string, WSClient[]> = new Map();

// In-memory vote storage: groupId -> Map<memberId, restaurantId>
export const matchVotes = new TtlMap<string, Map<string, string>>({
  ttlMs: SESSION_TTL_MS,
  maxEntries: 20_000,
});

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

// TODO: Implement real-time notification delivery (e.g., via WebSocket or SSE)
// These are intentional no-ops until a notification transport is implemented.
// They are called from social-routes.ts for friend requests, session starts, etc.
export function notifyUser(_userId: string, _notification: { type: string; message: string; data?: any }) {
}

export function notifyUsers(_userIds: string[], _notification: { type: string; message: string; data?: any }) {
}

function stripLeaderToken(group: any) {
  if (!group) return group;
  const { leaderToken, ...safe } = group;
  return safe;
}

// Signed cookie-based member binding (replaces express-session binding)
const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret && process.env.NODE_ENV === "production") {
  throw new Error("COOKIE_SECRET environment variable is required in production");
}
const bindingSecret = cookieSecret || "chickentinders-dev-secret";

function signValue(value: string): string {
  const sig = createHmac("sha256", bindingSecret).update(value).digest("base64url");
  return `${value}.${sig}`;
}

function verifySignedValue(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.substring(0, lastDot);
  const sig = signed.substring(lastDot + 1);
  const expected = createHmac("sha256", bindingSecret).update(value).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  return value;
}

// Origins that are allowed to supply identity via the X-Member-Bindings header.
// Capacitor iOS/Android WebView sets one of these; regular browsers do NOT.
// Restricting to these origins prevents a browser-origin attacker from presenting
// a stolen binding token via the header to bypass cookie-bound identity.
const NATIVE_APP_ORIGINS = new Set([
  "capacitor://localhost",
  "https://localhost",
]);

function isNativeAppRequest(req: Request): boolean {
  const origin = req.headers.origin;
  // A missing Origin header is only acceptable for non-browser contexts. Real
  // browsers always send Origin on cross-origin requests; native WebViews send
  // one of NATIVE_APP_ORIGINS. We treat no-origin as native-eligible because
  // some mobile tooling strips it, and the signed header alone is still the
  // sole identity path there.
  if (!origin) return true;
  return NATIVE_APP_ORIGINS.has(origin);
}

function getMemberBindings(req: Request): Record<string, string> {
  // Try cookie first (works on web, same-origin)
  const raw = req.cookies?.["member-bindings"];
  if (raw) {
    const value = verifySignedValue(raw);
    if (value) {
      try { return JSON.parse(value); } catch { /* fall through */ }
    }
  }
  // Fallback: check custom header (works on native/cross-origin where cookies fail).
  // Only trust this header from native app origins. Browser-origin requests must
  // use the cookie path to prevent header-replay impersonation.
  if (isNativeAppRequest(req)) {
    const headerRaw = req.headers["x-member-bindings"] as string | undefined;
    if (headerRaw) {
      const value = verifySignedValue(headerRaw);
      if (value) {
        try { return JSON.parse(value); } catch { /* fall through */ }
      }
    }
  }
  return {};
}

function bindMemberToSession(req: any, res: any, groupId: string, memberId: string) {
  const existing = getMemberBindings(req);
  existing[groupId] = memberId;
  const value = JSON.stringify(existing);
  const signed = signValue(value);
  // Set cookie for web (same-origin)
  res.cookie("member-bindings", signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: "/",
  });
  // Also set custom header for native apps (cross-origin where cookies don't work)
  res.setHeader("X-Member-Bindings", signed);
}

export function getSessionMemberId(req: any, groupId: string): string | null {
  return getMemberBindings(req)[groupId] || null;
}

function verifyMemberIdentity(req: any, groupId: string, claimedMemberId: string): boolean {
  const bindings = getMemberBindings(req);
  const boundMemberId = bindings[groupId] || null;
  if (!boundMemberId) {
    console.log(`[verifyMemberIdentity] FAILED: no binding for group=${groupId}, claimed=${claimedMemberId}, cookie=${!!req.cookies?.["member-bindings"]}, header=${!!req.headers["x-member-bindings"]}, bindingKeys=${Object.keys(bindings).join(",")}`);
    return false;
  }
  if (boundMemberId !== claimedMemberId) {
    console.log(`[verifyMemberIdentity] MISMATCH: group=${groupId}, bound=${boundMemberId}, claimed=${claimedMemberId}`);
    return false;
  }
  return true;
}

async function sendSync(ws: WebSocket, groupId: string) {
  const group = await storage.getGroup(groupId);
  if (!group) return;

  const restaurants = await storage.getRestaurantsForGroup(groupId);
  const matches = await storage.getMatchesForGroup(groupId);

  const message: WSMessage = {
    type: "sync",
    group: stripLeaderToken(group),
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
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // CSRF token endpoint — clients must GET this once on boot and echo the
  // returned token via the X-CSRF-Token header on all mutating requests.
  app.get("/api/csrf-token", (_req, res) => {
    const token = generateCsrfToken();
    issueCsrfCookie(res, token);
    res.json({ token });
  });

  // Apply rate limiter BEFORE registering routes so all /api/ routes are covered
  app.use("/api/", generalLimiter);

  // CSRF enforcement on all /api/* mutating requests. Exemptions are defined
  // inside csrfMiddleware (health, csrf-token, safe methods). Must run AFTER
  // cookieParser (set up in index.ts) so req.cookies is populated.
  app.use("/api/", csrfMiddleware);

  registerAuthRoutes(app);
  registerSocialRoutes(app);

  // Stable per-session seed so the cuisine deck order is deterministic.
  const seedFromGroupId = (groupId: string): number => {
    let h = 0;
    for (let i = 0; i < groupId.length; i++) h = (Math.imul(31, h) + groupId.charCodeAt(i)) | 0;
    return h >>> 0;
  };

  // Resolve the cuisine round: compute winners, write them into preferences.cuisineTypes,
  // flip to swiping, and broadcast. Reused by both the unanimous fast-path and the all-done path.
  const resolveCuisineRound = async (groupId: string): Promise<void> => {
    const group = await storage.getGroup(groupId);
    if (!group || !group.preferences) return;
    const claimed = await storage.claimCuisineResolution(groupId);
    if (!claimed) return; // another trigger already resolved this round
    const memberIds = group.members.map((m) => m.id);
    const votes = await storage.getCuisineVotes(groupId);
    const deck = (group.cuisineDeck as string[]) || [];
    const winners = resolveCuisineWinners(memberIds, votes, deck) as CuisineType[];

    const updatedPreferences = { ...group.preferences, cuisineTypes: winners };
    await storage.updateGroupPreferences(groupId, updatedPreferences);
    await storage.setMatchedCuisines(groupId, winners);
    await storage.clearRestaurantCache(groupId);
    await storage.updateGroupStatus(groupId, "swiping");

    broadcast(groupId, { type: "cuisine_round_complete", winners });
    broadcast(groupId, { type: "status_changed", status: "swiping" });
  };

  // Re-evaluate whether the cuisine round should end. Safe to call after any
  // event that changes votes or membership (vote, done, member removal).
  const maybeResolveCuisineRound = async (groupId: string): Promise<void> => {
    const group = await storage.getGroup(groupId);
    if (!group || group.status !== "cuisine_voting" || group.members.length === 0) return;
    const memberIds = group.members.map((m) => m.id);
    const votes = await storage.getCuisineVotes(groupId);
    const deck = (group.cuisineDeck as string[]) || [];
    const unanimous = findUnanimousCuisine(memberIds, votes);
    const allDone = group.members.every((m) => m.doneCuisineVoting);
    if (unanimous) {
      const winners = resolveCuisineWinners(memberIds, votes, deck) as CuisineType[];
      if (winners[0]) broadcast(groupId, { type: "cuisine_match_found", cuisine: winners[0] });
      await resolveCuisineRound(groupId);
    } else if (allDone) {
      await resolveCuisineRound(groupId);
    }
  };

  const wss = new WebSocketServer({ noServer: true });
  // Export for external wiring — upgrade handler is set up in index.ts
  // after Vite so they don't conflict
  appWss = wss;

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const groupId = url.searchParams.get("groupId");
    const memberId = url.searchParams.get("memberId");

    if (!groupId || !memberId) {
      ws.close();
      return;
    }

    const group = await storage.getGroup(groupId);
    if (!group || !group.members.some((m: any) => m.id === memberId)) {
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

  app.post("/api/groups", createGroupLimiter, async (req, res) => {
    try {
      const data = insertGroupSchema.parse(req.body);
      const result = await storage.createGroup(data);
      bindMemberToSession(req, res, result.group.id, result.memberId);
      logLifecycleEvent("anonymous_party_created", {
        groupId: result.group.id,
        metadata: {
          code: result.group.code,
          name: result.group.name,
          hostMemberId: result.memberId,
        },
      });
      const { leaderToken, ...groupWithoutToken } = result.group;
      res.json({
        group: groupWithoutToken,
        memberId: result.memberId,
        leaderToken
      });
    } catch (error) {
      console.error("Error creating group:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        res.status(500).json({ error: "Failed to create group" });
      }
    }
  });

  app.post("/api/groups/join", joinByCodeLimiter, async (req, res) => {
    try {
      const data = joinGroupSchema.parse(req.body);
      const result = await storage.joinGroup(data);

      if (!result) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      bindMemberToSession(req, res, result.group.id, result.memberId);

      const member = result.group.members.find(m => m.id === result.memberId);
      if (member) {
        broadcast(result.group.id, { type: "member_joined", member }, result.memberId);
      }

      logLifecycleEvent("anonymous_party_joined", {
        groupId: result.group.id,
        metadata: {
          code: result.group.code,
          memberId: result.memberId,
          memberName: member?.name,
          totalMembers: result.group.members.length,
        },
      });

      const { leaderToken: _, ...groupWithoutToken } = result.group;
      res.json({ ...result, group: groupWithoutToken });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.get("/api/groups/:id", async (req, res) => {
    const group = await storage.getGroup((req.params.id as string));
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const memberId = req.query.memberId as string | undefined;
    if (memberId) {
      const isMember = group.members.some(m => m.id === memberId);
      if (!isMember) {
        res.status(403).json({ error: "You are not a member of this group" });
        return;
      }
    }

    const { leaderToken, ...groupWithoutToken } = group;
    res.json(groupWithoutToken);
  });

  // Returns every anonymous-party the caller's signed binding cookie maps to.
  // The client only persists one (groupId, memberId) pair in localStorage, so a
  // tester who creates/joins a second party loses the UI handle for the first.
  // The signed cookie still binds them to all of them — we just need to expose
  // it so the home-screen affordance can offer a switcher.
  app.get("/api/me/groups", async (req, res) => {
    const bindings = getMemberBindings(req);
    const entries = Object.entries(bindings);
    if (entries.length === 0) {
      res.json({ groups: [] });
      return;
    }

    const results = await Promise.all(
      entries.map(async ([groupId, memberId]) => {
        const group = await storage.getGroup(groupId);
        if (!group) return null;
        if (!group.members.some(m => m.id === memberId)) return null;
        return { group: stripLeaderToken(group), memberId };
      })
    );

    const groups = results
      .filter((r): r is { group: any; memberId: string } => r !== null)
      // Most recent first — anon groups carry created_at; fall back to id stability.
      .sort((a, b) => {
        const aTime = a.group.createdAt ? new Date(a.group.createdAt).getTime() : 0;
        const bTime = b.group.createdAt ? new Date(b.group.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    res.json({ groups });
  });

  // Lazily-fetched Google reviews for the swipe-card details panel. Kept off
  // the search-time enrichment pass because the FieldMask "places.reviews"
  // request is the priciest Google Places SKU — we only want to pay for it
  // when a tester actually opens details. In-memory cache absorbs repeats.
  app.get("/api/restaurants/reviews", async (req, res) => {
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    if (!name || name.length > 200) {
      res.status(400).json({ message: "name required" });
      return;
    }
    const address = typeof req.query.address === "string" ? req.query.address.trim() : undefined;
    const lat = typeof req.query.lat === "string" ? parseFloat(req.query.lat) : undefined;
    const lng = typeof req.query.lng === "string" ? parseFloat(req.query.lng) : undefined;
    const validLat = lat !== undefined && Number.isFinite(lat) ? lat : undefined;
    const validLng = lng !== undefined && Number.isFinite(lng) ? lng : undefined;

    try {
      const reviews = await getCachedGoogleReviews(name, address, validLat, validLng);
      res.json({ reviews });
    } catch (err) {
      console.error("/api/restaurants/reviews failed:", err);
      res.json({ reviews: [] });
    }
  });

  app.post("/api/groups/:id/join-session", isAuthenticated, async (req, res) => {
    try {
      const groupId = String((req.params.id as string));
      const userId = req.supabaseUser?.id || "";

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
      const isSessionCreator = activeSession.createdById === userId;
      const hasNoMembers = memGroup && memGroup.members.length === 0;

      const hadExistingRow = !!memGroup;

      if (!memGroup || hasNoMembers) {
        const hostMemberId = randomUUID();
        const host: GroupMember = {
          id: hostMemberId,
          name: displayName,
          isHost: true,
          joinedAt: Date.now(),
          doneSwiping: false,
          doneCuisineVoting: false,
        };

        const leaderToken = randomUUID();
        memGroup = {
          id: groupId,
          code: persistentGroup.inviteCode,
          name: persistentGroup.name,
          members: [host],
          preferences: activeSession.preferences as any,
          status: "waiting",
          createdAt: Date.now(),
          leaderToken,
        };
        if (hadExistingRow) {
          await storage.updateGroup(groupId, memGroup);
        } else {
          // Crew's first session — no row in anonymousGroups yet, INSERT one
          await db.insert(anonymousGroups).values({
            id: groupId,
            code: persistentGroup.inviteCode,
            name: persistentGroup.name,
            members: memGroup.members,
            preferences: memGroup.preferences,
            status: memGroup.status,
            leaderToken,
          });
        }
        sessionUserMap.set(`${groupId}:${userId}`, hostMemberId);
        bindMemberToSession(req, res, groupId, hostMemberId);

        // Host gets the leaderToken as an explicit top-level field; the nested
        // group object must never carry it (dbRowToGroup includes it).
        res.json({ memberId: hostMemberId, group: stripLeaderToken(memGroup), leaderToken });
        return;
      }

      const existingMemberId = sessionUserMap.get(`${groupId}:${userId}`);
      if (existingMemberId) {
        const existingMember = memGroup.members.find(m => m.id === existingMemberId);
        if (existingMember) {
          bindMemberToSession(req, res, groupId, existingMemberId);
          res.json({ memberId: existingMemberId, group: stripLeaderToken(memGroup) });
          return;
        }
      }

      const memberId = randomUUID();
      const newMember: GroupMember = {
        id: memberId,
        name: displayName,
        isHost: isSessionCreator && !memGroup.members.some(m => m.isHost),
        joinedAt: Date.now(),
        doneSwiping: false,
        doneCuisineVoting: false,
      };

      memGroup.members.push(newMember);
      await storage.updateGroup(groupId, memGroup);
      sessionUserMap.set(`${groupId}:${userId}`, memberId);
      bindMemberToSession(req, res, groupId, memberId);

      broadcast(groupId, { type: "member_joined", member: newMember }, memberId);

      res.json({ memberId, group: stripLeaderToken(memGroup) });
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

      const group = await storage.getGroup((req.params.id as string));
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      // Verify the token matches using constant-time comparison to avoid timing attacks.
      const expected = Buffer.from(group.leaderToken || "");
      const provided = Buffer.from(leaderToken);
      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
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
        bindMemberToSession(req, res, (req.params.id as string), existingMember.id);
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
        doneSwiping: false,
        doneCuisineVoting: false
      };

      // Demote old host if exists
      const updatedMembers = group.members.map(m => ({ ...m, isHost: false }));
      updatedMembers.push(newHost);

      const updatedGroup = { ...group, members: updatedMembers };
      await storage.updateGroup((req.params.id as string), updatedGroup);

      // Broadcast member joined
      broadcast((req.params.id as string), { type: "member_joined", member: newHost }, memberId);

      bindMemberToSession(req, res, (req.params.id as string), memberId);
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

      if (!verifyMemberIdentity(req, (req.params.id as string), hostMemberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const validatedPreferences = groupPreferencesSchema.parse(preferences);

      const group = await storage.getGroup((req.params.id as string));
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      const hostMember = group.members.find(m => m.id === hostMemberId && m.isHost);
      if (!hostMember) {
        res.status(403).json({ error: "Only the host can start the session" });
        return;
      }

      const updatedGroup = await storage.updateGroupPreferences((req.params.id as string), validatedPreferences);
      if (!updatedGroup) {
        res.status(500).json({ error: "Failed to update preferences" });
        return;
      }

      // Clear any previous match votes
      matchVotes.delete((req.params.id as string));

      const groupId = req.params.id as string;
      const cuisineEnabled = validatedPreferences.cuisineRoundEnabled !== false;
      let deck: CuisineType[] = [];
      if (cuisineEnabled) {
        deck = buildCuisineDeck({
          excludeCuisines: validatedPreferences.excludeCuisines || [],
          trySomethingNew: validatedPreferences.trySomethingNew || false,
          matchedBefore: [],
          seed: seedFromGroupId(groupId),
        });
      }

      if (cuisineEnabled && deck.length > 0) {
        // Reset any stale done-voting flags, store the deck, enter the cuisine round.
        for (const m of updatedGroup.members) m.doneCuisineVoting = false;
        await storage.updateGroup(groupId, { ...updatedGroup, cuisineDeck: deck });
        await storage.setCuisineDeck(groupId, deck);
        await storage.updateGroupStatus(groupId, "cuisine_voting");
        broadcast(groupId, { type: "preferences_updated", preferences: validatedPreferences });
        broadcast(groupId, { type: "status_changed", status: "cuisine_voting" });
        res.json(stripLeaderToken({ ...updatedGroup, status: "cuisine_voting", cuisineDeck: deck }));
        return;
      }

      // Cuisine round disabled or empty deck → straight to swiping (legacy behavior).
      await storage.updateGroupStatus(groupId, "swiping");
      broadcast(groupId, { type: "preferences_updated", preferences: validatedPreferences });
      broadcast(groupId, { type: "status_changed", status: "swiping" });

      logLifecycleEvent("anonymous_party_started_swiping", {
        groupId,
        metadata: {
          memberCount: updatedGroup.members.length,
          cuisineTypes: validatedPreferences.cuisineTypes,
          priceRange: validatedPreferences.priceRange,
        },
      });

      res.json(stripLeaderToken(updatedGroup));
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.get("/api/groups/:id/restaurants", async (req, res) => {
    const restaurants = await storage.getRestaurantsForGroup((req.params.id as string));
    res.json(restaurants);
  });

  app.post("/api/groups/:id/restaurants/load-more", async (req, res) => {
    // Only group members should be able to trigger expensive restaurant-loading.
    // The caller must identify themselves via memberId (body) matched against
    // the signed binding cookie/header.
    const { memberId } = req.body ?? {};
    if (!memberId || typeof memberId !== "string") {
      res.status(400).json({ error: "memberId required" });
      return;
    }
    if (!verifyMemberIdentity(req, (req.params.id as string), memberId)) {
      res.status(403).json({ error: "Session identity mismatch" });
      return;
    }

    const existingCount = (await storage.getRestaurantsForGroup((req.params.id as string))).length;
    const restaurants = await storage.loadMoreRestaurants((req.params.id as string));
    const newCount = restaurants.length;
    const loadedNew = newCount > existingCount;

    if (loadedNew) {
      const group = await storage.getGroup((req.params.id as string));
      if (group) {
        for (const member of group.members) {
          member.doneSwiping = false;
        }
        const matches = await storage.getMatchesForGroup((req.params.id as string));
        broadcast((req.params.id as string), {
          type: "sync",
          group: stripLeaderToken(group),
          restaurants,
          matches,
        });
      }
    }

    res.json({ restaurants, loadedNew });
  });

  // Search Yelp by free-text term within the group's existing search area.
  // Returns up to 5 candidate restaurants the member can pick from. Used by
  // the "Suggest a place" UI when the algorithmic results miss something the
  // member specifically wants (test users asked for this — they narrowed
  // radius to escape Coney Island spam, then lost their staple picks).
  const suggestSearchSchema = z.object({
    memberId: z.string().min(1),
    query: z.string().min(2).max(80),
  });

  app.post("/api/groups/:id/restaurants/suggest", suggestLimiter, async (req, res) => {
    try {
      const groupId = String((req.params.id as string));
      const { memberId, query } = suggestSearchSchema.parse(req.body);
      if (!verifyMemberIdentity(req, groupId, memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const group = await storage.getGroup(groupId);
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }
      if (!group.preferences) {
        res.status(400).json({ error: "Set preferences before suggesting restaurants" });
        return;
      }

      const candidates = await searchYelpRestaurantsByTerm(query, group.preferences, 5);
      res.json({ results: candidates });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        console.error("Error in /restaurants/suggest:", error);
        res.status(500).json({ error: "Search failed" });
      }
    }
  });

  // Add a member-suggested restaurant to the group's deck. The client passes
  // the full Restaurant object returned by /suggest — re-validating it via
  // Zod keeps callers honest and prevents arbitrary data from polluting the
  // cache. After adding, we reset every member's doneSwiping so the new card
  // doesn't get silently skipped by people who'd already finished, and we
  // broadcast a sync so existing connections see it immediately.
  const suggestAddSchema = z.object({
    memberId: z.string().min(1),
    restaurant: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    }).passthrough(),
  });

  app.post("/api/groups/:id/restaurants/add", suggestLimiter, async (req, res) => {
    try {
      const groupId = String((req.params.id as string));
      const { memberId, restaurant } = suggestAddSchema.parse(req.body);
      if (!verifyMemberIdentity(req, groupId, memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const group = await storage.getGroup(groupId);
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }
      const member = group.members.find(m => m.id === memberId);
      if (!member) {
        res.status(403).json({ error: "Member not in group" });
        return;
      }

      const { added, restaurants } = await storage.addRestaurantToGroup(
        groupId,
        restaurant as Restaurant
      );

      if (!added) {
        res.json({ added: false, restaurants });
        return;
      }

      // Bring everyone back into the active swipe queue — anyone who was
      // marked done needs to see the new option, otherwise it never enters
      // the unanimous-match calculation.
      const refreshedMembers = group.members.map(m => ({ ...m, doneSwiping: false }));
      const refreshedGroup: Group = { ...group, members: refreshedMembers };
      await storage.updateGroup(groupId, refreshedGroup);

      const matches = await storage.getMatchesForGroup(groupId);
      broadcast(groupId, {
        type: "sync",
        group: stripLeaderToken(refreshedGroup),
        restaurants,
        matches,
      });

      res.json({ added: true, restaurants, suggestedBy: member.name });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        console.error("Error in /restaurants/add:", error);
        res.status(500).json({ error: "Failed to add restaurant" });
      }
    }
  });

  app.post("/api/groups/:id/swipe", swipeLimiter, optionalAuth, async (req, res) => {
    try {
      const { restaurantId, liked, memberId, superLiked } = req.body;

      if (!restaurantId || typeof liked !== "boolean" || !memberId) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }

      if (!verifyMemberIdentity(req, (req.params.id as string), memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const swipe = await storage.recordSwipe((req.params.id as string), memberId, restaurantId, liked);

      const authUserId = (req as any).supabaseUser?.id;
      if (authUserId) {
        const action = superLiked ? "super_like" : liked ? "swipe_right" : "swipe_left";
        logAnalyticsEvent({
          userId: authUserId,
          sessionId: (req.params.id as string),
          restaurantId,
          action,
        }).catch(() => { });
      }

      broadcast((req.params.id as string), {
        type: "swipe_made",
        memberId,
        restaurantId
      }, memberId);

      if (liked) {
        const matches = await storage.getMatchesForGroup((req.params.id as string));
        const matchedRestaurant = matches.find(r => r.id === restaurantId);

        if (matchedRestaurant) {
          // This like completed unanimity — the match is born here. Log it
          // server-side (demand dataset); never let logging break the flow.
          logAnalyticsEvent({
            userId: authUserId ?? null,
            sessionId: (req.params.id as string),
            restaurantId: matchedRestaurant.id,
            restaurantName: matchedRestaurant.name,
            action: "match",
            cuisineTags: matchedRestaurant.cuisine ? [matchedRestaurant.cuisine] : null,
            priceRange: matchedRestaurant.priceRange ?? null,
          }).catch(() => { });

          broadcast((req.params.id as string), {
            type: "match_found",
            restaurant: matchedRestaurant
          });
        }
      }

      res.json(swipe);

      // Broadcast swipe progress to group
      const groupClients = clients.get((req.params.id as string));
      if (groupClients) {
        const swipeCount = await storage.getSwipeCountForMember((req.params.id as string), memberId);
        const totalRestaurants = await storage.getRestaurantCountForGroup((req.params.id as string));
        const progressMsg = JSON.stringify({
          type: "member_progress",
          memberId,
          swipeCount,
          totalRestaurants,
        });
        groupClients.forEach((client) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(progressMsg);
          }
        });
      }
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/groups/:id/undo-swipe", swipeLimiter, async (req: Request, res: Response) => {
    try {
      const groupId = (req.params.id as string);
      const { memberId, restaurantId } = req.body;

      if (!memberId || !restaurantId) {
        return res.status(400).json({ message: "memberId and restaurantId required" });
      }

      if (!verifyMemberIdentity(req, groupId, memberId)) {
        return res.status(403).json({ error: "Session identity mismatch" });
      }

      await storage.deleteSwipe(groupId, memberId, restaurantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error undoing swipe:", error);
      res.status(500).json({ message: "Failed to undo swipe" });
    }
  });

  app.get("/api/groups/:id/matches", async (req, res) => {
    const matches = await storage.getMatchesForGroup((req.params.id as string));
    res.json(matches);
  });

  app.get("/api/groups/:id/partial-matches", async (req, res) => {
    try {
      const partials = await storage.getPartialMatchesForGroup((req.params.id as string));
      res.json(partials);
    } catch (error) {
      console.error("Error fetching partial matches:", error);
      res.status(500).json({ error: "Failed to fetch partial matches" });
    }
  });

  // A holdout taps "I'm in" on a partial-match card. Flips their swipe to a
  // like; if that completes unanimity, broadcasts match_found so the card
  // jumps into the main matches list on every client.
  app.post("/api/groups/:id/agree-partial-match", swipeLimiter, optionalAuth, async (req, res) => {
    try {
      const groupId = (req.params.id as string);
      const { memberId, restaurantId } = req.body as { memberId?: string; restaurantId?: string };

      if (!memberId || !restaurantId) {
        return res.status(400).json({ error: "memberId and restaurantId required" });
      }
      if (!verifyMemberIdentity(req, groupId, memberId)) {
        return res.status(403).json({ error: "Session identity mismatch" });
      }

      await storage.flipSwipeToLike(groupId, memberId, restaurantId);

      broadcast(groupId, { type: "swipe_made", memberId, restaurantId });

      const matches = await storage.getMatchesForGroup(groupId);
      const newMatch = matches.find(r => r.id === restaurantId);
      if (newMatch) {
        // The "I'm in" flip completed unanimity — log the match server-side.
        logAnalyticsEvent({
          userId: (req as any).supabaseUser?.id ?? null,
          sessionId: groupId,
          restaurantId: newMatch.id,
          restaurantName: newMatch.name,
          action: "match",
          cuisineTags: newMatch.cuisine ? [newMatch.cuisine] : null,
          priceRange: newMatch.priceRange ?? null,
        }).catch(() => { });

        broadcast(groupId, { type: "match_found", restaurant: newMatch });
      }

      res.json({ success: true, becameUnanimous: !!newMatch });
    } catch (error) {
      console.error("Error agreeing to partial match:", error);
      res.status(500).json({ error: "Failed to agree to partial match" });
    }
  });

  // Vote for a matched restaurant
  const voteMatchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Voting too fast, slow down" },
  });

  app.post("/api/groups/:id/vote-match", voteMatchLimiter, async (req, res) => {
    try {
      const { memberId, restaurantId } = req.body;
      if (!memberId || !restaurantId) {
        res.status(400).json({ error: "memberId and restaurantId required" });
        return;
      }

      if (!verifyMemberIdentity(req, (req.params.id as string), memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const group = await storage.getGroup((req.params.id as string));
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      const member = group.members.find(m => m.id === memberId);
      if (!member) {
        res.status(403).json({ error: "Member not in group" });
        return;
      }

      // Reject votes for restaurants that aren't actually matched in this group.
      // Without this, a member can broadcast a fake "match_vote" for any string.
      const matches = await storage.getMatchesForGroup((req.params.id as string));
      if (!matches.some(r => r.id === restaurantId)) {
        res.status(400).json({ error: "Restaurant is not a match for this group" });
        return;
      }

      // Record vote (one per member, can change)
      if (!matchVotes.has((req.params.id as string))) {
        matchVotes.set((req.params.id as string), new Map());
      }
      const groupVotes = matchVotes.get((req.params.id as string))!;
      groupVotes.set(memberId, restaurantId);

      // Broadcast vote to all members
      broadcast((req.params.id as string), {
        type: "match_vote",
        memberId,
        memberName: member.name,
        restaurantId,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Get current match votes for a group
  app.get("/api/groups/:id/match-votes", async (req, res) => {
    const group = await storage.getGroup((req.params.id as string));
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    // Only group members can read votes. Derive memberId from signed binding
    // so the client doesn't need to pass anything extra.
    const boundMemberId = getSessionMemberId(req, (req.params.id as string));
    if (!boundMemberId || !group.members.some((m) => m.id === boundMemberId)) {
      res.status(403).json({ error: "Not a member of this group" });
      return;
    }

    const groupVotes = matchVotes.get((req.params.id as string));
    const votes: Record<string, { memberId: string; memberName: string }[]> = {};

    if (groupVotes) {
      groupVotes.forEach((rId, mId) => {
        const member = group.members.find(m => m.id === mId);
        if (!member) return;
        if (!votes[rId]) votes[rId] = [];
        votes[rId].push({ memberId: mId, memberName: member.name });
      });
    }

    res.json({ votes });
  });

  // Host picks (locks in) a matched restaurant
  app.post("/api/groups/:id/pick-match", async (req, res) => {
    try {
      const { memberId, restaurantId, pickedLocationId } = req.body;
      if (!memberId || !restaurantId) {
        res.status(400).json({ error: "memberId and restaurantId required" });
        return;
      }

      if (!verifyMemberIdentity(req, (req.params.id as string), memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const group = await storage.getGroup((req.params.id as string));
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      const hostMember = group.members.find(m => m.id === memberId && m.isHost);
      if (!hostMember) {
        res.status(403).json({ error: "Only the host can pick a match" });
        return;
      }

      const matches = await storage.getMatchesForGroup((req.params.id as string));
      const matched = matches.find(r => r.id === restaurantId);
      if (!matched) {
        res.status(404).json({ error: "Restaurant not in matches" });
        return;
      }

      // For chain clusters: if the host picked a specific location, overlay
      // its address/coords/phone onto the matched brand so downstream UI
      // (directions, share text, push body) refers to the actual storefront
      // they're going to — not the cluster's "primary" placeholder.
      let restaurant = matched;
      let resolvedLocationId: string | undefined;
      if (pickedLocationId && matched.locations && matched.locations.length > 0) {
        const loc = matched.locations.find(l => l.id === pickedLocationId);
        if (!loc) {
          res.status(400).json({ error: "Picked location not part of this match" });
          return;
        }
        restaurant = {
          ...matched,
          address: loc.address,
          distance: loc.distance,
          rating: loc.rating,
          reviewCount: loc.reviewCount,
          latitude: loc.latitude,
          longitude: loc.longitude,
          phone: loc.phone,
          yelpUrl: loc.yelpUrl,
        };
        resolvedLocationId = loc.id;
      }

      // Broadcast pick to all members
      broadcast((req.params.id as string), {
        type: "match_picked",
        restaurant,
        ...(resolvedLocationId ? { pickedLocationId: resolvedLocationId } : {}),
      });

      // Send push notification to members who may have closed the app.
      // Fire-and-forget, but swallow errors to avoid unhandled promise rejections
      // crashing the Node process if the push service is down.
      sendPushToGroupMembers((req.params.id as string), {
        title: `${restaurant.name} is locked in!`,
        body: `${group.name} is going to ${restaurant.name}. Let's eat!`,
        url: `/group/${(req.params.id as string)}/matches`,
        data: { groupId: (req.params.id as string), type: "match_picked", restaurantId },
      }).catch((err) => console.error("[push] match_picked failed:", err));

      // Clear votes
      matchVotes.delete((req.params.id as string));

      logLifecycleEvent("anonymous_party_match_picked", {
        groupId: (req.params.id as string),
        metadata: {
          restaurantId,
          restaurantName: restaurant.name,
          memberCount: group.members.length,
        },
      });

      res.json({ success: true, restaurant });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // A member locks in their "Final Vote" pick on the swipe page. Server-side
  // sibling of the client-only Final Vote overlay: validates the caller's
  // identity and that the restaurant is actually a match before telling the
  // rest of the group.
  app.post("/api/groups/:id/final-choice", voteMatchLimiter, async (req, res) => {
    try {
      const { memberId, restaurantId } = req.body;
      if (!memberId || typeof memberId !== "string" || !restaurantId || typeof restaurantId !== "string") {
        res.status(400).json({ error: "memberId and restaurantId required" });
        return;
      }

      if (!verifyMemberIdentity(req, (req.params.id as string), memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const group = await storage.getGroup((req.params.id as string));
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      const member = group.members.find(m => m.id === memberId);
      if (!member) {
        res.status(403).json({ error: "Member not in group" });
        return;
      }

      const matches = await storage.getMatchesForGroup((req.params.id as string));
      if (!matches.some(r => r.id === restaurantId)) {
        res.status(404).json({ error: "Restaurant not in matches" });
        return;
      }

      // Broadcast the final choice to all members
      broadcast((req.params.id as string), {
        type: "final_choice",
        restaurantId,
        chosenBy: member.name,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Nudge members who haven't swiped yet
  const nudgeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many nudges, slow down" },
  });

  app.post("/api/groups/:id/nudge", nudgeLimiter, async (req, res) => {
    const { restaurantId, fromMemberId } = req.body;

    if (!verifyMemberIdentity(req, (req.params.id as string), fromMemberId)) {
      res.status(403).json({ error: "Session identity mismatch" });
      return;
    }

    const group = await storage.getGroup((req.params.id as string));
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const fromMember = group.members.find(m => m.id === fromMemberId);
    const restaurants = await storage.getRestaurantsForGroup((req.params.id as string));
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!fromMember || !restaurant) {
      res.status(400).json({ error: "Invalid member or restaurant" });
      return;
    }

    const membersToNudge = await storage.getMembersWhoHaventSwiped((req.params.id as string), restaurantId);
    const nudgeTargets = membersToNudge.filter(m => m.id !== fromMemberId);

    // Send nudge to all members who haven't swiped (except the sender)
    const nudgeMessage = {
      type: "nudge" as const,
      fromMemberName: fromMember.name,
      restaurantName: restaurant.name,
      targetMemberIds: nudgeTargets.map(m => m.id),
    };

    broadcast((req.params.id as string), nudgeMessage, fromMemberId);

    res.json({
      success: true,
      nudgedCount: nudgeTargets.length
    });
  });

  // Mark member as done swiping
  const doneSwipingSchema = z.object({
    memberId: z.string().min(1)
  });

  app.post("/api/groups/:id/done-swiping", swipeLimiter, async (req, res) => {
    try {
      const { memberId } = doneSwipingSchema.parse(req.body);

      if (!verifyMemberIdentity(req, (req.params.id as string), memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const result = await storage.markMemberDoneSwiping((req.params.id as string), memberId);
      if (!result) {
        res.status(404).json({ error: "Group or member not found" });
        return;
      }

      broadcast((req.params.id as string), {
        type: "member_done_swiping",
        memberId: result.member.id,
        memberName: result.member.name
      });

      // Check if ALL members are now done swiping
      const allDone = result.group.members.every(m => m.doneSwiping);
      if (allDone && result.group.members.length > 0) {
        // Send push notification to all group members (fire-and-forget with
        // error capture to prevent unhandled rejection crashes). Skip the push
        // for solo groups — "Everyone's done swiping!" is just the person who
        // tapped the button, and the notification reads as spam.
        if (result.group.members.length >= 2) {
          sendPushToGroupMembers((req.params.id as string), {
            title: "Everyone's done swiping!",
            body: `Your group "${result.group.name}" has finished swiping. Check out your matches!`,
            url: `/group/${(req.params.id as string)}/matches`,
            data: { groupId: (req.params.id as string), type: "all_done_swiping" }
          }).catch((err) => console.error("[push] all_done_swiping failed:", err));
        }

        // Also broadcast via WebSocket for users who are still on the page
        broadcast((req.params.id as string), { type: "all_done_swiping" });
      }

      res.json({ success: true, group: stripLeaderToken(result.group) });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Record a cuisine vote (pre-restaurant round)
  app.post("/api/groups/:id/cuisine-vote", swipeLimiter, async (req, res) => {
    try {
      const groupId = String(req.params.id);
      const { memberId, cuisine, liked } = cuisineVoteSchema.parse(req.body);

      if (!verifyMemberIdentity(req, groupId, memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }
      const group = await storage.getGroup(groupId);
      if (!group) { res.status(404).json({ error: "Group not found" }); return; }
      if (!group.members.some((m) => m.id === memberId)) {
        res.status(403).json({ error: "Member not in group" }); return;
      }

      await storage.recordCuisineVote(groupId, memberId, cuisine, liked);
      broadcast(groupId, { type: "cuisine_vote_made", memberId, cuisine });

      await maybeResolveCuisineRound(groupId);

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Mark a member done with the cuisine round
  app.post("/api/groups/:id/done-cuisine-voting", async (req, res) => {
    try {
      const { memberId } = z.object({ memberId: z.string().min(1) }).parse(req.body);
      if (!verifyMemberIdentity(req, req.params.id, memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }
      const result = await storage.markMemberDoneCuisineVoting(req.params.id, memberId);
      if (!result) { res.status(404).json({ error: "Group or member not found" }); return; }

      broadcast(req.params.id, {
        type: "member_done_cuisine_voting",
        memberId: result.member.id,
        memberName: result.member.name,
      });

      await maybeResolveCuisineRound(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Get cuisine round state (deck, votes, tallies, member progress) — refresh/rejoin recovery
  app.get("/api/groups/:id/cuisine-round", async (req, res) => {
    const group = await storage.getGroup(req.params.id);
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }
    const votes = await storage.getCuisineVotes(req.params.id);
    const tallies: Record<string, number> = {};
    for (const v of votes) if (v.liked) tallies[v.cuisine] = (tallies[v.cuisine] || 0) + 1;
    res.json({
      deck: group.cuisineDeck || [],
      votes,
      tallies,
      members: group.members.map((m) => ({ id: m.id, name: m.name, doneCuisineVoting: m.doneCuisineVoting })),
      status: group.status,
    });
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
      const groupId = (req.params.id as string);

      if (!verifyMemberIdentity(req, groupId, memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

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

  // Native (FCM/APNs) sibling of the above. Anonymous-party guests on the
  // mobile app register their device token tied to (groupId, memberId) so
  // sendPushToGroupMembers can wake their phone when the host starts a
  // session — the web-push path can't do that because Capacitor's WebView
  // doesn't run service workers in the background.
  app.post("/api/groups/:id/push/subscribe-native", async (req, res) => {
    try {
      const groupId = (req.params.id as string);
      const { memberId, token, platform } = req.body ?? {};
      if (
        !memberId || typeof memberId !== "string" ||
        !token || typeof token !== "string" ||
        (platform !== "android" && platform !== "ios")
      ) {
        return res.status(400).json({ error: "memberId, token, platform (android|ios) required" });
      }
      if (!verifyMemberIdentity(req, groupId, memberId)) {
        return res.status(403).json({ error: "Session identity mismatch" });
      }
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ error: "Group not found" });
      if (!group.members.some(m => m.id === memberId)) {
        return res.status(403).json({ error: "Member not in group" });
      }

      // Naive dedupe: drop any prior row for this exact (group, member,
      // token) trio, then insert. Avoids unique-constraint gymnastics on a
      // composite key while preventing duplicate rows for the same device.
      await db.delete(groupNativePushSubscriptions).where(
        and(
          eq(groupNativePushSubscriptions.groupId, groupId),
          eq(groupNativePushSubscriptions.memberId, memberId),
          eq(groupNativePushSubscriptions.token, token),
        )
      );
      await db.insert(groupNativePushSubscriptions).values({ groupId, memberId, token, platform });
      res.json({ success: true });
    } catch (error) {
      console.error("Error registering group native push token:", error);
      res.status(500).json({ error: "Failed to register push token" });
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

      if (!verifyMemberIdentity(req, (req.params.id as string), memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const group = await storage.getGroup((req.params.id as string));
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

      broadcast((req.params.id as string), {
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
    const { id: groupId, memberId: targetMemberId } = req.params as { id: string; memberId: string };
    const { hostMemberId } = req.body;

    if (!verifyMemberIdentity(req, groupId, hostMemberId)) {
      res.status(403).json({ error: "Session identity mismatch" });
      return;
    }

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

    await maybeResolveCuisineRound(groupId);

    res.json({ success: true, group: stripLeaderToken(updatedGroup) });
  });

  // Update group preferences (host only, outside of session start)
  app.patch("/api/groups/:id/preferences", async (req, res) => {
    try {
      const { hostMemberId, preferences } = req.body;

      if (!verifyMemberIdentity(req, (req.params.id as string), hostMemberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }

      const validatedPreferences = groupPreferencesSchema.parse(preferences);

      const group = await storage.getGroup((req.params.id as string));
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

      const updatedGroup = await storage.updateGroupPreferences((req.params.id as string), validatedPreferences);
      if (!updatedGroup) {
        res.status(500).json({ error: "Failed to update preferences" });
        return;
      }

      broadcast((req.params.id as string), { type: "preferences_updated", preferences: validatedPreferences });

      res.json({ success: true, group: stripLeaderToken(updatedGroup) });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/analytics/events", analyticsLimiter, optionalAuth, async (req, res) => {
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

      // Pin userId to the authenticated user (server-side). Previously the
      // client supplied userId in the body, so an unauthenticated caller could
      // flood/poison the analytics store with arbitrary userIds.
      const authUserId = (req as any).supabaseUser?.id ?? null;
      // Action allowlist: unknown/junk actions are silently dropped so a bad
      // client can't pollute the demand dataset. Server-only actions like
      // "match" are excluded on purpose (logged at match creation instead).
      const sanitized = events
        .filter((e: any) =>
          e &&
          typeof e.restaurantId === "string" &&
          typeof e.action === "string" &&
          CLIENT_ANALYTICS_ACTIONS.has(e.action)
        )
        .map((e: any) => ({
          userId: authUserId,
          sessionId: typeof e.sessionId === "string" ? e.sessionId : null,
          restaurantId: e.restaurantId,
          restaurantName: typeof e.restaurantName === "string" ? e.restaurantName : null,
          action: e.action,
          cuisineTags: Array.isArray(e.cuisineTags) ? e.cuisineTags : null,
          priceRange: typeof e.priceRange === "string" ? e.priceRange : null,
          distanceMiles: typeof e.distanceMiles === "number" ? e.distanceMiles : null,
          userLat: typeof e.userLat === "string" ? e.userLat : null,
          userLng: typeof e.userLng === "string" ? e.userLng : null,
        }));

      if (sanitized.length === 0) {
        // Everything was malformed or had an unknown action — drop silently.
        res.json({ success: true, count: 0 });
        return;
      }

      await logBatchAnalyticsEvents(sanitized);
      res.json({ success: true, count: sanitized.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to log events" });
    }
  });

  app.get("/api/analytics/summary", isAuthenticated, isAdminUser, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const summary = await getAnalyticsSummary(Math.min(days, 365));
      res.json(summary);
    } catch (error) {
      console.error("[Analytics] Summary error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/report", isAuthenticated, isAdminUser, async (req, res) => {
    try {
      const days = clampReportDays(req.query.days as string | undefined);
      const report = await getDemandReport(days);
      res.json(report);
    } catch (error) {
      console.error("[Analytics] Report error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/analytics/demand", isAuthenticated, isAdminUser, async (req, res) => {
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

  app.post("/api/admin/reset-analytics", isAuthenticated, isAdminUser, async (req, res) => {
    try {
      const deleted = await db.delete(analyticsEvents).returning({ id: analyticsEvents.id });
      console.log(`[Admin] Analytics reset: ${deleted.length} events deleted by user ${(req as any).supabaseUser?.id}`);
      res.json({ success: true, deletedCount: deleted.length });
    } catch (error) {
      console.error("[Admin] Reset analytics error:", error);
      res.status(500).json({ error: "Failed to reset analytics" });
    }
  });

  app.get("/api/analytics/restaurant/:restaurantId", isAuthenticated, isAdminUser, async (req, res) => {
    try {
      const restaurantId = Array.isArray((req.params.restaurantId as string)) ? (req.params.restaurantId as string)[0] : (req.params.restaurantId as string);
      const result = await getRestaurantAnalytics(restaurantId);
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
