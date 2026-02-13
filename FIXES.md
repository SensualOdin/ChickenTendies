# ChickenTinders — Phase 0 Bug Fixes & Issues
Last updated: February 13, 2026

Review of growth sprint features built Feb 13, 2026. Bugs and gaps found during code review.

---

## Critical Bugs (fix before launch)

### 1. Dormant crew nudge sends to ACTIVE crews, skips dormant ones
**File:** `server/scheduled-notifications.ts`
**Issue:** The condition checking last session date is inverted. Currently skips dormant crews and sends to active ones — the exact opposite of intended behavior.
**Expected:** Notify crews with no session in 2+ weeks. Skip crews that are active.
**Fix:** Flip the comparison operator in the dormant check condition.
- [ ] Fix applied
- [ ] Tested

### 2. Share match results has no deeplink or restaurant context
**File:** `client/src/pages/matches.tsx`
**Issue:** Shares `window.location.origin` — just the generic homepage. Recipients can't join the crew or see the matched restaurant. Kills virality since shared links have no conversion value.
**Expected:** Share text includes restaurant name/rating + a deeplink like `/crew/join/:code` so recipients can join the crew.
**Fix:**
- Include matched restaurant name and details in share text.
- Generate a crew join link (`/crew/join/:inviteCode`) as the shared URL.
- If no invite code exists (anonymous group), link to homepage with context.
- [ ] Fix applied
- [ ] Tested

### 3. Timezone bug in scheduled push notifications
**File:** `server/scheduled-notifications.ts`
**Issue:** Uses server-local time for "Friday 5 PM" and "Wednesday 10 AM" checks. If server runs in UTC, users in other timezones get notifications at wrong times (e.g., EST users get Friday nudge at noon or 1 AM).
**Fix Options:**
- Option A: Store user timezone in profile, schedule per-user.
- Option B: Use a reasonable US timezone default (e.g., America/New_York) since launch city will likely be US-based.
- Option C: Send at a safe window (e.g., 11 AM–12 PM server time) that's reasonable across US timezones.
- [ ] Fix applied
- [ ] Tested

### 4. Streak calculation logic error
**File:** `server/streaks.ts`
**Issue:** The consecutive week counting loop has a logic error. If a crew had sessions every week for 4 consecutive weeks, the count may not accumulate correctly through the sorted weeks array. Edge cases around week boundaries (current week vs last week check) may return 0 when streak should be 4.
**Fix:** Review and rewrite the loop that walks backwards through sorted week keys. Add unit tests for:
- Crew with sessions in weeks 1, 2, 3, 4 (current) → streak = 4
- Crew with sessions in weeks 1, 2, 4 (gap in week 3) → streak = 1
- Crew with no sessions → streak = 0
- Crew with session only this week → streak = 1
- [ ] Fix applied
- [ ] Unit tests added
- [ ] Tested

### 5. Return session events not implemented
**Files:** `server/lifecycle.ts`, `server/social-routes.ts`
**Issue:** `return_session_day_7` and `return_session_day_28` are required by NEXT-STEPS but never logged anywhere. Without these, **cannot measure the Phase 0 gate** (week-4 retention >= 30%).
**Fix:** When a crew starts a new session, check if this user's first `crew_created` or `first_session_completed` event was 7 or 28 days ago. If so, log the return event.
- [ ] `return_session_day_7` implemented
- [ ] `return_session_day_28` implemented
- [ ] Tested

---

## Moderate Issues (fix before scaling)

### 6. No ownership check on group conversion endpoint
**File:** `server/social-routes.ts` (convert-to-crew endpoint)
**Issue:** Any authenticated user can call `/api/groups/:id/convert-to-crew` for any anonymous group. Should verify the caller is a member of that group.
**Fix:** Check that the authenticated user's session memberId belongs to the group's members array before allowing conversion.
- [ ] Fix applied
- [ ] Tested

### 7. Streak queries are N+1
**File:** `server/streaks.ts`, called from `server/social-routes.ts` (crews endpoint)
**Issue:** `getCrewStreak()` runs a separate DB query per crew on dashboard load. At 100 crews, that's 100 individual queries.
**Fix Options:**
- Option A: Batch query — fetch all sessions for all user's crews in one query, calculate streaks in memory.
- Option B: Cache streaks in a column on `persistentGroups`, update on session completion.
- [ ] Fix applied
- [ ] Tested

### 8. No rate limiting on crew preview endpoint
**File:** `server/social-routes.ts`
**Issue:** `/api/crews/preview/:inviteCode` has no rate limiting. Could be used to brute-force enumerate invite codes and discover crews.
**Fix:** Add a rate limiter (e.g., 20 requests per 15 minutes per IP).
- [ ] Fix applied
- [ ] Tested

### 9. New restaurants alert not implemented
**File:** `server/scheduled-notifications.ts`
**Issue:** One of the three planned re-engagement nudges from NEXT-STEPS is missing entirely: "12 new spots added near you this week."
**Fix:** Add a weekly check (e.g., Monday 11 AM) that counts recently cached restaurants in the user's area and sends a push if count > 0.
- [ ] Implemented
- [ ] Tested

---

## Minor Issues (nice to have)

### 10. Share event missing destination metadata
**File:** `client/src/pages/matches.tsx`
**Issue:** `match_result_shared` event doesn't track where the user shared to (iMessage, WhatsApp, clipboard, etc.). Makes analytics less useful.
**Fix:** If using Native Share API, there's no reliable way to detect destination. But can at least distinguish "native share" vs "clipboard fallback."
- [ ] Fix applied

### 11. Missing groupId index on lifecycle_events table
**File:** `migrations/add_lifecycle_events.sql`
**Issue:** Table has indexes on `event_name` and `created_at` but not `groupId`. Many dashboard queries filter by groupId + eventName.
**Fix:** Add index: `CREATE INDEX idx_lifecycle_group ON lifecycle_events(group_id, event_name);`
- [ ] Migration applied

### 12. Conversion prompt timing is fixed at 3 seconds
**File:** `client/src/pages/matches.tsx`
**Issue:** Prompt appears 3 seconds after match, regardless of whether user is still processing the result. Could feel abrupt.
**Fix:** Consider triggering on scroll or after user interacts with the match card (e.g., taps "Get Directions") instead of a fixed timer.
- [ ] Fix applied

---

## Summary

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | Dormant nudge logic inverted | Critical | [ ] Open |
| 2 | Share has no deeplink | Critical | [ ] Open |
| 3 | Timezone bug in notifications | Critical | [ ] Open |
| 4 | Streak calculation logic error | Critical | [ ] Open |
| 5 | Return session events missing | Critical | [ ] Open |
| 6 | No ownership check on conversion | Moderate | [ ] Open |
| 7 | Streak N+1 queries | Moderate | [ ] Open |
| 8 | No rate limit on crew preview | Moderate | [ ] Open |
| 9 | New restaurants alert missing | Moderate | [ ] Open |
| 10 | Share event missing metadata | Minor | [ ] Open |
| 11 | Missing groupId index | Minor | [ ] Open |
| 12 | Conversion prompt timing | Minor | [ ] Open |
