import type { CuisineType } from "@shared/schema";

export interface CuisineVisual {
  emoji: string;
  from: string;
  to: string;
  tagline: string;
  dishes: string[];
}

export const CUISINE_VISUALS: Record<CuisineType, CuisineVisual> = {
  Burger: {
    emoji: "🍔",
    from: "#F9A825",
    to: "#BF5F1F",
    tagline: "Stacked patties & crispy fries",
    dishes: ["Cheeseburger", "Fries", "Shakes"],
  },
  Pizza: {
    emoji: "🍕",
    from: "#EF6C00",
    to: "#FDD835",
    tagline: "Slices, pies & melty cheese",
    dishes: ["Pepperoni", "Margherita", "Calzone"],
  },
  Mexican: {
    emoji: "🌮",
    from: "#E65100",
    to: "#43A047",
    tagline: "Tacos, al pastor & fresh lime",
    dishes: ["Tacos", "Burritos", "Guac"],
  },
  BBQ: {
    emoji: "🍖",
    from: "#4E342E",
    to: "#FF6F00",
    tagline: "Low & slow smoked everything",
    dishes: ["Brisket", "Ribs", "Pulled Pork"],
  },
  Italian: {
    emoji: "🍝",
    from: "#C62828",
    to: "#F9A825",
    tagline: "Pasta, wood-fired & la dolce vita",
    dishes: ["Pasta", "Lasagna", "Risotto"],
  },
  Chinese: {
    emoji: "🥡",
    from: "#D32F2F",
    to: "#FF8F00",
    tagline: "Dumplings, noodles & wok-fire",
    dishes: ["Dumplings", "Lo Mein", "Fried Rice"],
  },
  Sushi: {
    emoji: "🍣",
    from: "#263238",
    to: "#26C6DA",
    tagline: "Nigiri, rolls & omakase",
    dishes: ["Nigiri", "Rolls", "Sashimi"],
  },
  American: {
    emoji: "🍗",
    from: "#1565C0",
    to: "#E53935",
    tagline: "Comfort classics & diner faves",
    dishes: ["Wings", "Mac & Cheese", "Meatloaf"],
  },
  Thai: {
    emoji: "🍤",
    from: "#00897B",
    to: "#7CB342",
    tagline: "Pad thai, curry & thai basil",
    dishes: ["Pad Thai", "Green Curry", "Tom Yum"],
  },
  Japanese: {
    emoji: "🍱",
    from: "#37474F",
    to: "#EC407A",
    tagline: "Ramen, tempura & izakaya vibes",
    dishes: ["Ramen", "Tempura", "Katsu"],
  },
  Indian: {
    emoji: "🍛",
    from: "#F57C00",
    to: "#C2185B",
    tagline: "Curry, naan & tandoori heat",
    dishes: ["Tikka Masala", "Naan", "Biryani"],
  },
  Mediterranean: {
    emoji: "🫒",
    from: "#0277BD",
    to: "#9CCC65",
    tagline: "Mezze, grilled fish & olive oil",
    dishes: ["Falafel", "Hummus", "Kebabs"],
  },
  Korean: {
    emoji: "🍲",
    from: "#B71C1C",
    to: "#FF7043",
    tagline: "KBBQ, bibimbap & banchan",
    dishes: ["KBBQ", "Bibimbap", "Kimchi"],
  },
  Vietnamese: {
    emoji: "🍜",
    from: "#2E7D32",
    to: "#FDD835",
    tagline: "Pho, banh mi & fresh herbs",
    dishes: ["Pho", "Banh Mi", "Spring Rolls"],
  },
  Greek: {
    emoji: "🥙",
    from: "#1976D2",
    to: "#64B5F6",
    tagline: "Gyros, souvlaki & feta",
    dishes: ["Gyros", "Souvlaki", "Spanakopita"],
  },
  "Middle Eastern": {
    emoji: "🧆",
    from: "#6D4C41",
    to: "#FFB300",
    tagline: "Falafel, shawarma & hummus",
    dishes: ["Shawarma", "Falafel", "Kebab"],
  },
  French: {
    emoji: "🥐",
    from: "#283593",
    to: "#EF9A9A",
    tagline: "Bistro classics & buttery everything",
    dishes: ["Croissant", "Coq au Vin", "Crêpes"],
  },
  Spanish: {
    emoji: "🥘",
    from: "#C62828",
    to: "#FBC02D",
    tagline: "Paella, tapas & sangria",
    dishes: ["Paella", "Tapas", "Churros"],
  },
  Seafood: {
    emoji: "🦞",
    from: "#01579B",
    to: "#4DD0E1",
    tagline: "Fresh catch, oysters & raw bar",
    dishes: ["Lobster", "Oysters", "Ceviche"],
  },
  Steakhouse: {
    emoji: "🥩",
    from: "#3E2723",
    to: "#D84315",
    tagline: "Prime cuts & classic sides",
    dishes: ["Ribeye", "Filet", "Creamed Spinach"],
  },
};
