import { describe, it, expect } from "vitest";
import { findUnanimousMatches, findMatchesWithSuperLikeBoost, findPartialMatches } from "../match-logic";
import type { SwipeRecord, RestaurantRecord } from "../match-logic";

const restaurants: RestaurantRecord[] = [
  { id: "r1", name: "Pizza Place" },
  { id: "r2", name: "Sushi Spot" },
  { id: "r3", name: "Burger Joint" },
];

describe("findUnanimousMatches", () => {
  it("matches when all members like a restaurant", () => {
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
      { memberId: "m3", restaurantId: "r1", liked: true },
    ];
    const result = findUnanimousMatches(["m1", "m2", "m3"], restaurants, swipes);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r1");
  });

  it("no match when one member dislikes", () => {
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: false },
      { memberId: "m3", restaurantId: "r1", liked: true },
    ];
    const result = findUnanimousMatches(["m1", "m2", "m3"], restaurants, swipes);
    expect(result).toHaveLength(0);
  });

  it("no match when a member hasn't swiped yet", () => {
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
    ];
    const result = findUnanimousMatches(["m1", "m2", "m3"], restaurants, swipes);
    expect(result).toHaveLength(0);
  });

  it("finds multiple matches", () => {
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
      { memberId: "m1", restaurantId: "r2", liked: true },
      { memberId: "m2", restaurantId: "r2", liked: true },
      { memberId: "m1", restaurantId: "r3", liked: false },
      { memberId: "m2", restaurantId: "r3", liked: true },
    ];
    const result = findUnanimousMatches(["m1", "m2"], restaurants, swipes);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toContain("r1");
    expect(result.map(r => r.id)).toContain("r2");
  });

  it("handles single member group", () => {
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
    ];
    const result = findUnanimousMatches(["m1"], restaurants, swipes);
    expect(result).toHaveLength(1);
  });

  it("handles empty swipes", () => {
    const result = findUnanimousMatches(["m1", "m2"], restaurants, []);
    expect(result).toHaveLength(0);
  });
});

describe("findMatchesWithSuperLikeBoost", () => {
  it("matches with super-like boost at 60% threshold (3 of 5 members)", () => {
    const memberIds = ["m1", "m2", "m3", "m4", "m5"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true, superLiked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
      { memberId: "m3", restaurantId: "r1", liked: true },
    ];
    const result = findMatchesWithSuperLikeBoost(memberIds, restaurants, swipes);
    expect(result).toHaveLength(1);
  });

  it("no match with super-like but below 60% threshold", () => {
    const memberIds = ["m1", "m2", "m3", "m4", "m5"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true, superLiked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
    ];
    const result = findMatchesWithSuperLikeBoost(memberIds, restaurants, swipes);
    expect(result).toHaveLength(0);
  });

  it("no match without super-like even at 60% threshold", () => {
    const memberIds = ["m1", "m2", "m3", "m4", "m5"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
      { memberId: "m3", restaurantId: "r1", liked: true },
    ];
    const result = findMatchesWithSuperLikeBoost(memberIds, restaurants, swipes);
    expect(result).toHaveLength(0);
  });

  it("matches unanimously without super-like", () => {
    const memberIds = ["m1", "m2"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
    ];
    const result = findMatchesWithSuperLikeBoost(memberIds, restaurants, swipes);
    expect(result).toHaveLength(1);
  });

  it("super-like boost with 2 members needs both (ceil of 0.6*2 = 2)", () => {
    const memberIds = ["m1", "m2"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true, superLiked: true },
    ];
    const result = findMatchesWithSuperLikeBoost(memberIds, restaurants, swipes);
    expect(result).toHaveLength(0);
  });

  it("super-like boost with 3 members needs 2 (ceil of 0.6*3 = 2)", () => {
    const memberIds = ["m1", "m2", "m3"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true, superLiked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
    ];
    const result = findMatchesWithSuperLikeBoost(memberIds, restaurants, swipes);
    expect(result).toHaveLength(1);
  });
});

describe("findPartialMatches", () => {
  it("returns restaurants with ≥2 likes but not unanimous", () => {
    const memberIds = ["m1", "m2", "m3", "m4"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
      // r1: 2/4 liked → partial
      { memberId: "m1", restaurantId: "r2", liked: true },
      // r2: 1/4 liked → excluded (not enough)
      { memberId: "m1", restaurantId: "r3", liked: true },
      { memberId: "m2", restaurantId: "r3", liked: true },
      { memberId: "m3", restaurantId: "r3", liked: true },
      { memberId: "m4", restaurantId: "r3", liked: true },
      // r3: 4/4 liked → excluded (unanimous, belongs in main matches)
    ];
    const result = findPartialMatches(memberIds, restaurants, swipes);
    expect(result).toHaveLength(1);
    expect(result[0].restaurant.id).toBe("r1");
    expect(result[0].likedByIds.sort()).toEqual(["m1", "m2"]);
  });

  it("ignores dislikes when counting likes", () => {
    const memberIds = ["m1", "m2", "m3"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
      { memberId: "m3", restaurantId: "r1", liked: false },
    ];
    const result = findPartialMatches(memberIds, restaurants, swipes);
    expect(result).toHaveLength(1);
    expect(result[0].likedByIds).not.toContain("m3");
  });

  it("returns nothing for a 2-person group (unanimous-or-nothing)", () => {
    const memberIds = ["m1", "m2"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      // 1/2 — wouldn't be useful info, group is too small
    ];
    const result = findPartialMatches(memberIds, restaurants, swipes);
    expect(result).toHaveLength(0);
  });

  it("sorts hottest partials first (most likes)", () => {
    const memberIds = ["m1", "m2", "m3", "m4", "m5"];
    const swipes: SwipeRecord[] = [
      // r1: 2 likes
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m2", restaurantId: "r1", liked: true },
      // r2: 4 likes (closer to unanimous)
      { memberId: "m1", restaurantId: "r2", liked: true },
      { memberId: "m2", restaurantId: "r2", liked: true },
      { memberId: "m3", restaurantId: "r2", liked: true },
      { memberId: "m4", restaurantId: "r2", liked: true },
      // r3: 3 likes
      { memberId: "m1", restaurantId: "r3", liked: true },
      { memberId: "m2", restaurantId: "r3", liked: true },
      { memberId: "m3", restaurantId: "r3", liked: true },
    ];
    const result = findPartialMatches(memberIds, restaurants, swipes);
    expect(result.map(p => p.restaurant.id)).toEqual(["r2", "r3", "r1"]);
  });

  it("dedupes duplicate likes from the same member (defensive)", () => {
    const memberIds = ["m1", "m2", "m3"];
    const swipes: SwipeRecord[] = [
      { memberId: "m1", restaurantId: "r1", liked: true },
      { memberId: "m1", restaurantId: "r1", liked: true },
      // Same member, same restaurant — should count as 1, not 2
    ];
    const result = findPartialMatches(memberIds, restaurants, swipes);
    expect(result).toHaveLength(0); // only 1 unique liker, below threshold of 2
  });
});
