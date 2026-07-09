import { db } from "./db";
import { analyticsEvents } from "@shared/models/social";
import { eq, sql, and, gte, count } from "drizzle-orm";
import { createHash } from "crypto";

function hashUserId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return createHash("sha256").update(userId).digest("hex").substring(0, 16);
}

// Swipe actions as actually stored in analytics_events.action.
export const SWIPE_ACTIONS = ["swipe_right", "swipe_left", "super_like"] as const;

// Match-card outcome actions emitted by the client (demand instrumentation).
export const OUTCOME_ACTIONS = [
  "action_directions",
  "action_delivery",
  "action_reserve",
  "action_calendar",
  "action_share",
  "action_visited",
  "action_final_choice",
] as const;

// Everything POST /api/analytics/events accepts from clients. "match" is
// deliberately absent — it is logged server-side at match creation only, so
// clients can't inflate match counts.
export const CLIENT_ANALYTICS_ACTIONS: ReadonlySet<string> = new Set([
  ...SWIPE_ACTIONS,
  "click_details",
  ...OUTCOME_ACTIONS,
]);

export interface AnalyticsEventInput {
  userId?: string | null;
  sessionId?: string | null;
  restaurantId: string;
  restaurantName?: string | null;
  action: string;
  cuisineTags?: string[] | null;
  priceRange?: string | null;
  distanceMiles?: number | null;
  userLat?: string | null;
  userLng?: string | null;
}

export function truncateCoordinate(coord: string | number | null | undefined, decimals = 2): string | null {
  if (coord === null || coord === undefined) return null;
  const num = typeof coord === "string" ? parseFloat(coord) : coord;
  if (isNaN(num)) return null;
  return num.toFixed(decimals);
}

export async function logAnalyticsEvent(input: AnalyticsEventInput) {
  try {
    const now = new Date();
    await db.insert(analyticsEvents).values({
      userId: hashUserId(input.userId),
      sessionId: input.sessionId || null,
      restaurantId: input.restaurantId,
      restaurantName: input.restaurantName || null,
      action: input.action,
      cuisineTags: input.cuisineTags || null,
      priceRange: input.priceRange || null,
      distanceMiles: input.distanceMiles || null,
      userLat: truncateCoordinate(input.userLat),
      userLng: truncateCoordinate(input.userLng),
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
    });
  } catch (error) {
    console.error("[Analytics] Failed to log event:", error);
  }
}

export async function logBatchAnalyticsEvents(events: AnalyticsEventInput[]) {
  try {
    const now = new Date();
    const values = events.map((input) => ({
      userId: hashUserId(input.userId),
      sessionId: input.sessionId || null,
      restaurantId: input.restaurantId,
      restaurantName: input.restaurantName || null,
      action: input.action,
      cuisineTags: input.cuisineTags || null,
      priceRange: input.priceRange || null,
      distanceMiles: input.distanceMiles || null,
      userLat: truncateCoordinate(input.userLat),
      userLng: truncateCoordinate(input.userLng),
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
    }));
    await db.insert(analyticsEvents).values(values);
  } catch (error) {
    console.error("[Analytics] Failed to log batch events:", error);
  }
}

