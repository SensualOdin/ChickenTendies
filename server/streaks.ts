import { db } from "./db";
import { diningSessions } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export async function getCrewStreak(groupId: string): Promise<{ currentStreak: number; lastSessionWeek: string | null }> {
  const sessions = await db
    .select({
      endedAt: diningSessions.endedAt,
    })
    .from(diningSessions)
    .where(
      and(
        eq(diningSessions.groupId, groupId),
        eq(diningSessions.status, "completed")
      )
    )
    .orderBy(desc(diningSessions.endedAt));

  if (sessions.length === 0) {
    return { currentStreak: 0, lastSessionWeek: null };
  }

  const weekSet = new Set<string>();
  for (const s of sessions) {
    if (s.endedAt) {
      const d = new Date(s.endedAt);
      const weekKey = getISOWeekKey(d);
      weekSet.add(weekKey);
    }
  }

  const sortedWeeks = Array.from(weekSet).sort().reverse();
  if (sortedWeeks.length === 0) return { currentStreak: 0, lastSessionWeek: null };

  const now = new Date();
  const currentWeekKey = getISOWeekKey(now);
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekKey = getISOWeekKey(lastWeekDate);

  let streak = 0;
  let checkWeek = currentWeekKey;

  if (sortedWeeks[0] !== currentWeekKey && sortedWeeks[0] !== lastWeekKey) {
    return { currentStreak: 0, lastSessionWeek: sortedWeeks[0] };
  }

  for (const week of sortedWeeks) {
    if (week === checkWeek) {
      streak++;
      checkWeek = getPreviousWeekKey(checkWeek);
    } else if (streak === 0 && week === lastWeekKey) {
      checkWeek = lastWeekKey;
      streak++;
      checkWeek = getPreviousWeekKey(checkWeek);
    } else {
      break;
    }
  }

  return { currentStreak: streak, lastSessionWeek: sortedWeeks[0] };
}

function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export async function getBatchCrewStreaks(groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();

  const sessions = await db
    .select({
      groupId: diningSessions.groupId,
      endedAt: diningSessions.endedAt,
    })
    .from(diningSessions)
    .where(
      and(
        inArray(diningSessions.groupId, groupIds),
        eq(diningSessions.status, "completed")
      )
    )
    .orderBy(desc(diningSessions.endedAt));

  const groupWeeks = new Map<string, Set<string>>();
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const weekKey = getISOWeekKey(new Date(s.endedAt));
    if (!groupWeeks.has(s.groupId)) groupWeeks.set(s.groupId, new Set());
    groupWeeks.get(s.groupId)!.add(weekKey);
  }

  const now = new Date();
  const currentWeekKey = getISOWeekKey(now);
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekKey = getISOWeekKey(lastWeekDate);

  const result = new Map<string, number>();
  for (const gid of groupIds) {
    const weekSet = groupWeeks.get(gid);
    if (!weekSet || weekSet.size === 0) {
      result.set(gid, 0);
      continue;
    }
    const sortedWeeks = Array.from(weekSet).sort().reverse();
    if (sortedWeeks[0] !== currentWeekKey && sortedWeeks[0] !== lastWeekKey) {
      result.set(gid, 0);
      continue;
    }
    let streak = 0;
    let checkWeek = currentWeekKey;
    for (const week of sortedWeeks) {
      if (week === checkWeek) {
        streak++;
        checkWeek = getPreviousWeekKey(checkWeek);
      } else if (streak === 0 && week === lastWeekKey) {
        checkWeek = lastWeekKey;
        streak++;
        checkWeek = getPreviousWeekKey(checkWeek);
      } else {
        break;
      }
    }
    result.set(gid, streak);
  }
  return result;
}

function getISOWeeksInYear(year: number): number {
  const dec28 = new Date(year, 11, 28);
  const dayOfDec28 = dec28.getDay();
  const thursdayInLastWeek = new Date(dec28);
  thursdayInLastWeek.setDate(dec28.getDate() - ((dayOfDec28 + 6) % 7) + 3);
  const jan4 = new Date(thursdayInLastWeek.getFullYear(), 0, 4);
  return Math.ceil((((thursdayInLastWeek.getTime() - jan4.getTime()) / 86400000) + 1) / 7);
}

function getPreviousWeekKey(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split('-W');
  let year = parseInt(yearStr);
  let week = parseInt(weekStr) - 1;
  if (week < 1) {
    year--;
    week = getISOWeeksInYear(year);
  }
  return `${year}-W${week.toString().padStart(2, '0')}`;
}
