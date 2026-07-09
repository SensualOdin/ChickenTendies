import { describe, it, expect } from "vitest";
import { buildCuisineDeck, resolveCuisineWinners, findUnanimousCuisine } from "../cuisine-round";
import type { CuisineVoteRecord } from "../cuisine-round";
import { cuisineTypes } from "@shared/schema";

describe("buildCuisineDeck", () => {
  it("caps the deck at 12 cards", () => {
    const deck = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: [], seed: 1 });
    expect(deck.length).toBe(12);
  });

  it("excludes cuisines in excludeCuisines", () => {
    const deck = buildCuisineDeck({ excludeCuisines: ["Burger", "Pizza"], trySomethingNew: false, matchedBefore: [], seed: 1 });
    expect(deck).not.toContain("Burger");
    expect(deck).not.toContain("Pizza");
  });

  it("hides previously-matched cuisines when trySomethingNew is on", () => {
    const deck = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: true, matchedBefore: ["Thai"], seed: 1 });
    expect(deck).not.toContain("Thai");
  });

  it("does NOT hide matched cuisines when trySomethingNew is off", () => {
    const deckA = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: ["Thai"], seed: 1 });
    const deckB = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: [], seed: 1 });
    expect(deckA).toEqual(deckB);
  });

  it("is deterministic for the same seed", () => {
    const a = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: [], seed: 42 });
    const b = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: [], seed: 42 });
    expect(a).toEqual(b);
  });

  it("returns fewer than 12 when exclusions shrink the pool", () => {
    const keep = ["Burger", "Pizza", "Thai"];
    const exclude = cuisineTypes.filter((c) => !keep.includes(c));
    const deck = buildCuisineDeck({ excludeCuisines: exclude, trySomethingNew: false, matchedBefore: [], seed: 1 });
    expect(deck.length).toBe(3);
  });

  it("only returns valid cuisine types", () => {
    const deck = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: [], seed: 7 });
    for (const c of deck) expect(cuisineTypes).toContain(c);
  });
});

describe("findUnanimousCuisine", () => {
  it("returns the cuisine every present member liked", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Thai", liked: true },
      { memberId: "m2", cuisine: "Thai", liked: true },
    ];
    expect(findUnanimousCuisine(["m1", "m2"], votes)).toBe("Thai");
  });

  it("returns null when not everyone liked the same one", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Thai", liked: true },
      { memberId: "m2", cuisine: "Thai", liked: false },
    ];
    expect(findUnanimousCuisine(["m1", "m2"], votes)).toBeNull();
  });

  it("returns null for empty member list", () => {
    expect(findUnanimousCuisine([], [])).toBeNull();
  });

  it("works for a solo member (their like is unanimous)", () => {
    const votes: CuisineVoteRecord[] = [{ memberId: "m1", cuisine: "Sushi", liked: true }];
    expect(findUnanimousCuisine(["m1"], votes)).toBe("Sushi");
  });
});

describe("resolveCuisineWinners", () => {
  const deck = ["Burger", "Pizza", "Thai", "Sushi"];

  it("returns the unanimous/most-liked cuisine first", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Thai", liked: true },
      { memberId: "m2", cuisine: "Thai", liked: true },
    ];
    const winners = resolveCuisineWinners(["m1", "m2"], votes, [...deck]);
    expect(winners[0]).toBe("Thai");
  });

  it("picks the most-liked cuisine when no unanimous pick", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Burger", liked: true },
      { memberId: "m2", cuisine: "Burger", liked: true },
      { memberId: "m1", cuisine: "Pizza", liked: false },
      { memberId: "m2", cuisine: "Pizza", liked: true },
    ];
    const winners = resolveCuisineWinners(["m1", "m2"], votes, [...deck]);
    expect(winners[0]).toBe("Burger");
  });

  it("includes up to two runners-up (with >=1 like) after the winner, excludes zero-like", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Burger", liked: true },
      { memberId: "m2", cuisine: "Burger", liked: true },
      { memberId: "m1", cuisine: "Pizza", liked: true },
      { memberId: "m1", cuisine: "Thai", liked: true },
      { memberId: "m2", cuisine: "Sushi", liked: false },
    ];
    const winners = resolveCuisineWinners(["m1", "m2"], votes, [...deck]);
    expect(winners[0]).toBe("Burger");
    expect(winners.length).toBeLessThanOrEqual(3);
    expect(winners).not.toContain("Sushi");
  });

  it("returns empty array when nobody liked anything", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Burger", liked: false },
      { memberId: "m2", cuisine: "Pizza", liked: false },
    ];
    const winners = resolveCuisineWinners(["m1", "m2"], votes, [...deck]);
    expect(winners).toEqual([]);
  });

  it("breaks ties by deck order", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Pizza", liked: true },
      { memberId: "m1", cuisine: "Thai", liked: true },
    ];
    const winners = resolveCuisineWinners(["m1"], votes, [...deck]);
    expect(winners[0]).toBe("Pizza");
  });
});
