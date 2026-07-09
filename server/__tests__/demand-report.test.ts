import { describe, it, expect } from "vitest";
import {
  clampReportDays,
  shapeDemandReport,
  CLIENT_ANALYTICS_ACTIONS,
  OUTCOME_ACTIONS,
  type DemandReportRows,
} from "../analytics";

function emptyRows(overrides: Partial<DemandReportRows> = {}): DemandReportRows {
  return {
    windowDays: 7,
    actionRows: [],
    uniqueUsers: 0,
    cuisineRows: [],
    restaurantRows: [],
    dayRows: [],
    hourRows: [],
    ...overrides,
  };
}

describe("clampReportDays", () => {
  it("defaults to 7 for missing/invalid input", () => {
    expect(clampReportDays(undefined)).toBe(7);
    expect(clampReportDays(null)).toBe(7);
    expect(clampReportDays("")).toBe(7);
    expect(clampReportDays("abc")).toBe(7);
    expect(clampReportDays(NaN)).toBe(7);
    expect(clampReportDays({})).toBe(7);
  });

  it("passes through values in the 1-90 range", () => {
    expect(clampReportDays(1)).toBe(1);
    expect(clampReportDays(7)).toBe(7);
    expect(clampReportDays("30")).toBe(30);
    expect(clampReportDays(90)).toBe(90);
  });

  it("clamps out-of-range values", () => {
    expect(clampReportDays(0)).toBe(1);
    expect(clampReportDays(-5)).toBe(1);
    expect(clampReportDays(91)).toBe(90);
    expect(clampReportDays("100000")).toBe(90);
  });

  it("truncates fractional values", () => {
    expect(clampReportDays(7.9)).toBe(7);
  });
});

describe("CLIENT_ANALYTICS_ACTIONS allowlist", () => {
  it("accepts existing swipe actions", () => {
    for (const a of ["swipe_left", "swipe_right", "super_like", "click_details"]) {
      expect(CLIENT_ANALYTICS_ACTIONS.has(a)).toBe(true);
    }
  });

  it("accepts the new match-card outcome actions", () => {
    for (const a of OUTCOME_ACTIONS) {
      expect(CLIENT_ANALYTICS_ACTIONS.has(a)).toBe(true);
      expect(a.length).toBeLessThanOrEqual(30); // varchar(30) column limit
    }
  });

  it("rejects server-only and junk actions", () => {
    expect(CLIENT_ANALYTICS_ACTIONS.has("match")).toBe(false);
    expect(CLIENT_ANALYTICS_ACTIONS.has("drop table")).toBe(false);
    expect(CLIENT_ANALYTICS_ACTIONS.has("")).toBe(false);
  });
});

