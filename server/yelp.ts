import type { Restaurant, GroupPreferences, CuisineType } from "@shared/schema";

const YELP_API_KEY = process.env.YELP_API_KEY;
const YELP_BASE_URL = "https://api.yelp.com/v3";

interface YelpBusiness {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  price?: string;
  image_url: string;
  url: string;
  categories: Array<{ alias: string; title: string }>;
  location: {
    address1: string;
    city: string;
    state: string;
    zip_code: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  phone?: string;
  display_phone?: string;
  transactions?: string[];
}

interface YelpSearchResponse {
  businesses: YelpBusiness[];
  total: number;
}

const cuisineToYelpCategory: Record<CuisineType, string> = {
  "Italian": "italian",
  "Mexican": "mexican",
  "Chinese": "chinese",
  "Japanese": "japanese",
  "Indian": "indpak",
  "Thai": "thai",
  "American": "tradamerican,newamerican",
  "Mediterranean": "mediterranean",
  "French": "french",
  "Korean": "korean",
  "Vietnamese": "vietnamese",
  "Greek": "greek",
  "Middle Eastern": "mideastern",
  "Spanish": "spanish",
  "Seafood": "seafood",
  "Steakhouse": "steak",
  "Pizza": "pizza",
  "Burger": "burgers",
  "Sushi": "sushi",
  "BBQ": "bbq",
};

function yelpPriceToRange(price: string | undefined): "$" | "$$" | "$$$" | "$$$$" {
  switch (price) {
    case "$": return "$";
    case "$$": return "$$";
    case "$$$": return "$$$";
    case "$$$$": return "$$$$";
    default: return "$$";
  }
}

function priceRangeToYelpPrice(priceRanges: ("$" | "$$" | "$$$" | "$$$$")[]): string {
  const priceMap: Record<string, string> = {
    "$": "1",
    "$$": "2",
    "$$$": "3",
    "$$$$": "4"
  };
  return priceRanges.map(p => priceMap[p]).join(",");
}

function detectCuisineFromCategories(categories: Array<{ alias: string; title: string }>): CuisineType {
  for (const cat of categories) {
    const alias = cat.alias.toLowerCase();
    const title = cat.title.toLowerCase();
    
    if (alias.includes("italian") || title.includes("italian")) return "Italian";
    if (alias.includes("mexican") || title.includes("mexican")) return "Mexican";
    if (alias.includes("chinese") || title.includes("chinese")) return "Chinese";
    if (alias.includes("japanese") || alias.includes("sushi")) return "Japanese";
    if (alias.includes("indpak") || title.includes("indian")) return "Indian";
    if (alias.includes("thai") || title.includes("thai")) return "Thai";
    if (alias.includes("korean") || title.includes("korean")) return "Korean";
    if (alias.includes("vietnamese") || title.includes("vietnamese")) return "Vietnamese";
    if (alias.includes("greek") || title.includes("greek")) return "Greek";
    if (alias.includes("mediterranean")) return "Mediterranean";
    if (alias.includes("french") || title.includes("french")) return "French";
    if (alias.includes("spanish") || title.includes("spanish")) return "Spanish";
    if (alias.includes("seafood")) return "Seafood";
    if (alias.includes("steak")) return "Steakhouse";
    if (alias.includes("pizza")) return "Pizza";
    if (alias.includes("burger")) return "Burger";
    if (alias.includes("bbq") || alias.includes("barbecue")) return "BBQ";
    if (alias.includes("mideastern") || title.includes("middle eastern")) return "Middle Eastern";
  }
  
  return "American";
}

function metersToMiles(meters: number): number {
  return Math.round((meters / 1609.34) * 10) / 10;
}

const excludedCategories = new Set([
  "coffee", "coffeeshops", "cafes", "bakeries", "desserts", "icecream",
  "donuts", "juicebars", "bubbletea", "acaibowls", "cakeshop", "cupcakes",
  "cookies", "candy", "chocolatiers", "gelato", "froyo", "waffles",
  "creperies", "pretzels", "popcorn", "shavedice", "tea", "breweries",
  "winebars", "cocktailbars", "divebars", "sportsbars", "pubs", "lounges",
  "hookah", "karaoke", "danceclubs", "jazzandblues", "musicvenues",
  "foodtrucks", "foodstands", "hotdog", "catering", "personalchefs"
]);

function isActualRestaurant(categories: Array<{ alias: string; title: string }>): boolean {
  const validRestaurantCategories = [
    "restaurants", "italian", "mexican", "chinese", "japanese", "indian",
    "thai", "american", "mediterranean", "french", "korean", "vietnamese",
    "greek", "mideastern", "spanish", "seafood", "steak", "pizza", "burgers",
    "sushi", "bbq", "newamerican", "tradamerican", "asianfusion", "latin",
    "caribbean", "southern", "soulfood", "cajun", "brazilian", "peruvian",
    "turkish", "lebanese", "ethiopian", "african", "german", "british",
    "irish", "polish", "russian", "hawaiian", "filipino", "malaysian",
    "indonesian", "singaporean", "taiwanese", "dimsum", "ramen", "poke",
    "tacos", "burritos", "sandwiches", "delis", "diners", "breakfast_brunch",
    "brunch", "gastropubs", "bistros", "brasseries"
  ];

  for (const cat of categories) {
    const alias = cat.alias.toLowerCase();
    if (excludedCategories.has(alias)) {
      return false;
    }
  }

  for (const cat of categories) {
    const alias = cat.alias.toLowerCase();
    if (validRestaurantCategories.some(valid => alias.includes(valid))) {
      return true;
    }
  }

  return categories.some(cat => 
    cat.alias.toLowerCase().includes("restaurant") || 
    cat.title.toLowerCase().includes("restaurant")
  );
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function fetchRestaurantsFromYelp(preferences: GroupPreferences, offset: number = 0): Promise<Restaurant[]> {
  if (!YELP_API_KEY) {
    console.log("No Yelp API key found, using mock data");
    return [];
  }

  const restaurants: Restaurant[] = [];
  const seenIds = new Set<string>();
  
  const radiusMeters = Math.min(Math.round(preferences.radius * 1609.34), 40000);
  
  const categories = preferences.cuisineTypes.length > 0
    ? preferences.cuisineTypes.map(c => cuisineToYelpCategory[c]).join(",")
    : "restaurants";

  const sortOptions = ["rating", "review_count", "distance"];
  const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
  const yelpOffset = offset > 0 ? offset : Math.floor(Math.random() * 30);

  const params = new URLSearchParams({
    categories: categories,
    radius: radiusMeters.toString(),
    limit: "50",
    sort_by: randomSort,
    offset: yelpOffset.toString()
  });

  // Use GPS coordinates if available, otherwise use location string (zip/address)
  if (preferences.latitude !== undefined && preferences.longitude !== undefined) {
    params.append("latitude", preferences.latitude.toString());
    params.append("longitude", preferences.longitude.toString());
  } else {
    params.append("location", preferences.zipCode);
  }

  if (preferences.priceRange.length > 0) {
    params.append("price", priceRangeToYelpPrice(preferences.priceRange));
  }

  try {
    const url = `${YELP_BASE_URL}/businesses/search?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${YELP_API_KEY}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Yelp API error:", response.status, errorText);
      return [];
    }

    const data: YelpSearchResponse = await response.json();

    for (const business of data.businesses) {
      if (seenIds.has(business.id)) continue;
      
      if (!isActualRestaurant(business.categories)) {
        continue;
      }
      
      seenIds.add(business.id);

      const priceRange = yelpPriceToRange(business.price);
      const distance = business.distance ? metersToMiles(business.distance) : 0;

      const transactions = business.transactions || [];
      const highlights: string[] = [];
      const categoryAliases = business.categories.map(c => c.alias.toLowerCase());
      const categoryTitles = business.categories.map(c => c.title.toLowerCase()).join(" ");
      
      // Quality indicators
      if (business.rating >= 4.5) highlights.push("Highly Rated");
      if (business.review_count > 500) highlights.push("Popular Spot");
      
      // Vibe/occasion tags
      const isUpscale = priceRange === "$$$" || priceRange === "$$$$";
      const isRomantic = categoryTitles.includes("wine") || categoryTitles.includes("french") || 
                        categoryTitles.includes("italian") || categoryAliases.includes("cocktailbars");
      if (isUpscale && business.rating >= 4.0) highlights.push("Date Night");
      if (categoryTitles.includes("brunch") || categoryTitles.includes("breakfast")) highlights.push("Brunch Spot");
      if (categoryAliases.some(a => a.includes("burger") || a.includes("pizza") || a.includes("wings"))) {
        highlights.push("Casual Eats");
      }
      if (categoryAliases.some(a => a.includes("sushi") || a.includes("ramen"))) {
        highlights.push("Japanese Cuisine");
      }
      
      // Service options
      if (transactions.includes("reservation")) highlights.push("Reservations");
      if (transactions.includes("delivery")) highlights.push("Delivery");
      if (transactions.includes("pickup")) highlights.push("Pickup");

      const restaurant: Restaurant = {
        id: business.id,
        name: business.name,
        cuisine: detectCuisineFromCategories(business.categories),
        priceRange,
        rating: business.rating,
        reviewCount: business.review_count,
        imageUrl: business.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
        address: `${business.location.address1}, ${business.location.city}`,
        distance,
        dietaryOptions: [],
        description: `${business.rating} star rated with ${business.review_count} reviews. ${business.categories.map(c => c.title).join(", ")}.`,
        yelpUrl: business.url,
        latitude: business.coordinates?.latitude,
        longitude: business.coordinates?.longitude,
        phone: business.display_phone,
        transactions,
        highlights,
      };

      restaurants.push(restaurant);
    }
  } catch (error) {
    console.error("Error fetching from Yelp:", error);
    return [];
  }

  console.log(`Yelp returned ${restaurants.length} restaurants for location "${preferences.zipCode}" (radius: ${preferences.radius}mi)`);

  if (restaurants.length === 0) {
    return [];
  }

  let filteredRestaurants = [...restaurants];

  const maxDistance = preferences.radius;
  filteredRestaurants = filteredRestaurants.filter(r => r.distance === 0 || r.distance <= maxDistance);
  console.log(`After radius filter (${maxDistance}mi): ${filteredRestaurants.length} remaining`);

  if (preferences.minRating && preferences.minRating > 0) {
    filteredRestaurants = filteredRestaurants.filter(r => r.rating >= preferences.minRating!);
    console.log(`After rating filter (>=${preferences.minRating}): ${filteredRestaurants.length} remaining`);
  }

  if (preferences.excludeCuisines && preferences.excludeCuisines.length > 0) {
    filteredRestaurants = filteredRestaurants.filter(r => 
      !preferences.excludeCuisines!.includes(r.cuisine)
    );
    console.log(`After cuisine exclusion filter: ${filteredRestaurants.length} remaining`);
  }

  if (filteredRestaurants.length === 0) {
    console.log("All restaurants filtered out — returning unfiltered Yelp results instead of mock data");
    filteredRestaurants = [...restaurants];
  }

  filteredRestaurants.sort((a, b) => a.distance - b.distance);
  
  return filteredRestaurants.slice(0, 20);
}
