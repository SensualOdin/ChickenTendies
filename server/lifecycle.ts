import { db } from "./db";
import { lifecycleEvents } from "@shared/schema";

export async function logLifecycleEvent(eventName: string, opts?: {
  userId?: string | null;
  groupId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    await db.insert(lifecycleEvents).values({
      eventName,
      userId: opts?.userId || null,
      groupId: opts?.groupId || null,
      sessionId: opts?.sessionId || null,
      metadata: opts?.metadata || null,
    });
  } catch (error) {
    console.error("[Lifecycle] Failed to log event:", error);
  }
}
