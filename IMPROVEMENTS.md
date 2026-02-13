Findings — ALL RESOLVED

[RESOLVED] Critical: leaderToken is leaked to non-leaders, so host takeover is possible. routes.ts (line 64) sends full group state over WS sync, /api/groups/join returns full group (routes.ts (line 153)), and reclaim only needs that token (routes.ts (line 282)).
→ Fixed: leaderToken stripped from all REST API responses (except initial create) and WebSocket sync broadcasts via stripLeaderToken() helper.

[RESOLVED] Critical: Group actions trust client-supplied memberId/hostMemberId without auth/session binding, enabling impersonation. See routes.ts (line 346), routes.ts (line 414), routes.ts (line 508), routes.ts (line 638), routes.ts (line 680).
→ Fixed: Session identity binding via bindMemberToSession() on create/join, verifyMemberIdentity() on all action endpoints (swipe, done-swiping, nudge, reaction, remove-member, start-session, preferences, push-subscribe).

[RESOLVED] Critical: WebSocket join has no membership validation; any caller with groupId + arbitrary memberId gets sync state. routes.ts (line 94).
→ Fixed: WS connection now validates memberId belongs to group.members before allowing connection. WS is read-only (no message handlers), so session verification not required.

[RESOLVED] High: Multiple crew/session endpoints are authenticated but missing membership authorization checks (IDOR risk). Examples: social-routes.ts (line 394), social-routes.ts (line 544), social-routes.ts (line 561), social-routes.ts (line 645), social-routes.ts (line 670), social-routes.ts (line 821), social-routes.ts (line 837), social-routes.ts (line 1129), social-routes.ts (line 1146).
→ Fixed: requireCrewMembership() and requireSessionMembership() helpers enforce authorization on all crew/session endpoints.

[RESOLVED] High: /api/sessions/visited-restaurants is broken by stale schema references (crewMembers, diningSessions.crewId). social-routes.ts (line 977), social-routes.ts (line 978), social-routes.ts (line 996). Client calls it on swipe load: swipe.tsx (line 60).
→ Fixed: Replaced stale references with correct schema (persistentGroups.memberIds and diningSessions.groupId).

[RESOLVED] Medium: Friend-decline route mismatch. Client calls /reject at dashboard.tsx (line 146), server exposes /decline at social-routes.ts (line 201).
→ Fixed: Server route renamed from /decline to /reject to match frontend.

[RESOLVED] Medium: Dashboard expects API shapes that backend does not return. Friend shape mismatch (dashboard.tsx (line 29), dashboard.tsx (line 251) vs social-routes.ts (line 39)) and crew shape mismatch (dashboard.tsx (line 39) vs social-routes.ts (line 285)).
→ Fixed: Backend now returns enriched friend/crew objects matching frontend TypeScript interfaces.

[RESOLVED] Medium: Invalid group status value "finished" is written (social-routes.ts (line 959)) but schema only allows "waiting" | "configuring" | "swiping" | "completed" (schema.ts (line 82)).
→ Fixed: Changed to "completed" to match schema enum.

[RESOLVED] Medium: Analytics can be double-counted/spoofed. Swipe is logged server-side (routes.ts (line 425)) and client-side (swipe.tsx (line 275)) via open batch endpoint (routes.ts (line 714)).
→ Fixed: Removed client-side trackSwipe() call; analytics logged server-side only.

[RESOLVED] Medium: API logging includes full JSON responses (index.ts (line 51)), which can log sensitive fields like leader tokens returned by group endpoints (routes.ts (line 131), routes.ts (line 153), routes.ts (line 246)).
→ Fixed: Recursive redactSensitive() function strips leaderToken fields from all logged objects.

Open Questions / Assumptions
I assumed crew/session data should be visible only to crew members. If intentional, findings 4/5/7 need reclassification.
→ Confirmed: Crew/session data is restricted to crew members only via authorization checks.
