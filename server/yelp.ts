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

export async function fetchRestaurantsFromYelp(preferences: GroupPreferences): Promise<Restaurant[]> {
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

  const params = new URLSearchParams({
    location: preferences.zipCode,
    categories: categories,
    radius: radiusMeters.toString(),
    limit: "50",
    sort_by: "rating"
  });

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
        longitude: business.coordinates?.longitude
      };

      restaurants.push(restaurant);
    }
  } catch (error) {
    console.error("Error fetching from Yelp:", error);
    return [];
  }

  restaurants.sort((a, b) => b.rating - a.rating);
  
  return restaurants.slice(0, 20);
}
