import admin from "firebase-admin";
import { db } from "./db";
import { nativePushSubscriptions } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

// Server-side Firebase Cloud Messaging (Android) and APNs-via-FCM (iOS).
// Pairs with the Capacitor PushNotifications plugin on the client.
//
// Setup: drop the entire Firebase service-account JSON into the env var
// FIREBASE_SERVICE_ACCOUNT_JSON. Render's env var UI accepts multi-line
// values fine. Without it we just skip native send (web push still works).

const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let initialized = false;
function getAdmin() {
  if (!SERVICE_ACCOUNT_JSON) return null;
  if (!initialized) {
    try {
      const credential = JSON.parse(SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(credential),
      });
      initialized = true;
    } catch (err) {
      console.error("FCM init failed — invalid FIREBASE_SERVICE_ACCOUNT_JSON:", err);
      return null;
    }
  }
  return admin;
}

export function isFcmConfigured(): boolean {
  return !!SERVICE_ACCOUNT_JSON;
}

export interface NativePushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Send to a list of FCM/APNs tokens. Drops invalid tokens from the DB so
// we don't keep hammering them on every notification.
async function sendToTokens(tokens: string[], payload: NativePushPayload): Promise<void> {
  if (tokens.length === 0) return;
  const sdk = getAdmin();
  if (!sdk) return;

  // FCM data values must be strings. Coerce defensively in case a caller
  // passes through a payload from elsewhere with non-string values.
  const data: Record<string, string> = {};
  if (payload.data) {
    for (const [k, v] of Object.entries(payload.data)) {
      data[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
  }

  const response = await sdk.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data,
    android: {
      priority: "high",
      notification: {
        channelId: "default",
        sound: "default",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  });

  // Prune tokens FCM has marked invalid (uninstalled app, expired token, etc.)
  // so we stop sending to them and the table doesn't grow unbounded.
  const invalidTokens: string[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error) {
      const code = r.error.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument"
      ) {
        invalidTokens.push(tokens[i]);
      } else {
        console.warn(`FCM send error for token ${tokens[i].slice(0, 12)}…:`, code);
      }
    }
  });

  if (invalidTokens.length > 0) {
    try {
      await db
        .delete(nativePushSubscriptions)
        .where(inArray(nativePushSubscriptions.token, invalidTokens));
    } catch (err) {
      console.error("Failed to prune invalid FCM tokens:", err);
    }
  }
}

export async function sendNativePushToUsers(userIds: string[], payload: NativePushPayload): Promise<void> {
  if (!isFcmConfigured() || userIds.length === 0) return;
  try {
    const subs = await db
      .select({ token: nativePushSubscriptions.token })
      .from(nativePushSubscriptions)
      .where(inArray(nativePushSubscriptions.userId, userIds));
    const tokens = subs.map((s) => s.token);
    await sendToTokens(tokens, payload);
  } catch (err) {
    console.error("sendNativePushToUsers failed:", err);
  }
}

export async function sendNativePushToUser(userId: string, payload: NativePushPayload): Promise<void> {
  if (!isFcmConfigured()) return;
  try {
    const subs = await db
      .select({ token: nativePushSubscriptions.token })
      .from(nativePushSubscriptions)
      .where(eq(nativePushSubscriptions.userId, userId));
    const tokens = subs.map((s) => s.token);
    await sendToTokens(tokens, payload);
  } catch (err) {
    console.error("sendNativePushToUser failed:", err);
  }
}

// For anonymous-party notifications. The group_push_subscriptions table is
// keyed by (groupId, memberId) for web; native tokens are user-scoped, so
// we look up which userIds correspond to the group's members and fan out
// to those tokens. Members who joined as anonymous (no user_id) won't have
// a native token — they get web push or nothing.
export async function sendNativePushToUsersInGroup(
  userIds: string[],
  payload: NativePushPayload,
): Promise<void> {
  return sendNativePushToUsers(userIds, payload);
}
