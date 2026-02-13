import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredToken {
  token: string;
  expiresAt: number;
}

const mockStorage = new Map<string, string>();

function storageKey(groupId: string): string {
  return `grubmatch-leader-token-${groupId}`;
}

function storeLeaderToken(groupId: string, token: string): void {
  const data: StoredToken = {
    token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  mockStorage.set(storageKey(groupId), JSON.stringify(data));
}

function getLeaderToken(groupId: string): string | null {
  const raw = mockStorage.get(storageKey(groupId));
  if (!raw) return null;

  try {
    const data: StoredToken = JSON.parse(raw);
    if (Date.now() > data.expiresAt) {
      mockStorage.delete(storageKey(groupId));
      return null;
    }
    return data.token;
  } catch {
    mockStorage.delete(storageKey(groupId));
    return null;
  }
}

function clearLeaderToken(groupId: string): void {
  mockStorage.delete(storageKey(groupId));
}

describe("Leader Token Storage", () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves a token", () => {
    storeLeaderToken("group1", "my-secret-token");
    expect(getLeaderToken("group1")).toBe("my-secret-token");
  });

  it("returns null for non-existent group", () => {
    expect(getLeaderToken("nonexistent")).toBeNull();
  });

  it("expires token after 24 hours", () => {
    storeLeaderToken("group1", "my-secret-token");
    expect(getLeaderToken("group1")).toBe("my-secret-token");

    vi.advanceTimersByTime(TOKEN_TTL_MS + 1);
    expect(getLeaderToken("group1")).toBeNull();
  });

  it("token is valid just before expiration", () => {
    storeLeaderToken("group1", "my-secret-token");
    vi.advanceTimersByTime(TOKEN_TTL_MS - 1000);
    expect(getLeaderToken("group1")).toBe("my-secret-token");
  });

  it("clears expired token from storage on read", () => {
    storeLeaderToken("group1", "my-secret-token");
    vi.advanceTimersByTime(TOKEN_TTL_MS + 1);
    getLeaderToken("group1");
    expect(mockStorage.has(storageKey("group1"))).toBe(false);
  });

  it("clears token explicitly", () => {
    storeLeaderToken("group1", "my-secret-token");
    clearLeaderToken("group1");
    expect(getLeaderToken("group1")).toBeNull();
  });

  it("handles corrupted storage data", () => {
    mockStorage.set(storageKey("group1"), "not-json");
    expect(getLeaderToken("group1")).toBeNull();
    expect(mockStorage.has(storageKey("group1"))).toBe(false);
  });

  it("handles legacy plain-text tokens (non-JSON)", () => {
    mockStorage.set(storageKey("group1"), "plain-token-no-json");
    expect(getLeaderToken("group1")).toBeNull();
  });

  it("isolates tokens by group ID", () => {
    storeLeaderToken("group1", "token-a");
    storeLeaderToken("group2", "token-b");
    expect(getLeaderToken("group1")).toBe("token-a");
    expect(getLeaderToken("group2")).toBe("token-b");
  });
});