export async function getAnalyticsSummary(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const [totalEvents, totalRightSwipes, totalLeftSwipes, totalSuperLikes] = await Promise.all([
    db.select({ count: count() }).from(analyticsEvents).where(gte(analyticsEvents.createdAt, since)),
    db.select({ count: count() }).from(analyticsEvents).where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.action, "swipe_right"))),
    db.select({ count: count() }).from(analyticsEvents).where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.action, "swipe_left"))),
    db.select({ count: count() }).from(analyticsEvents).where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.action, "super_like"))),
  ]);

  const topCuisines = await db.execute(sql`
    SELECT cuisine, COUNT(*) as swipe_count
    FROM analytics_events, jsonb_array_elements_text(cuisine_tags) AS cuisine
    WHERE action IN ('swipe_right', 'super_like')
      AND created_at > ${sinceStr}::timestamp
    GROUP BY cuisine
    ORDER BY swipe_count DESC
    LIMIT 10
  `);

  const topRestaurants = await db.execute(sql`
    SELECT restaurant_id, restaurant_name, 
      COUNT(*) FILTER (WHERE action = 'swipe_right') as right_swipes,
      COUNT(*) FILTER (WHERE action = 'swipe_left') as left_swipes,
      COUNT(*) FILTER (WHERE action = 'super_like') as super_likes
    FROM analytics_events
    WHERE created_at > ${sinceStr}::timestamp
      AND restaurant_name IS NOT NULL
      AND restaurant_name != ''
      AND restaurant_name !~ '^[A-Za-z0-9_-]{15,}$'
    GROUP BY restaurant_id, restaurant_name
    ORDER BY right_swipes DESC
    LIMIT 20
  `);

  const hourlyActivity = await db.execute(sql`
    SELECT hour_of_day, COUNT(*) as event_count
    FROM analytics_events
    WHERE created_at > ${sinceStr}::timestamp
    GROUP BY hour_of_day
    ORDER BY hour_of_day
  `);

  const dailyActivity = await db.execute(sql`
    SELECT day_of_week, COUNT(*) as event_count
    FROM analytics_events
    WHERE created_at > ${sinceStr}::timestamp
    GROUP BY day_of_week
    ORDER BY day_of_week
  `);

  const pricePreferences = await db.execute(sql`
    SELECT price_range, 
      COUNT(*) FILTER (WHERE action IN ('swipe_right', 'super_like')) as liked,
      COUNT(*) FILTER (WHERE action = 'swipe_left') as disliked
    FROM analytics_events
    WHERE created_at > ${sinceStr}::timestamp
      AND price_range IS NOT NULL
    GROUP BY price_range
    ORDER BY price_range
  `);

  return {
    period: { days, since: since.toISOString() },
    totals: {
      events: totalEvents[0]?.count || 0,
      rightSwipes: totalRightSwipes[0]?.count || 0,
      leftSwipes: totalLeftSwipes[0]?.count || 0,
      superLikes: totalSuperLikes[0]?.count || 0,
    },
    topCuisines: Array.from(topCuisines),
    topRestaurants: Array.from(topRestaurants),
    hourlyActivity: Array.from(hourlyActivity),
    dailyActivity: Array.from(dailyActivity),
    pricePreferences: Array.from(pricePreferences),
  };
}

// ---------------------------------------------------------------------------
// Demand report (GET /api/analytics/report)
// ---------------------------------------------------------------------------

export function clampReportDays(raw: unknown, fallback = 7): number {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(90, Math.max(1, Math.trunc(n)));
}

export interface ActionCountRow {
  action: string;
  count: number;
}

export interface CuisineActionRow {
  cuisine: string;
  action: string;
  count: number;
}

export interface RestaurantActionRow {
  restaurant_id: string;
  restaurant_name: string;
  action: string;
  count: number;
}

export interface BucketCountRow {
  bucket: number;
  swipes: number;
}

export interface DemandReportRows {
  windowDays: number;
  actionRows: ActionCountRow[];
  uniqueUsers: number;
  cuisineRows: CuisineActionRow[];
  restaurantRows: RestaurantActionRow[];
  dayRows: BucketCountRow[];
  hourRows: BucketCountRow[];
}

const SWIPE_ACTION_SET: ReadonlySet<string> = new Set(SWIPE_ACTIONS);
// "Likes" for demand purposes include super likes — a super like is a like.
const LIKE_ACTION_SET: ReadonlySet<string> = new Set(["swipe_right", "super_like"]);

function isOutcomeAction(action: string): boolean {
  return action.startsWith("action_");
}

