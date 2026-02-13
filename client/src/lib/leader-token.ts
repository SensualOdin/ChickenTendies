const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredToken {
  token: string;
  expiresAt: number;
}

function storageKey(groupId: string): string {
  return `grubmatch-leader-token-${groupId}`;
}

export function storeLeaderToken(groupId: string, token: string): void {
  const data: StoredToken = {
    token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  localStorage.setItem(storageKey(groupId), JSON.stringify(data));
}

export function getLeaderToken(groupId: string): string | null {
  const raw = localStorage.getItem(storageKey(groupId));
  if (!raw) return null;

  try {
    const data: StoredToken = JSON.parse(raw);
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(storageKey(groupId));
      return null;
    }
    return data.token;
  } catch {
    localStorage.removeItem(storageKey(groupId));
    return null;
  }
}

export function clearLeaderToken(groupId: string): void {
  localStorage.removeItem(storageKey(groupId));
}
