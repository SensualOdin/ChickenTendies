export interface SwipeRecord {
  memberId: string;
  restaurantId: string;
  liked: boolean;
  superLiked?: boolean;
}

export interface RestaurantRecord {
  id: string;
  [key: string]: any;
}

export function findUnanimousMatches<T extends RestaurantRecord>(
  memberIds: string[],
  restaurants: T[],
  swipes: SwipeRecord[]
): T[] {
  const matches: T[] = [];

  for (const restaurant of restaurants) {
    const restaurantSwipes = swipes.filter(s => s.restaurantId === restaurant.id && s.liked);
    const likedByMembers = new Set(restaurantSwipes.map(s => s.memberId));

    if (memberIds.every(id => likedByMembers.has(id))) {
      matches.push(restaurant);
    }
  }

  return matches;
}

// Restaurants that have ≥2 likes from the group but aren't unanimous yet.
// Surfaces on the Matches page so a holdout can flip their swipe once they
// see who's already on board. Threshold of 2 (not "≥50%") because for a
// 2-person group the only meaningful outcome is unanimous-or-nothing, and
// requiring 2 likes keeps single-person noise out of the list for larger
// groups too.
export function findPartialMatches<T extends RestaurantRecord>(
  memberIds: string[],
  restaurants: T[],
  swipes: SwipeRecord[]
): Array<{ restaurant: T; likedByIds: string[] }> {
  const out: Array<{ restaurant: T; likedByIds: string[] }> = [];

  for (const restaurant of restaurants) {
    const likedByIds = swipes
      .filter(s => s.restaurantId === restaurant.id && s.liked)
      .map(s => s.memberId);
    const uniqueLikedBy = Array.from(new Set(likedByIds));

    if (uniqueLikedBy.length >= 2 && uniqueLikedBy.length < memberIds.length) {
      out.push({ restaurant, likedByIds: uniqueLikedBy });
    }
  }

  // Hottest partials first — the ones closest to unanimous.
  out.sort((a, b) => b.likedByIds.length - a.likedByIds.length);
  return out;
}

export function findMatchesWithSuperLikeBoost<T extends RestaurantRecord>(
  memberIds: string[],
  restaurants: T[],
  swipes: SwipeRecord[]
): T[] {
  const matches: T[] = [];

  for (const restaurant of restaurants) {
    const restaurantSwipes = swipes.filter(s => s.restaurantId === restaurant.id && s.liked);
    const likedByMembers = new Set(restaurantSwipes.map(s => s.memberId));
    const superLikeCount = restaurantSwipes.filter(s => s.superLiked).length;

    const allLiked = memberIds.every(id => likedByMembers.has(id));
    const hasSuperLikeBoost = superLikeCount >= 1 && likedByMembers.size >= Math.ceil(memberIds.length * 0.6);

    if (allLiked || hasSuperLikeBoost) {
      matches.push(restaurant);
    }
  }

  return matches;
}