// Pure shaping over pre-aggregated rows — testable without a database.
export function shapeDemandReport(rows: DemandReportRows) {
  const { windowDays, actionRows, uniqueUsers, cuisineRows, restaurantRows, dayRows, hourRows } = rows;

  const totals = { swipes: 0, likes: 0, superLikes: 0, matches: 0, actions: 0, uniqueUsers };
  // Pre-seed all known outcome actions so the client always sees stable keys.
  const actionBreakdown: Record<string, number> = {};
  for (const a of OUTCOME_ACTIONS) actionBreakdown[a] = 0;

  for (const row of actionRows) {
    const count = Number(row.count) || 0;
    if (SWIPE_ACTION_SET.has(row.action)) totals.swipes += count;
    if (row.action === "swipe_right") totals.likes += count;
    if (row.action === "super_like") totals.superLikes += count;
    if (row.action === "match") totals.matches += count;
    if (isOutcomeAction(row.action)) {
      totals.actions += count;
      actionBreakdown[row.action] = (actionBreakdown[row.action] || 0) + count;
    }
  }

  const cuisineMap = new Map<string, { cuisine: string; swipes: number; likes: number; matches: number; actions: number }>();
  for (const row of cuisineRows) {
    const count = Number(row.count) || 0;
    let entry = cuisineMap.get(row.cuisine);
    if (!entry) {
      entry = { cuisine: row.cuisine, swipes: 0, likes: 0, matches: 0, actions: 0 };
      cuisineMap.set(row.cuisine, entry);
    }
    if (SWIPE_ACTION_SET.has(row.action)) entry.swipes += count;
    if (LIKE_ACTION_SET.has(row.action)) entry.likes += count;
    if (row.action === "match") entry.matches += count;
    if (isOutcomeAction(row.action)) entry.actions += count;
  }
  const cuisines = Array.from(cuisineMap.values())
    .map(({ cuisine, swipes, likes, matches, actions }) => ({
      cuisine,
      swipes,
      likes,
      likeRate: swipes > 0 ? Number((likes / swipes).toFixed(3)) : 0,
      matches,
      actions,
    }))
    .sort((a, b) => b.likes - a.likes || a.cuisine.localeCompare(b.cuisine));

  const restaurantMap = new Map<string, { restaurantId: string; name: string; likes: number; matches: number; actions: number; actionBreakdown: Record<string, number> }>();
  for (const row of restaurantRows) {
    const count = Number(row.count) || 0;
    let entry = restaurantMap.get(row.restaurant_id);
    if (!entry) {
      entry = { restaurantId: row.restaurant_id, name: row.restaurant_name, likes: 0, matches: 0, actions: 0, actionBreakdown: {} };
      restaurantMap.set(row.restaurant_id, entry);
    }
    if (LIKE_ACTION_SET.has(row.action)) entry.likes += count;
    if (row.action === "match") entry.matches += count;
    if (isOutcomeAction(row.action)) {
      entry.actions += count;
      entry.actionBreakdown[row.action] = (entry.actionBreakdown[row.action] || 0) + count;
    }
  }
  const topRestaurants = Array.from(restaurantMap.values())
    .sort((a, b) => b.likes - a.likes || b.matches - a.matches || a.name.localeCompare(b.name))
    .slice(0, 20);

  // Dense buckets (every day 0-6, every hour 0-23) so charts render evenly.
  const dayCounts = new Map(dayRows.map((r) => [Number(r.bucket), Number(r.swipes) || 0]));
  const byDayOfWeek = Array.from({ length: 7 }, (_, day) => ({ day, swipes: dayCounts.get(day) || 0 }));
  const hourCounts = new Map(hourRows.map((r) => [Number(r.bucket), Number(r.swipes) || 0]));
  const byHourOfDay = Array.from({ length: 24 }, (_, hour) => ({ hour, swipes: hourCounts.get(hour) || 0 }));

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    totals,
    cuisines,
    topRestaurants,
    actionBreakdown,
    byDayOfWeek,
    byHourOfDay,
  };
}

