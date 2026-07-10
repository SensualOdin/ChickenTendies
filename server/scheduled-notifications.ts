import { db } from "./db";
import { persistentGroups, diningSessions, lifecycleEvents } from "@shared/schema";
import { eq, and, sql, gte, inArray, max } from "drizzle-orm";
import { sendPushToUsers } from "./push";
import { logLifecycleEvent } from "./lifecycle";

const NOTIFICATION_INTERVAL_MS = 60 * 60 * 1000;

export function startScheduledNotifications() {
  setInterval(checkAndSendNotifications, NOTIFICATION_INTERVAL_MS);
  console.log("[Scheduled Notifications] Started hourly check");
}

// Batched: which of these groupIds already had `eventName` logged today?
// Replaces a per-crew SELECT that ran inside each nudge loop (N+1).
async function getGroupsAlreadyNotifiedToday(
  eventName: string,
  groupIds: string[],
): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ groupId: lifecycleEvents.groupId })
    .from(lifecycleEvents)
    .where(
      and(
        eq(lifecycleEvents.eventName, eventName),
        inArray(lifecycleEvents.groupId, groupIds),
        gte(lifecycleEvents.createdAt, todayStart),
      ),
    );
  return new Set(rows.map(r => r.groupId).filter((g): g is string => !!g));
}

function getEasternTime(): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || "0";
  return new Date(
    parseInt(get("year")),
    parseInt(get("month")) - 1,
    parseInt(get("day")),
    parseInt(get("hour")),
    parseInt(get("minute")),
    parseInt(get("second"))
  );
}

async function checkAndSendNotifications() {
  const eastern = getEasternTime();
  const dayOfWeek = eastern.getDay();
  const hour = eastern.getHours();

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

    if (crews.length === 0) return;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Batched: which crews already started a session this week?
    const crewIds = crews.map(c => c.id);
    const activeRows = await db
      .selectDistinct({ groupId: diningSessions.groupId })
      .from(diningSessions)
      .where(
        and(
          inArray(diningSessions.groupId, crewIds),
          sql`${diningSessions.startedAt} > ${startOfWeek.toISOString()}::timestamp`,
        ),
      );
    const activeThisWeek = new Set(activeRows.map(r => r.groupId));

    const alreadyNotified = await getGroupsAlreadyNotifiedToday(
      "push_friday_nudge_sent",
      crewIds,
    );

    for (const crew of crews) {
      if (activeThisWeek.has(crew.id)) continue;
      if (alreadyNotified.has(crew.id)) continue;

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

    if (crews.length === 0) return;
    const crewIds = crews.map(c => c.id);

    // Batched: last session start time per group, in one GROUP BY query.
    const lastSessionRows = await db
      .select({
        groupId: diningSessions.groupId,
        lastStartedAt: max(diningSessions.startedAt),
      })
      .from(diningSessions)
      .where(inArray(diningSessions.groupId, crewIds))
      .groupBy(diningSessions.groupId);
    const lastStartByGroup = new Map(
      lastSessionRows.map(r => [r.groupId, r.lastStartedAt]),
    );

    const alreadyNotified = await getGroupsAlreadyNotifiedToday(
      "push_dormant_nudge_sent",
      crewIds,
    );

    for (const crew of crews) {
      const lastStart = lastStartByGroup.get(crew.id);
      if (!lastStart) continue;
      if (new Date(lastStart) > twoWeeksAgo) continue;
      if (alreadyNotified.has(crew.id)) continue;

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
