const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

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

    const response = await fetch(GOOGLE_PLACES_URL, {
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

const googleCache = new Map<string, GooglePlaceData>();

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
      if (googleCache.has(cacheKey)) {
        results.set(r.id, googleCache.get(cacheKey)!);
        return;
      }
      const data = await lookupGooglePlace(r.name, r.latitude, r.longitude, r.address);
      googleCache.set(cacheKey, data);
      results.set(r.id, data);
    });
    await Promise.all(promises);
  }

  return results;
}
