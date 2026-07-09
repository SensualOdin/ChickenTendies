# Restaurant Demand Instrumentation + Weekly Report Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans / subagent-driven-development.

**Goal:** Capture per-restaurant outcome events (match actions) and generate an admin-facing weekly demand report — the dataset behind the future "50 people wanted Chinese this week" restaurant pitch.

**Architecture:** Reuse the existing `analytics_events` table (no schema change: `restaurantId`, `restaurantName`, `action` varchar(30), `cuisineTags`, `priceRange`, `dayOfWeek`, `hourOfDay`, hashed `userId`, indexed on action/restaurant/created). Client emits new action events through the existing `useAnalytics` batching hook → `POST /api/analytics/events`. Matches get logged server-side at creation time (both pipelines). A new admin endpoint aggregates a windowed report; the admin analytics page renders it with the page's existing chart/table patterns.

**Privacy:** unchanged — hashed user ids, coarse coords, aggregates only.

---

## Shared contract

### New `action` values (varchar 30 — keep under limit)
- Server-side at match creation: `match`
- Client-side on match-card buttons: `action_directions`, `action_delivery`, `action_reserve`, `action_calendar`, `action_share`, `action_visited`, `action_final_choice`

### Report endpoint
`GET /api/analytics/report?days=7` — `isAuthenticated, isAdminUser`; `days` clamped to 1–90, default 7.

Response:
```json
{
  "windowDays": 7,
  "generatedAt": "ISO",
  "totals": { "swipes": 0, "likes": 0, "superLikes": 0, "matches": 0, "actions": 0, "uniqueUsers": 0 },
  "cuisines": [ { "cuisine": "chinese", "swipes": 0, "likes": 0, "likeRate": 0.0, "matches": 0, "actions": 0 } ],
  "topRestaurants": [ { "restaurantId": "x", "name": "x", "likes": 0, "matches": 0, "actions": 0, "actionBreakdown": { "action_directions": 0 } } ],
  "actionBreakdown": { "action_directions": 0 },
  "byDayOfWeek": [ { "day": 0, "swipes": 0 } ],
  "byHourOfDay": [ { "hour": 0, "swipes": 0 } ]
}
```
`cuisines` sorted by likes desc; `topRestaurants` by likes desc, cap 20. "swipes" = like+dislike+super_like events (verify the existing stored action names in server/analytics.ts before writing queries — match whatever is actually stored).

## Workstream A — Server (server/ only)

### A1. Verify POST /api/analytics/events accepts the new action strings
`server/routes.ts:1588` — if there's an action allowlist, extend it with the client actions above; if free-form, add an allowlist including old + new actions (defense against junk data), silently dropping unknown actions.

### A2. Log `match` events server-side at match creation
- Anonymous pipeline: where matches are created/broadcast in server/routes.ts / storage (find the single choke point; `checkForMatches`/match-logic call site).
- Session pipeline: server/social-routes.ts at the `.onConflictDoNothing().returning()` insert — log only when the row was actually inserted.
- Use the existing server-side logging helper in server/analytics.ts (same shape as swipe logging: restaurantId, restaurantName, cuisineTags, priceRange, day/hour; userId null or hashed where available). Never let logging failures break the match flow (fire-and-forget with .catch).

### A3. Report endpoint
New handler in server/analytics.ts (exported, mounted in routes.ts next to the other analytics routes) implementing the contract above with SQL aggregation (GROUP BY on action / cuisineTags elements / restaurantId / dayOfWeek / hourOfDay). cuisineTags is jsonb array — unnest with `jsonb_array_elements_text`. uniqueUsers = COUNT(DISTINCT user_id) excluding nulls.

### A4. Tests
Add server/__tests__/demand-report.test.ts covering the pure parts (days clamping, response shaping if extracted as a pure function over rows). SQL itself is fine untested.

## Workstream B — Client (client/ only)

### B1. Emit action events from the matches page
client/src/pages/matches.tsx — wire `useAnalytics` (it's already used on the swipe page; follow that pattern). On each match-card button (directions, DoorDash/delivery, reserve, calendar, share, "We went here"/visited) call `trackEvent` with the matching `action_*` name plus restaurantId, restaurantName, cuisineTags (from the restaurant's categories), priceRange. Call `flushNow()` after emitting — these fire right before the user leaves the app (opening maps/DoorDash), so the 5s batch timer would lose them.
Also emit `action_final_choice` where the Final Vote choice is confirmed (swipe.tsx finalChoiceMutation onSuccess).

### B2. Demand Report section on the admin analytics page
client/src/pages/analytics.tsx — add a "Demand Report" section/tab:
- 7 / 30-day toggle (refetches `/api/analytics/report?days=N` via the existing query pattern with auth headers)
- Totals row (swipes, likes, matches, actions, unique users)
- Cuisine demand table (cuisine, swipes, likes, like rate %, matches, actions) — this is the "50 people wanted Chinese" table
- Top restaurants table with action breakdown
- Day-of-week and hour-of-day bar charts REUSING the page's existing chart components, colors, and styling — do not invent new chart styles
- A "Print report" button calling window.print() with a small print stylesheet that hides nav/toggles so the report section prints clean (this is the walk-into-a-restaurant PDF)

### B3. Guard rails
The page/section must handle: non-admin (endpoint 403s — show nothing/redirect as the page already does), empty data (friendly empty state), loading state.

## Verification
1. `npx tsc --noEmit` → exit 0 (this branch compiles clean; keep it that way)
2. `npx vitest run` → all pass
3. No schema changes, no migrations.
