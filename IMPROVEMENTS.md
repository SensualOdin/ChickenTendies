# ChickenTinders — Improvement Tracker

## Resolved

1. **[Critical] Leader token leaked to non-leaders.**
   leaderToken was sent in full group state over WS sync, REST join response, and reclaim endpoint.
   → Fixed: Stripped from all API responses (except initial create) and WS broadcasts via `stripLeaderToken()`.

2. **[Critical] Member impersonation via client-supplied memberId.**
   Group actions trusted client-supplied memberId without session binding.
   → Fixed: `bindMemberToSession()` on create/join, `verifyMemberIdentity()` on all action endpoints.

3. **[Critical] WebSocket join accepted any groupId + arbitrary memberId.**
   No membership validation on WS connection.
   → Fixed: WS connection validates memberId belongs to `group.members` before accepting.

4. **[High] Crew/session endpoints missing membership authorization (IDOR).**
   Authenticated endpoints had no crew membership checks.
   → Fixed: `requireCrewMembership()` and `requireSessionMembership()` on all crew/session endpoints.

5. **[High] Visited-restaurants endpoint broken by stale schema references.**
   Used `crewMembers` and `diningSessions.crewId` which no longer existed.
   → Fixed: Replaced with `persistentGroups.memberIds` and `diningSessions.groupId`.

6. **[Medium] Friend-decline route mismatch.**
   Client called `/reject`, server exposed `/decline`.
   → Fixed: Server route renamed to `/reject`.

7. **[Medium] Dashboard expected API shapes backend didn't return.**
   Friend and crew object shapes mismatched between frontend and backend.
   → Fixed: Backend returns enriched objects matching frontend interfaces.

8. **[Medium] Invalid group status "finished" written to DB.**
   Schema only allows "waiting" | "configuring" | "swiping" | "completed".
   → Fixed: Changed to "completed".

9. **[Medium] Analytics double-counted/spoofable.**
   Swipes logged both server-side and client-side via open batch endpoint.
   → Fixed: Removed client-side `trackSwipe()`; analytics logged server-side only.

10. **[Medium] API logging exposed sensitive fields.**
    Full JSON responses logged including leaderToken.
    → Fixed: `redactSensitive()` strips leaderToken from all logged objects.

11. **[Critical] Anonymous groups stored in memory (MemStorage).**
    Server restart wiped all active sessions.
    → Fixed: Migrated to `DbStorage` backed by PostgreSQL. 24-hour TTL cleanup via `server/cleanup.ts`.

12. **[Medium] No rate limiting on any endpoint.**
    All API endpoints unprotected against abuse/DoS.
    → Fixed: `express-rate-limit` with general (200/15min), create-group (10/15min), and swipe (60/min) limiters.

13. **[Medium] Google Places API called without caching or throttling.**
    Excessive external API calls on every request.
    → Fixed: 24-hour Postgres cache, batch processing (5 concurrent), hourly stale cache cleanup.

14. **[Medium] No CSRF protection on state-changing endpoints.**
    No CSRF token validation middleware existed.
    → Fixed: Double-submit cookie pattern via `server/csrf.ts`. Server sets `csrf-token` cookie (readable by JS, SameSite=Strict), client sends it back as `X-CSRF-Token` header on all POST/PUT/PATCH/DELETE. Auth callback/login/logout routes exempted. All raw `fetch` calls and `apiRequest` updated.

15. **[Medium] Geographic precision too high in analytics.**
    `analyticsEvents` stored `userLat`/`userLng` with sub-meter accuracy.
    → Fixed: `truncateCoordinate()` default changed from 3 to 2 decimal places (~1.1km accuracy).

16. **[Medium] No test coverage.**
    Zero test files in the repository.
    → Fixed: Vitest configured with `vitest.config.ts`. 40 unit tests covering: match algorithm (unanimous + super-like boost), CSRF protection logic, leader token storage/expiration, and analytics coordinate truncation. Run with `npx vitest run --config vitest.config.ts`.

17. **[Low] LeaderToken still stored in localStorage.**
    Token saved to localStorage with no expiration, vulnerable to XSS extraction.
    → Fixed: `client/src/lib/leader-token.ts` stores tokens as `{token, expiresAt}` JSON with 24-hour TTL. Expired tokens auto-cleared on read. All localStorage calls replaced with `storeLeaderToken()`/`getLeaderToken()` helpers.
