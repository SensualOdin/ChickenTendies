import { db } from "./db";
import { googlePlacesCache } from "@shared/schema";
import type { GoogleReview } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

const CACHE_TTL_HOURS = 24;
const GOOGLE_PLACES_TIMEOUT_MS = 5000;

// Reviews are fetched lazily from a separate endpoint when the user opens a
// card's details panel — not during the search-time enrichment pass. We keep
// an in-process LRU-ish cache so a popular restaurant doesn't get re-fetched
// on every details open. Server restart wipes this cache; that's fine, it
// just means the next 24h of opens repopulate from Google.
const REVIEWS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REVIEWS_CACHE_MAX = 5000;
const reviewsCache = new Map<string, { reviews: GoogleReview[]; expiresAt: number }>();

async function fetchGooglePlaces(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_PLACES_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface GooglePlaceResult {
  rating?: number;
  userRatingCount?: number;
  displayName?: { text: string };
  formattedAddress?: string;
  googleMapsUri?: string;
}

interface GoogleSearchResponse {
  places?: GooglePlaceResult[];
}

export interface GooglePlaceData {
  googleRating: number | null;
  googleReviewCount: number | null;
  googleMapsUrl: string | null;
}

export async function lookupGooglePlace(
  name: string,
  latitude?: number,
  longitude?: number,
  address?: string
): Promise<GooglePlaceData> {
  if (!GOOGLE_PLACES_API_KEY) {
    return { googleRating: null, googleReviewCount: null, googleMapsUrl: null };
  }

  try {
    const textQuery = address ? `${name} ${address}` : name;

    const body: Record<string, unknown> = {
      textQuery,
      includedType: "restaurant",
      pageSize: 1,
    };

    if (latitude !== undefined && longitude !== undefined) {
      body.locationBias = {
        circle: {
          center: { latitude, longitude },
          radius: 1000.0,
        },
      };
    }

    const response = await fetchGooglePlaces(GOOGLE_PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.rating,places.userRatingCount,places.displayName,places.googleMapsUri",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Places API error for "${name}":`, response.status, errorText);
      return { googleRating: null, googleReviewCount: null, googleMapsUrl: null };
    }

    const data: GoogleSearchResponse = await response.json();

    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        googleRating: place.rating ?? null,
        googleReviewCount: place.userRatingCount ?? null,
        googleMapsUrl: place.googleMapsUri ?? null,
      };
    }

    return { googleRating: null, googleReviewCount: null, googleMapsUrl: null };
  } catch (error) {
    console.error(`Google Places lookup failed for "${name}":`, error);
    return { googleRating: null, googleReviewCount: null, googleMapsUrl: null };
  }
}

async function getCachedGooglePlace(cacheKey: string): Promise<GooglePlaceData | null> {
  try {
    const [row] = await db.select().from(googlePlacesCache)
      .where(eq(googlePlacesCache.cacheKey, cacheKey));

    if (!row || !row.createdAt) return null;

    const ageHours = (Date.now() - row.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > CACHE_TTL_HOURS) {
      await db.delete(googlePlacesCache).where(eq(googlePlacesCache.cacheKey, cacheKey));
      return null;
    }

    return {
      googleRating: row.googleRating,
      googleReviewCount: row.googleReviewCount,
      googleMapsUrl: row.googleMapsUrl,
    };
  } catch {
    return null;
  }
}

async function setCachedGooglePlace(cacheKey: string, data: GooglePlaceData): Promise<void> {
  try {
    await db.insert(googlePlacesCache).values({
      cacheKey,
      googleRating: data.googleRating,
      googleReviewCount: data.googleReviewCount,
      googleMapsUrl: data.googleMapsUrl,
    }).onConflictDoUpdate({
      target: googlePlacesCache.cacheKey,
      set: {
        googleRating: data.googleRating,
        googleReviewCount: data.googleReviewCount,
        googleMapsUrl: data.googleMapsUrl,
        createdAt: sql`now()`,
      },
    });
  } catch (error) {
    console.error("Failed to cache Google Place data:", error);
  }
}

interface GoogleReviewResult {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string };
  relativePublishTimeDescription?: string;
}

async function fetchGoogleReviews(
  name: string,
  address?: string,
  latitude?: number,
  longitude?: number,
): Promise<GoogleReview[]> {
  if (!GOOGLE_PLACES_API_KEY) return [];

  try {
    const textQuery = address ? `${name} ${address}` : name;
    const body: Record<string, unknown> = {
      textQuery,
      includedType: "restaurant",
      pageSize: 1,
    };
    if (latitude !== undefined && longitude !== undefined) {
      body.locationBias = {
        circle: { center: { latitude, longitude }, radius: 1000.0 },
      };
    }

    const response = await fetchGooglePlaces(GOOGLE_PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        // Reviews are returned in priority order (Google's "most helpful").
        // Up to 5 per place per request.
        "X-Goog-FieldMask": "places.reviews",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Reviews API error for "${name}":`, response.status, errorText);
      return [];
    }

    const data = (await response.json()) as { places?: Array<{ reviews?: GoogleReviewResult[] }> };
    const rawReviews = data.places?.[0]?.reviews ?? [];

    return rawReviews
      .map((r): GoogleReview | null => {
        const text = r.text?.text || r.originalText?.text;
        const rating = r.rating;
        if (!text || rating === undefined) return null;
        return {
          rating,
          text,
          author: r.authorAttribution?.displayName,
          publishedAt: r.relativePublishTimeDescription,
        };
      })
      .filter((r): r is GoogleReview => r !== null)
      .slice(0, 5);
  } catch (error) {
    console.error(`Google reviews fetch failed for "${name}":`, error);
    return [];
  }
}

export async function getCachedGoogleReviews(
  name: string,
  address?: string,
  latitude?: number,
  longitude?: number,
): Promise<GoogleReview[]> {
  const key = `${name}|${address ?? ""}`;
  const now = Date.now();
  const hit = reviewsCache.get(key);
  if (hit && hit.expiresAt > now) return hit.reviews;

  const reviews = await fetchGoogleReviews(name, address, latitude, longitude);
  reviewsCache.set(key, { reviews, expiresAt: now + REVIEWS_CACHE_TTL_MS });

  // Naive eviction: when over cap, drop ~10% of oldest entries by expiry. Keeps
  // memory bounded without the overhead of a real LRU library.
  if (reviewsCache.size > REVIEWS_CACHE_MAX) {
    const entries = Array.from(reviewsCache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toDrop = Math.ceil(REVIEWS_CACHE_MAX * 0.1);
    for (let i = 0; i < toDrop; i++) reviewsCache.delete(entries[i][0]);
  }

  return reviews;
}

export async function enrichRestaurantsWithGoogle(
  restaurants: Array<{
    id: string;
    name: string;
    latitude?: number;
    longitude?: number;
    address: string;
  }>
): Promise<Map<string, GooglePlaceData>> {
  const results = new Map<string, GooglePlaceData>();

  if (!GOOGLE_PLACES_API_KEY) {
    return results;
  }

  const BATCH_SIZE = 5;
  for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
    const batch = restaurants.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (r) => {
      const cacheKey = `${r.name}|${r.address}`;
      const cached = await getCachedGooglePlace(cacheKey);
      if (cached) {
        results.set(r.id, cached);
        return;
      }
      const data = await lookupGooglePlace(r.name, r.latitude, r.longitude, r.address);
      if (data.googleRating !== null) {
        await setCachedGooglePlace(cacheKey, data);
      }
      results.set(r.id, data);
    });
    await Promise.all(promises);
  }

  return results;
}
