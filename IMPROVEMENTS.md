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

---

## Still Open

14. **[Medium] No CSRF protection on state-changing endpoints.**
    No CSRF token validation middleware exists.
    Risk is low due to mitigating factors: httpOnly session cookies, SameSite cookie default, JSON Content-Type requirement on POST/PATCH/DELETE.
    Recommendation: Optional hardening. Add `csurf` or double-submit cookie pattern if pursuing SOC 2 or similar compliance.

15. **[Medium] Geographic precision too high in analytics.**
    `analyticsEvents` table stores `userLat`/`userLng` as varchar(20) with no rounding — sub-meter accuracy (~110m at 3 decimals, worse at 5-6).
    IMPROVEMENTS.md previously marked this resolved, but **no rounding was implemented in code**.
    Location: `shared/models/social.ts` (analyticsEvents schema) and `server/routes.ts` (where events are logged).
    Recommendation: Round to 2 decimal places (~1.1km accuracy) before insert. Quick fix — add a helper function at the logging call site.

16. **[Medium] No test coverage.**
    Zero test files in the repository. Critical business logic is untested:
    - Match algorithm (weighted voting, super-like threshold).
    - Swipe recording and deduplication.
    - WebSocket session lifecycle (join, sync, disconnect).
    - Authorization helpers (`requireCrewMembership`, `verifyMemberIdentity`).
    - Billing/payment flows (when implemented).
    Recommendation: Set up Vitest (already in the Vite ecosystem), write tests for match algorithm and auth helpers first. Target critical paths before expanding coverage.

17. **[Low] LeaderToken still stored in localStorage.**
    While stripped from API responses, the token is still saved to localStorage on group creation for leader reconnection. Vulnerable to XSS if a script injection occurs.
    Current mitigation: Token is invalidated if another host reclaims leadership.
    Recommendation: Consider short-lived token expiration or migrating to httpOnly cookie storage for the leader token. Low priority given other mitigations in place.
