import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, groupPushSubscriptions } from "@shared/schema";
import { eq, inArray, and } from "drizzle-orm";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:notifications@chickentinders.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export function getVapidPublicKey(): string | undefined {
  return VAPID_PUBLIC_KEY;
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; url?: string; data?: any }
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("VAPID keys not configured, skipping push notification");
    return;
  }

  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        );
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.error("Push notification error:", error);
        }
      }
    }
  } catch (error) {
    console.error("Error sending push notifications:", error);
  }
}

export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url?: string; data?: any }
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return;
  }

  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        );
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }
  } catch (error) {
    console.error("Error sending push notifications to users:", error);
  }
}

export async function sendPushToGroupMembers(
  groupId: string,
  payload: { title: string; body: string; url?: string; data?: any }
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return;
  }

  try {
    const subscriptions = await db
      .select()
      .from(groupPushSubscriptions)
      .where(eq(groupPushSubscriptions.groupId, groupId));

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        );
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await db.delete(groupPushSubscriptions).where(eq(groupPushSubscriptions.id, sub.id));
        }
      }
    }
  } catch (error) {
    console.error("Error sending push notifications to group members:", error);
  }
}

export async function saveGroupPushSubscription(
  groupId: string,
  memberId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  try {
    // Remove existing subscription for this endpoint in this group
    await db.delete(groupPushSubscriptions).where(
      and(
        eq(groupPushSubscriptions.groupId, groupId),
        eq(groupPushSubscriptions.endpoint, subscription.endpoint)
      )
    );
    
    // Insert new subscription
    await db.insert(groupPushSubscriptions).values({
      groupId,
      memberId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
  } catch (error) {
    console.error("Error saving group push subscription:", error);
  }
}
