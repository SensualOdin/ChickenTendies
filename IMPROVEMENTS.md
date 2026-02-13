Findings
Critical: leaderToken is leaked to non-leaders, so host takeover is possible. routes.ts (line 64) sends full group state over WS sync, /api/groups/join returns full group (routes.ts (line 153)), and reclaim only needs that token (routes.ts (line 282)).
Critical: Group actions trust client-supplied memberId/hostMemberId without auth/session binding, enabling impersonation. See routes.ts (line 346), routes.ts (line 414), routes.ts (line 508), routes.ts (line 638), routes.ts (line 680).
Critical: WebSocket join has no membership validation; any caller with groupId + arbitrary memberId gets sync state. routes.ts (line 94).
High: Multiple crew/session endpoints are authenticated but missing membership authorization checks (IDOR risk). Examples: social-routes.ts (line 394), social-routes.ts (line 544), social-routes.ts (line 561), social-routes.ts (line 645), social-routes.ts (line 670), social-routes.ts (line 821), social-routes.ts (line 837), social-routes.ts (line 1129), social-routes.ts (line 1146).
High: /api/sessions/visited-restaurants is broken by stale schema references (crewMembers, diningSessions.crewId). social-routes.ts (line 977), social-routes.ts (line 978), social-routes.ts (line 996). Client calls it on swipe load: swipe.tsx (line 60).
Medium: Friend-decline route mismatch. Client calls /reject at dashboard.tsx (line 146), server exposes /decline at social-routes.ts (line 201).
Medium: Dashboard expects API shapes that backend does not return. Friend shape mismatch (dashboard.tsx (line 29), dashboard.tsx (line 251) vs social-routes.ts (line 39)) and crew shape mismatch (dashboard.tsx (line 39) vs social-routes.ts (line 285)).
Medium: Invalid group status value "finished" is written (social-routes.ts (line 959)) but schema only allows "waiting" | "configuring" | "swiping" | "completed" (schema.ts (line 82)).
Medium: Analytics can be double-counted/spoofed. Swipe is logged server-side (routes.ts (line 425)) and client-side (swipe.tsx (line 275)) via open batch endpoint (routes.ts (line 714)).
Medium: API logging includes full JSON responses (index.ts (line 51)), which can log sensitive fields like leader tokens returned by group endpoints (routes.ts (line 131), routes.ts (line 153), routes.ts (line 246)).
Open Questions / Assumptions
I assumed crew/session data should be visible only to crew members. If intentional, findings 4/5/7 need reclassification.
