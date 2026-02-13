import { db } from "./db";
import { anonymousGroups, googlePlacesCache } from "@shared/schema";
import { sql, lt } from "drizzle-orm";

const GROUP_TTL_HOURS = 24;
const GOOGLE_CACHE_TTL_HOURS = 24;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export async function cleanupStaleGroups(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - GROUP_TTL_HOURS * 60 * 60 * 1000);

    const deleted = await db.delete(anonymousGroups)
      .where(lt(anonymousGroups.createdAt, cutoff))
      .returning({ id: anonymousGroups.id });

    if (deleted.length > 0) {
      console.log(`[Cleanup] Removed ${deleted.length} stale anonymous groups`);
    }

    const deletedCache = await db.delete(googlePlacesCache)
      .where(lt(googlePlacesCache.createdAt, new Date(Date.now() - GOOGLE_CACHE_TTL_HOURS * 60 * 60 * 1000)))
      .returning({ id: googlePlacesCache.id });

    if (deletedCache.length > 0) {
      console.log(`[Cleanup] Removed ${deletedCache.length} expired Google Places cache entries`);
    }
  } catch (error) {
    console.error("[Cleanup] Error during cleanup:", error);
  }
}

export function startCleanupScheduler(): void {
  cleanupStaleGroups();
  setInterval(cleanupStaleGroups, CLEANUP_INTERVAL_MS);
  console.log(`[Cleanup] Scheduler started (runs every ${CLEANUP_INTERVAL_MS / 60000} minutes)`);
}
