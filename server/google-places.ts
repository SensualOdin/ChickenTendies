import type { Restaurant, GroupPreferences, CuisineType, DietaryRestriction } from "@shared/schema";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: Array<{ photo_reference: string }>;
  types?: string[];
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface NearbySearchResponse {
  results: PlaceResult[];
  status: string;
  error_message?: string;
}

interface GeocodingResponse {
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
  status: string;
}

const cuisineToKeyword: Record<CuisineType, string> = {
  "Italian": "italian restaurant",
  "Mexican": "mexican restaurant",
  "Chinese": "chinese restaurant",
  "Japanese": "japanese restaurant",
  "Indian": "indian restaurant",
  "Thai": "thai restaurant",
  "American": "american restaurant",
  "Mediterranean": "mediterranean restaurant",
  "French": "french restaurant",
  "Korean": "korean restaurant",
  "Vietnamese": "vietnamese restaurant",
  "Greek": "greek restaurant",
  "Middle Eastern": "middle eastern restaurant",
  "Spanish": "spanish restaurant",
  "Seafood": "seafood restaurant",
  "Steakhouse": "steakhouse",
  "Pizza": "pizza restaurant",
  "Burger": "burger restaurant",
  "Sushi": "sushi restaurant",
  "BBQ": "bbq restaurant",
};

function priceLevelToRange(priceLevel: number | undefined): "$" | "$$" | "$$$" | "$$$$" {
  switch (priceLevel) {
    case 0:
    case 1:
      return "$";
    case 2:
      return "$$";
    case 3:
      return "$$$";
    case 4:
      return "$$$$";
    default:
      return "$$";
  }
}

function detectCuisineFromTypes(types: string[] = [], name: string = ""): CuisineType {
  const lowerName = name.toLowerCase();
  const typeStr = types.join(" ").toLowerCase();
  
  if (lowerName.includes("italian") || typeStr.includes("italian")) return "Italian";
  if (lowerName.includes("mexican") || typeStr.includes("mexican")) return "Mexican";
  if (lowerName.includes("chinese") || typeStr.includes("chinese")) return "Chinese";
  if (lowerName.includes("japanese") || lowerName.includes("sushi") || typeStr.includes("japanese")) return "Japanese";
  if (lowerName.includes("indian") || typeStr.includes("indian")) return "Indian";
  if (lowerName.includes("thai") || typeStr.includes("thai")) return "Thai";
  if (lowerName.includes("korean") || typeStr.includes("korean")) return "Korean";
  if (lowerName.includes("vietnamese") || lowerName.includes("pho")) return "Vietnamese";
  if (lowerName.includes("greek") || typeStr.includes("greek")) return "Greek";
  if (lowerName.includes("mediterranean")) return "Mediterranean";
  if (lowerName.includes("french") || typeStr.includes("french")) return "French";
  if (lowerName.includes("spanish") || lowerName.includes("tapas")) return "Spanish";
  if (lowerName.includes("seafood") || lowerName.includes("fish")) return "Seafood";
  if (lowerName.includes("steak") || lowerName.includes("grill")) return "Steakhouse";
  if (lowerName.includes("pizza") || lowerName.includes("pizzeria")) return "Pizza";
  if (lowerName.includes("burger")) return "Burger";
  if (lowerName.includes("bbq") || lowerName.includes("barbecue")) return "BBQ";
  if (lowerName.includes("middle eastern") || lowerName.includes("falafel") || lowerName.includes("kebab")) return "Middle Eastern";
  
  return "American";
}

function generateDescription(place: PlaceResult): string {
  const rating = place.rating ? `${place.rating} star rated` : "Popular";
  const reviewCount = place.user_ratings_total || 0;
  return `${rating} restaurant with ${reviewCount} reviews. Located at ${place.vicinity || place.formatted_address || "nearby"}.`;
}

function getPhotoUrl(photoReference: string): string {
  if (!GOOGLE_PLACES_API_KEY) {
    return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop";
  }
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

async function geocodeZipCode(zipCode: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zipCode)}&key=${GOOGLE_PLACES_API_KEY}`;
    const response = await fetch(url);
    const data: GeocodingResponse = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].geometry.location;
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function fetchRestaurantsFromGoogle(preferences: GroupPreferences): Promise<Restaurant[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.log("No Google Places API key found, using mock data");
    return [];
  }

  const location = await geocodeZipCode(preferences.zipCode);
  if (!location) {
    console.log("Could not geocode zip code, using mock data");
    return [];
  }

  const radiusMeters = Math.min(preferences.radius * 1609.34, 50000);
  const restaurants: Restaurant[] = [];
  const seenIds = new Set<string>();

  const keywords = preferences.cuisineTypes.length > 0 
    ? preferences.cuisineTypes.map(c => cuisineToKeyword[c])
    : ["restaurant"];

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radiusMeters}&type=restaurant&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_PLACES_API_KEY}`;
      
      const response = await fetch(url);
      const data: NearbySearchResponse = await response.json();

      if (data.status !== "OK") {
        console.log(`Google Places API error for ${keyword}:`, data.status, data.error_message);
        continue;
      }

      for (const place of data.results) {
        if (seenIds.has(place.place_id)) continue;
        seenIds.add(place.place_id);

        const priceRange = priceLevelToRange(place.price_level);
        
        if (preferences.priceRange.length > 0 && !preferences.priceRange.includes(priceRange)) {
          continue;
        }

        const distance = place.geometry 
          ? calculateDistance(location.lat, location.lng, place.geometry.location.lat, place.geometry.location.lng)
          : 0;

        const imageUrl = place.photos && place.photos.length > 0
          ? getPhotoUrl(place.photos[0].photo_reference)
          : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop";

        const restaurant: Restaurant = {
          id: place.place_id,
          name: place.name,
          cuisine: detectCuisineFromTypes(place.types, place.name),
          priceRange,
          rating: place.rating || 4.0,
          reviewCount: place.user_ratings_total || 0,
          imageUrl,
          address: place.vicinity || place.formatted_address || "",
          distance: Math.round(distance * 10) / 10,
          dietaryOptions: [],
          description: generateDescription(place)
        };

        restaurants.push(restaurant);
      }
    } catch (error) {
      console.error(`Error fetching restaurants for ${keyword}:`, error);
    }
  }

  restaurants.sort((a, b) => b.rating - a.rating);
  
  return restaurants.slice(0, 20);
}