describe("shapeDemandReport", () => {
  it("returns a well-formed empty report", () => {
    const report = shapeDemandReport(emptyRows());
    expect(report.windowDays).toBe(7);
    expect(typeof report.generatedAt).toBe("string");
    expect(new Date(report.generatedAt).toString()).not.toBe("Invalid Date");
    expect(report.totals).toEqual({
      swipes: 0,
      likes: 0,
      superLikes: 0,
      matches: 0,
      actions: 0,
      uniqueUsers: 0,
    });
    expect(report.cuisines).toEqual([]);
    expect(report.topRestaurants).toEqual([]);
    expect(report.byDayOfWeek).toHaveLength(7);
    expect(report.byHourOfDay).toHaveLength(24);
    expect(report.byDayOfWeek.every((d) => d.swipes === 0)).toBe(true);
    // Breakdown keys are pre-seeded so the client always sees stable keys.
    for (const a of OUTCOME_ACTIONS) {
      expect(report.actionBreakdown[a]).toBe(0);
    }
  });

  it("computes totals from action rows", () => {
    const report = shapeDemandReport(
      emptyRows({
        actionRows: [
          { action: "swipe_right", count: 10 },
          { action: "swipe_left", count: 5 },
          { action: "super_like", count: 2 },
          { action: "match", count: 3 },
          { action: "action_directions", count: 4 },
          { action: "action_share", count: 1 },
          { action: "click_details", count: 99 }, // neither swipe nor outcome
        ],
        uniqueUsers: 6,
      })
    );
    expect(report.totals).toEqual({
      swipes: 17, // right + left + super
      likes: 10,
      superLikes: 2,
      matches: 3,
      actions: 5,
      uniqueUsers: 6,
    });
    expect(report.actionBreakdown.action_directions).toBe(4);
    expect(report.actionBreakdown.action_share).toBe(1);
    expect(report.actionBreakdown.action_delivery).toBe(0);
  });

  it("aggregates cuisines with like rate and sorts by likes desc", () => {
    const report = shapeDemandReport(
      emptyRows({
        cuisineRows: [
          { cuisine: "chinese", action: "swipe_right", count: 8 },
          { cuisine: "chinese", action: "super_like", count: 2 },
          { cuisine: "chinese", action: "swipe_left", count: 10 },
          { cuisine: "chinese", action: "match", count: 3 },
          { cuisine: "chinese", action: "action_directions", count: 2 },
          { cuisine: "mexican", action: "swipe_right", count: 4 },
          { cuisine: "mexican", action: "swipe_left", count: 1 },
        ],
      })
    );
    expect(report.cuisines).toHaveLength(2);
    expect(report.cuisines[0]).toEqual({
      cuisine: "chinese",
      swipes: 20,
      likes: 10, // swipe_right + super_like
      likeRate: 0.5,
      matches: 3,
      actions: 2,
    });
    expect(report.cuisines[1].cuisine).toBe("mexican");
    expect(report.cuisines[1].likeRate).toBe(0.8);
  });

  it("reports zero like rate when a cuisine has no swipes", () => {
    const report = shapeDemandReport(
      emptyRows({
        cuisineRows: [{ cuisine: "thai", action: "match", count: 1 }],
      })
    );
    expect(report.cuisines[0].likeRate).toBe(0);
    expect(report.cuisines[0].swipes).toBe(0);
  });

  it("builds top restaurants with per-restaurant action breakdown, sorted by likes, capped at 20", () => {
    const restaurantRows = [
      { restaurant_id: "r1", restaurant_name: "Panda House", action: "swipe_right", count: 5 },
      { restaurant_id: "r1", restaurant_name: "Panda House", action: "match", count: 2 },
      { restaurant_id: "r1", restaurant_name: "Panda House", action: "action_directions", count: 3 },
      { restaurant_id: "r1", restaurant_name: "Panda House", action: "action_visited", count: 1 },
      { restaurant_id: "r2", restaurant_name: "Taco Spot", action: "swipe_right", count: 9 },
      { restaurant_id: "r2", restaurant_name: "Taco Spot", action: "super_like", count: 1 },
    ];
    // 25 filler restaurants with 0 likes to exercise the cap
    for (let i = 0; i < 25; i++) {
      restaurantRows.push({
        restaurant_id: `filler-${i}`,
        restaurant_name: `Filler ${i}`,
        action: "swipe_left",
        count: 1,
      });
    }
    const report = shapeDemandReport(emptyRows({ restaurantRows }));
    expect(report.topRestaurants).toHaveLength(20);
    expect(report.topRestaurants[0]).toMatchObject({
      restaurantId: "r2",
      name: "Taco Spot",
      likes: 10,
    });
    expect(report.topRestaurants[1]).toMatchObject({
      restaurantId: "r1",
      name: "Panda House",
      likes: 5,
      matches: 2,
      actions: 4,
    });
    expect(report.topRestaurants[1].actionBreakdown).toEqual({
      action_directions: 3,
      action_visited: 1,
    });
  });

  it("densifies day-of-week and hour-of-day buckets", () => {
    const report = shapeDemandReport(
      emptyRows({
        dayRows: [
          { bucket: 0, swipes: 4 },
          { bucket: 6, swipes: 9 },
        ],
        hourRows: [{ bucket: 23, swipes: 7 }],
      })
    );
    expect(report.byDayOfWeek).toHaveLength(7);
    expect(report.byDayOfWeek[0]).toEqual({ day: 0, swipes: 4 });
    expect(report.byDayOfWeek[3]).toEqual({ day: 3, swipes: 0 });
    expect(report.byDayOfWeek[6]).toEqual({ day: 6, swipes: 9 });
    expect(report.byHourOfDay).toHaveLength(24);
    expect(report.byHourOfDay[23]).toEqual({ hour: 23, swipes: 7 });
    expect(report.byHourOfDay[0]).toEqual({ hour: 0, swipes: 0 });
  });

  it("tolerates numeric strings from the driver", () => {
    const report = shapeDemandReport(
      emptyRows({
        actionRows: [{ action: "swipe_right", count: "12" as unknown as number }],
        dayRows: [{ bucket: "2" as unknown as number, swipes: "5" as unknown as number }],
      })
    );
    expect(report.totals.likes).toBe(12);
    expect(report.byDayOfWeek[2]).toEqual({ day: 2, swipes: 5 });
  });
});
