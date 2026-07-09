import { cuisineTypes, type CuisineType } from "@shared/schema";

// Default popularity ordering — the first 12 (after exclusions) form the default deck.
const POPULARITY_ORDER: CuisineType[] = [
  "Burger", "Pizza", "Mexican", "BBQ", "Italian", "Chinese",
  "Sushi", "American", "Thai", "Japanese", "Indian", "Mediterranean",
  "Korean", "Vietnamese", "Greek", "Middle Eastern", "French",
  "Spanish", "Seafood", "Steakhouse",
];

const DECK_CAP = 12;

// Deterministic PRNG (mulberry32) so a seed yields a stable shuffle.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface BuildDeckOpts {
  excludeCuisines: string[];
  trySomethingNew: boolean;
  matchedBefore: string[];
  seed: number;
}

export function buildCuisineDeck(opts: BuildDeckOpts): CuisineType[] {
  const excluded = new Set<string>(opts.excludeCuisines);
  if (opts.trySomethingNew) {
    for (const c of opts.matchedBefore) excluded.add(c);
  }
  const ordered = POPULARITY_ORDER.filter((c) => cuisineTypes.includes(c));
  const pool = ordered.filter((c) => !excluded.has(c));
  const capped = pool.slice(0, DECK_CAP);
  return shuffle(capped, mulberry32(opts.seed));
}

export interface CuisineVoteRecord {
  memberId: string;
  cuisine: string;
  liked: boolean;
}

// The cuisine (if any) that every currently-present member has liked.
export function findUnanimousCuisine(
  memberIds: string[],
  votes: CuisineVoteRecord[],
): string | null {
  if (memberIds.length === 0) return null;
  const byCuisine = new Map<string, Set<string>>();
  for (const v of votes) {
    if (!v.liked) continue;
    if (!byCuisine.has(v.cuisine)) byCuisine.set(v.cuisine, new Set());
    byCuisine.get(v.cuisine)!.add(v.memberId);
  }
  for (const [cuisine, likers] of Array.from(byCuisine.entries())) {
    if (memberIds.every((id) => likers.has(id))) return cuisine;
  }
  return null;
}

// Winner + up to two runners-up (each with >=1 like), ordered by like count then deck position.
// Empty when nobody liked anything.
export function resolveCuisineWinners(
  memberIds: string[],
  votes: CuisineVoteRecord[],
  deck: string[],
): string[] {
  const likeCount = new Map<string, number>();
  for (const c of deck) likeCount.set(c, 0);
  for (const v of votes) {
    if (v.liked && likeCount.has(v.cuisine)) {
      likeCount.set(v.cuisine, likeCount.get(v.cuisine)! + 1);
    }
  }
  const ranked = deck
    .filter((c) => (likeCount.get(c) || 0) > 0)
    .sort((a, b) => {
      const diff = likeCount.get(b)! - likeCount.get(a)!;
      if (diff !== 0) return diff;
      return deck.indexOf(a) - deck.indexOf(b);
    });
  return ranked.slice(0, 3);
}
