import { describe, expect, it, beforeEach, vi } from "vitest";
import { TtlMap } from "../ttl-map";

describe("TtlMap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns set values before they expire", () => {
    const m = new TtlMap<string, number>({ ttlMs: 1000 });
    m.set("a", 1);
    expect(m.get("a")).toBe(1);
    expect(m.has("a")).toBe(true);
    expect(m.size).toBe(1);
    m.dispose();
  });

  it("expires entries after ttl", () => {
    const m = new TtlMap<string, number>({ ttlMs: 1000 });
    m.set("a", 1);
    vi.advanceTimersByTime(1500);
    expect(m.get("a")).toBeUndefined();
    expect(m.has("a")).toBe(false);
    m.dispose();
  });

  it("evicts oldest entry when maxEntries is exceeded", () => {
    const m = new TtlMap<string, number>({ ttlMs: 60_000, maxEntries: 2 });
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);
    expect(m.get("a")).toBeUndefined();
    expect(m.get("b")).toBe(2);
    expect(m.get("c")).toBe(3);
    m.dispose();
  });

  it("refreshes insertion order on re-set", () => {
    const m = new TtlMap<string, number>({ ttlMs: 60_000, maxEntries: 2 });
    m.set("a", 1);
    m.set("b", 2);
    m.set("a", 11);
    m.set("c", 3);
    expect(m.get("b")).toBeUndefined();
    expect(m.get("a")).toBe(11);
    expect(m.get("c")).toBe(3);
    m.dispose();
  });

  it("iterates only live entries", () => {
    const m = new TtlMap<string, number>({ ttlMs: 1000 });
    m.set("a", 1);
    m.set("b", 2);
    vi.advanceTimersByTime(500);
    m.set("c", 3);
    vi.advanceTimersByTime(600);
    const seen = new Map<string, number>();
    for (const [k, v] of m) seen.set(k, v);
    expect(seen.get("a")).toBeUndefined();
    expect(seen.get("b")).toBeUndefined();
    expect(seen.get("c")).toBe(3);
    m.dispose();
  });

  it("delete removes entries", () => {
    const m = new TtlMap<string, number>({ ttlMs: 60_000 });
    m.set("a", 1);
    expect(m.delete("a")).toBe(true);
    expect(m.get("a")).toBeUndefined();
    expect(m.delete("a")).toBe(false);
    m.dispose();
  });
});
