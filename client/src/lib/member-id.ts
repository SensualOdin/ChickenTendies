const LEGACY_KEY = "grubmatch-member-id";

function storageKey(groupId: string): string {
  return `${LEGACY_KEY}-${groupId}`;
}

/**
 * Get the member id for a specific group. Falls back to the legacy
 * unscoped key (pre per-group scoping) and migrates it on read so the
 * stale global value can't leak into other groups afterwards.
 */
export function getMemberId(groupId: string | null | undefined): string | null {
  if (!groupId) return localStorage.getItem(LEGACY_KEY);

  const scoped = localStorage.getItem(storageKey(groupId));
  if (scoped) return scoped;

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    localStorage.setItem(storageKey(groupId), legacy);
    localStorage.removeItem(LEGACY_KEY);
    return legacy;
  }

  return null;
}

/** Store the member id scoped to a group. */
export function setMemberId(groupId: string, memberId: string): void {
  localStorage.setItem(storageKey(groupId), memberId);
}
