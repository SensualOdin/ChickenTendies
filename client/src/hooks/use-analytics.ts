import { useCallback, useRef } from "react";

interface AnalyticsEvent {
  restaurantId: string;
  restaurantName?: string;
  action: "swipe_left" | "swipe_right" | "super_like" | "click_details";
  cuisineTags?: string[];
  priceRange?: string;
  distanceMiles?: number;
  userLat?: string;
  userLng?: string;
  userId?: string;
  sessionId?: string;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

export function useAnalytics(sessionId?: string, userId?: string) {
  const queueRef = useRef<AnalyticsEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (queueRef.current.length === 0) return;

    const events = [...queueRef.current];
    queueRef.current = [];

    try {
      await fetch("/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        credentials: "include",
      });
    } catch (error) {
      queueRef.current = [...events, ...queueRef.current];
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, FLUSH_INTERVAL_MS);
  }, [flush]);

  const trackEvent = useCallback(
    (event: Omit<AnalyticsEvent, "userId" | "sessionId">) => {
      queueRef.current.push({
        ...event,
        userId: userId || undefined,
        sessionId: sessionId || undefined,
      });

      if (queueRef.current.length >= BATCH_SIZE) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        flush();
      } else {
        scheduleFlush();
      }
    },
    [userId, sessionId, flush, scheduleFlush]
  );

  const trackSwipe = useCallback(
    (
      restaurant: {
        id: string;
        name: string;
        cuisine?: string;
        priceRange?: string;
        distance?: number;
      },
      action: "swipe_left" | "swipe_right" | "super_like",
      location?: { lat?: number; lng?: number }
    ) => {
      trackEvent({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        action,
        cuisineTags: restaurant.cuisine ? [restaurant.cuisine] : undefined,
        priceRange: restaurant.priceRange,
        distanceMiles: restaurant.distance,
        userLat: location?.lat?.toFixed(3),
        userLng: location?.lng?.toFixed(3),
      });
    },
    [trackEvent]
  );

  const flushNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    flush();
  }, [flush]);

  return { trackEvent, trackSwipe, flushNow };
}
