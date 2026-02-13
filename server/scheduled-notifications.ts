import { db } from "./db";
import { persistentGroups, diningSessions, lifecycleEvents } from "@shared/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { sendPushToUsers } from "./push";
import { logLifecycleEvent } from "./lifecycle";

const NOTIFICATION_INTERVAL_MS = 60 * 60 * 1000;

export function startScheduledNotifications() {
  setInterval(checkAndSendNotifications, NOTIFICATION_INTERVAL_MS);
  console.log("[Scheduled Notifications] Started hourly check");
}

async function wasSentToday(eventName: string, groupId: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ id: lifecycleEvents.id })
    .from(lifecycleEvents)
    .where(
      and(
        eq(lifecycleEvents.eventName, eventName),
        eq(lifecycleEvents.groupId, groupId),
        gte(lifecycleEvents.createdAt, todayStart)
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function checkAndSendNotifications() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  if (dayOfWeek === 5 && hour === 17) {
    await sendFridayNudge();
  }

  if (dayOfWeek === 3 && hour === 10) {
    await sendDormantCrewNudge();
  }
}

async function sendFridayNudge() {
  try {
    const crews = await db
      .select({
        id: persistentGroups.id,
        name: persistentGroups.name,
        ownerId: persistentGroups.ownerId,
        memberIds: persistentGroups.memberIds,
      })
      .from(persistentGroups);

    for (const crew of crews) {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const recentSessions = await db
        .select({ id: diningSessions.id })
        .from(diningSessions)
        .where(
          and(
            eq(diningSessions.groupId, crew.id),
            sql`${diningSessions.startedAt} > ${startOfWeek.toISOString()}::timestamp`
          )
        );

      if (recentSessions.length > 0) continue;

      if (await wasSentToday("push_friday_nudge_sent", crew.id)) continue;

      const allUserIds = [crew.ownerId, ...crew.memberIds];

      await sendPushToUsers(allUserIds, {
        title: "Time to pick a spot!",
        body: `It's Friday - where is ${crew.name} eating tonight?`,
        url: "/dashboard",
        data: { type: "friday_nudge" },
      });

      logLifecycleEvent("push_friday_nudge_sent", {
        groupId: crew.id,
        metadata: { memberCount: allUserIds.length },
      });
    }
  } catch (error) {
    console.error("[Scheduled] Error sending Friday nudge:", error);
  }
}

async function sendDormantCrewNudge() {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const crews = await db
      .select({
        id: persistentGroups.id,
        name: persistentGroups.name,
        ownerId: persistentGroups.ownerId,
        memberIds: persistentGroups.memberIds,
      })
      .from(persistentGroups);

    for (const crew of crews) {
      const lastSession = await db
        .select({ startedAt: diningSessions.startedAt })
        .from(diningSessions)
        .where(eq(diningSessions.groupId, crew.id))
        .orderBy(desc(diningSessions.startedAt))
        .limit(1);

      if (lastSession.length === 0) continue;
      if (lastSession[0].startedAt && new Date(lastSession[0].startedAt) > twoWeeksAgo) continue;

      if (await wasSentToday("push_dormant_nudge_sent", crew.id)) continue;

      const allUserIds = [crew.ownerId, ...crew.memberIds];

      await sendPushToUsers(allUserIds, {
        title: "Missing your crew?",
        body: `${crew.name} hasn't matched in a while. Start a new session?`,
        url: "/dashboard",
        data: { type: "dormant_nudge" },
      });

      logLifecycleEvent("push_dormant_nudge_sent", {
        groupId: crew.id,
        metadata: { memberCount: allUserIds.length },
      });
    }
  } catch (error) {
    console.error("[Scheduled] Error sending dormant crew nudge:", error);
  }
}
