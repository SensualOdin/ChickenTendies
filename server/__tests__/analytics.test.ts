import { describe, it, expect } from "vitest";
import { truncateCoordinate } from "../analytics";

describe("truncateCoordinate", () => {
  it("rounds to 2 decimal places by default", () => {
    expect(truncateCoordinate("37.78493")).toBe("37.78");
    expect(truncateCoordinate("-122.40942")).toBe("-122.41");
  });

  it("handles number input", () => {
    expect(truncateCoordinate(37.78493)).toBe("37.78");
    expect(truncateCoordinate(-122.40942)).toBe("-122.41");
  });

  it("returns null for null/undefined", () => {
    expect(truncateCoordinate(null)).toBeNull();
    expect(truncateCoordinate(undefined)).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(truncateCoordinate("abc")).toBeNull();
    expect(truncateCoordinate("")).toBeNull();
  });

  it("handles already rounded values", () => {
    expect(truncateCoordinate("37.78")).toBe("37.78");
    expect(truncateCoordinate("37")).toBe("37.00");
  });

  it("respects custom decimal count", () => {
    expect(truncateCoordinate("37.78493", 3)).toBe("37.785");
    expect(truncateCoordinate("37.78493", 0)).toBe("38");
  });

  it("ensures ~1.1km precision at 2 decimals", () => {
    const lat1 = truncateCoordinate("37.78493");
    const lat2 = truncateCoordinate("37.78412");
    expect(lat1).toBe(lat2);
    expect(lat1).toBe("37.78");
  });
});