export async function getDemandReport(days = 7) {
  const windowDays = clampReportDays(days);
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString();

  const [actionRows, uniqueUsersRows, cuisineRows, restaurantRows, dayRows, hourRows] = await Promise.all([
    db.execute(sql`
      SELECT action, COUNT(*)::int AS count
      FROM analytics_events
      WHERE created_at > ${sinceStr}::timestamp
      GROUP BY action
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int AS unique_users
      FROM analytics_events
      WHERE created_at > ${sinceStr}::timestamp
        AND user_id IS NOT NULL
    `),
    db.execute(sql`
      SELECT cuisine, action, COUNT(*)::int AS count
      FROM analytics_events, jsonb_array_elements_text(cuisine_tags) AS cuisine
      WHERE created_at > ${sinceStr}::timestamp
      GROUP BY cuisine, action
    `),
    db.execute(sql`
      SELECT restaurant_id, restaurant_name, action, COUNT(*)::int AS count
      FROM analytics_events
      WHERE created_at > ${sinceStr}::timestamp
        AND restaurant_name IS NOT NULL
        AND restaurant_name != ''
        AND restaurant_name !~ '^[A-Za-z0-9_-]{15,}$'
      GROUP BY restaurant_id, restaurant_name, action
    `),
    db.execute(sql`
      SELECT day_of_week AS bucket, COUNT(*)::int AS swipes
      FROM analytics_events
      WHERE created_at > ${sinceStr}::timestamp
        AND action IN ('swipe_right', 'swipe_left', 'super_like')
      GROUP BY day_of_week
    `),
    db.execute(sql`
      SELECT hour_of_day AS bucket, COUNT(*)::int AS swipes
      FROM analytics_events
      WHERE created_at > ${sinceStr}::timestamp
        AND action IN ('swipe_right', 'swipe_left', 'super_like')
      GROUP BY hour_of_day
    `),
  ]);

  return shapeDemandReport({
    windowDays,
    actionRows: Array.from(actionRows) as unknown as ActionCountRow[],
    uniqueUsers: Number((Array.from(uniqueUsersRows)[0] as any)?.unique_users) || 0,
    cuisineRows: Array.from(cuisineRows) as unknown as CuisineActionRow[],
    restaurantRows: Array.from(restaurantRows) as unknown as RestaurantActionRow[],
    dayRows: Array.from(dayRows) as unknown as BucketCountRow[],
    hourRows: Array.from(hourRows) as unknown as BucketCountRow[],
  });
}

export async function getCuisineDemand(cuisine: string, latMin?: string, latMax?: string, lngMin?: string, lngMax?: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString();

  const result = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(*) as total_swipes
    FROM analytics_events 
    WHERE cuisine_tags ? ${cuisine}
      AND action IN ('swipe_right', 'super_like')
      AND created_at > ${sinceStr}::timestamp
      ${latMin && latMax ? sql`AND user_lat BETWEEN ${latMin} AND ${latMax}` : sql``}
      ${lngMin && lngMax ? sql`AND user_lng BETWEEN ${lngMin} AND ${lngMax}` : sql``}
  `);

  return Array.from(result)[0] || { unique_users: 0, total_swipes: 0 };
}

export async function getRestaurantAnalytics(restaurantId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString();

  const result = await db.execute(sql`
    SELECT 
      restaurant_name,
      COUNT(*) FILTER (WHERE action = 'swipe_right') as right_swipes,
      COUNT(*) FILTER (WHERE action = 'swipe_left') as left_swipes,
      COUNT(*) FILTER (WHERE action = 'super_like') as super_likes,
      COUNT(*) as total_views,
      ROUND(
        COUNT(*) FILTER (WHERE action IN ('swipe_right', 'super_like'))::numeric / 
        NULLIF(COUNT(*), 0) * 100, 1
      ) as approval_rate
    FROM analytics_events
    WHERE restaurant_id = ${restaurantId}
      AND created_at > ${sinceStr}::timestamp
    GROUP BY restaurant_name
  `);

  return Array.from(result)[0] || null;
}
