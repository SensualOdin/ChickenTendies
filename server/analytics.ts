import { db } from "./db";
import { analyticsEvents } from "@shared/models/social";
import { eq, sql, and, gte, count } from "drizzle-orm";
import { createHash } from "crypto";

function hashUserId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return createHash("sha256").update(userId).digest("hex").substring(0, 16);
}

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

function truncateCoordinate(coord: string | number | null | undefined, decimals = 3): string | null {
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
