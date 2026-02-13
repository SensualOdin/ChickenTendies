# ChickenTinders — Phase 0 Bug Fixes & Issues
Last updated: February 13, 2026

Review of growth sprint features built Feb 13, 2026. Bugs and gaps found during code review.

---

## Critical Bugs (fix before launch)

### 1. ~~Dormant crew nudge sends to ACTIVE crews, skips dormant ones~~
**File:** `server/scheduled-notifications.ts`
**Status:** INVALID — Logic is correct. The condition `new Date(lastSession[0].startedAt) > twoWeeksAgo` correctly skips crews with recent sessions and only sends to crews whose last session was 2+ weeks ago. No fix needed.
- [x] Verified correct

### 2. Share match results has no deeplink or restaurant context
**File:** `client/src/pages/matches.tsx`
**Issue:** Shares `window.location.origin` — just the generic homepage. Recipients can't join the crew or see the matched restaurant. Kills virality since shared links have no conversion value.
**Fix applied:**
- Share text now includes restaurant name, rating, cuisine, and price range.
- If the group has an `inviteCode` (persistent crew), the share URL is `/crew/join/:inviteCode`.
- Falls back to homepage for anonymous groups.
- Also tracks `shareMethod` (native_share vs clipboard) in event metadata (Issue #10).
- [x] Fix applied
- [x] Tested

### 3. Timezone bug in scheduled push notifications
**File:** `server/scheduled-notifications.ts`
**Issue:** Uses server-local time for "Friday 5 PM" and "Wednesday 10 AM" checks. If server runs in UTC, users in other timezones get notifications at wrong times.
**Fix applied:** Added `getEasternTime()` helper using `Intl.DateTimeFormat` with `America/New_York` timezone. All day/hour checks now use Eastern Time.
- [x] Fix applied
- [x] Tested

### 4. ~~Streak calculation logic error~~
**File:** `server/streaks.ts`
**Status:** INVALID — The streak calculation logic is correct for all described test cases. The year-boundary bug (hardcoded `week = 52` instead of calculating actual ISO weeks in year) was fixed in a prior session with the `getISOWeeksInYear()` helper. No remaining issues.
- [x] Verified correct
- [x] Year-boundary fix already applied

### 5. Return session events not implemented
**Files:** `server/social-routes.ts`
**Issue:** `return_session_day_7` and `return_session_day_28` are required to measure the Phase 0 gate (week-4 retention >= 30%).
**Fix applied:** Added `checkReturnSessionMilestones()` function. When a crew starts a new session (`POST /api/crews/:id/sessions`), it checks if the user's first `crew_created` or `first_session_completed` event was 7+ or 28+ days ago. If so, logs the corresponding return event (idempotent — only logs once per user).
- [x] `return_session_day_7` implemented
- [x] `return_session_day_28` implemented
- [x] Tested

---

## Moderate Issues (fix before scaling)

### 6. No ownership check on group conversion endpoint
**File:** `server/social-routes.ts` (convert-to-crew endpoint)
**Issue:** Any authenticated user can call `/api/groups/:id/convert-to-crew` for any anonymous group.
**Fix applied:** Endpoint now checks that the caller is a member of the group, either by matching their userId against group members or by verifying their session's `memberBindings` for the group.
- [x] Fix applied
- [x] Tested

### 7. Streak queries are N+1
**File:** `server/streaks.ts`, called from `server/social-routes.ts` (crews endpoint)
**Issue:** `getCrewStreak()` runs a separate DB query per crew on dashboard load.
**Fix applied:** Added `getBatchCrewStreaks(groupIds)` that fetches all completed sessions for all crews in a single query, then calculates streaks in memory. Dashboard crews endpoint now uses batch function. Individual crew detail endpoint still uses single `getCrewStreak()` (acceptable — one query for one crew).
- [x] Fix applied
- [x] Tested

### 8. No rate limiting on crew preview endpoint
**File:** `server/social-routes.ts`
**Issue:** `/api/crews/preview/:inviteCode` has no rate limiting. Could be used to brute-force enumerate invite codes.
**Fix applied:** Added `crewPreviewLimiter` (20 requests per 15 minutes per IP).
- [x] Fix applied
- [x] Tested

### 9. New restaurants alert not implemented
**File:** `server/scheduled-notifications.ts`
**Issue:** One of the three planned re-engagement nudges from NEXT-STEPS is missing entirely: "12 new spots added near you this week."
**Status:** Deferred — requires knowing user location/area which is session-scoped, not stored on the user profile. Would need a `preferred_location` field on users first. Not blocking Phase 0 gate metrics.
- [ ] Deferred

---

## Minor Issues (nice to have)

### 10. Share event missing destination metadata
**File:** `client/src/pages/matches.tsx`
**Issue:** `match_result_shared` event doesn't track where the user shared to.
**Fix applied:** Event metadata now includes `shareMethod` field distinguishing `"native_share"` vs `"clipboard"`.
- [x] Fix applied

### 11. Missing groupId index on lifecycle_events table
**File:** `shared/models/social.ts`
**Issue:** Table had indexes on `event_name` and `created_at` but not `group_id`. Many dashboard queries filter by groupId + eventName.
**Fix applied:** Added `lifecycle_group_idx` index on `(group_id, event_name)` to both the Drizzle schema and the live database.
- [x] Migration applied
- [x] Schema updated

### 12. Conversion prompt timing is fixed at 3 seconds
**File:** `client/src/pages/matches.tsx`
**Issue:** Prompt appears 3 seconds after match, regardless of whether user is still processing the result.
**Fix applied:** Changed to interaction-triggered: after a 2-second delay, listens for the user's next click or scroll event before showing the prompt. Feels more natural than a fixed timer.
- [x] Fix applied

---

## Summary

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | ~~Dormant nudge logic inverted~~ | ~~Critical~~ | [x] Invalid — logic correct |
| 2 | Share has no deeplink | Critical | [x] Fixed |
| 3 | Timezone bug in notifications | Critical | [x] Fixed |
| 4 | ~~Streak calculation logic error~~ | ~~Critical~~ | [x] Invalid — already fixed |
| 5 | Return session events missing | Critical | [x] Fixed |
| 6 | No ownership check on conversion | Moderate | [x] Fixed |
| 7 | Streak N+1 queries | Moderate | [x] Fixed |
| 8 | No rate limit on crew preview | Moderate | [x] Fixed |
| 9 | New restaurants alert missing | Moderate | [ ] Deferred |
| 10 | Share event missing metadata | Minor | [x] Fixed |
| 11 | Missing groupId index | Minor | [x] Fixed |
| 12 | Conversion prompt timing | Minor | [x] Fixed |
