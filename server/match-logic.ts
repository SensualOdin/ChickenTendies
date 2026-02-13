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
