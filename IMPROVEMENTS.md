# ChickenTendies - Improvement Suggestions

## High Priority

### 1. Migrate In-Memory Storage to Persistent Storage

Anonymous groups live entirely in `MemStorage` (a JS Map in `server/storage.ts`). A server restart wipes all active sessions — every group mid-swipe is lost. This also prevents horizontal scaling since each server instance has its own memory.

**Recommendation:**
- Migrate anonymous group data to PostgreSQL (new `groups`, `group_members` tables)
- Alternatively, use Redis for ephemeral session data with TTL
- This unblocks horizontal scaling and eliminates data loss on deploys/restarts

---

### 2. Add Test Coverage

There are zero test files in the repository. The app has complex business logic (match algorithm, swipe recording, WebSocket sync, group lifecycle) that should be validated automatically.

**Recommendation:**
- API route tests — swipe logic, match algorithm, group creation/joining
- WebSocket event tests — member sync, match broadcasts, nudges
- Component tests — swipe card interaction, form validation
- Use Vitest (already using Vite) + React Testing Library

---

### 3. Address Security Gaps

Several security concerns exist across the application:

- **Leader token exposure:** The anonymous group host token is stored in `localStorage`. Anyone inspecting browser storage can hijack host controls (kick members, start swiping).
- **No rate limiting:** All API endpoints are unprotected. Automated scripts could spam group creation, swipes, or friend requests.
- **No CSRF protection:** No CSRF tokens are used for state-changing requests.
- **Open group data:** `/api/groups/:id` exposes full group data to anyone with the group ID — no membership verification.

**Recommendation:**
- Move leader token to an HTTP-only cookie or server-side session
- Add rate limiting middleware (e.g., `express-rate-limit`) on all endpoints
- Implement CSRF protection via `csurf` or double-submit cookie pattern
- Validate group membership before returning group data

---

### 4. Decouple Authentication from Replit

Authentication is tightly coupled to Replit's OAuth system (`server/replit_integrations/auth/`). Deploying to any other platform (Vercel, Railway, AWS, Fly.io) would require ripping out the entire auth layer.

**Recommendation:**
- Abstract authentication behind a provider interface
- Support multiple strategies: Google OAuth, GitHub OAuth, email/password (via Passport.js strategies)
- Keep Replit as one option but make it swappable
- Consider using a service like Clerk, Auth.js, or Supabase Auth for faster multi-provider support

---

## Medium Priority

### 5. Replace Denormalized `memberIds` Array with Junction Table

`persistentGroups.memberIds` is a PostgreSQL `text[]` array instead of a proper junction table. This makes it impossible to:
- Enforce foreign key constraints on member IDs
- Query member metadata (join date, role, status)
- Track when someone joined or left a crew
- Efficiently query "which crews is user X in?"

**Recommendation:**
- Create a `crew_members` junction table with columns: `id`, `crewId`, `userId`, `role`, `joinedAt`
- Migrate existing `memberIds` arrays to the new table
- Add proper FK constraints to `users.id` and `persistentGroups.id`

---

### 6. Add a Restaurant Caching Layer

Yelp API results are cached only in the in-memory `MemStorage`. Cache is lost on every restart, leading to redundant API calls and potential rate limit issues.

**Recommendation:**
- Cache restaurant search results in Redis or PostgreSQL with a TTL (e.g., 24 hours)
- Key by search parameters (location, radius, cuisine, price)
- Reduces Yelp API usage and improves response times
- Survives server restarts

---

### 7. Break Down Large Page Components

Several page components are 500-700+ lines, mixing data fetching, WebSocket logic, UI rendering, and state management:

- `swipe.tsx` — 720 lines
- `dashboard.tsx` — 766 lines
- `crew-manage.tsx` — 718 lines
- `preferences.tsx` — 557 lines
- `group-lobby.tsx` — 499 lines

**Recommendation:**
- Extract WebSocket logic into custom hooks (e.g., `useGroupWebSocket`)
- Extract repeated UI patterns into components (e.g., `MatchCard`, `MemberList`, `PreferencesForm`)
- Separate data fetching/mutation logic from presentation
- Aim for page components under 200 lines that compose smaller pieces

---

### 8. Improve Yelp API Fallback

When the Yelp API fails or the API key is missing, users get the same 12 hardcoded mock restaurants every time. This is a poor experience for anyone hitting this fallback.

**Recommendation:**
- Use Google Places API as a secondary search source (currently only used for enrichment)
- Expand the mock dataset to 50+ restaurants with realistic variety
- Add user-facing messaging when using fallback data ("Showing sample restaurants — location services unavailable")
- Consider caching successful Yelp responses to serve stale data when the API is down

---

## Lower Priority (Polish)

### 9. Add Offline Swiping Support

The PWA has a service worker and offline fallback page, but no actual offline functionality. Users who lose connection mid-session see a dead screen.

**Recommendation:**
- Cache the restaurant deck in IndexedDB when loaded
- Allow swiping offline with swipes queued locally
- Sync swipe data when connection is restored
- Show clear UI indicators for offline state and pending sync

---

### 10. Improve Analytics Privacy

User IDs are hashed with SHA256 (good practice), but geographic data in `analyticsEvents` stores `userLat`/`userLng` with 3 decimal places (~110 meter precision). This is precise enough to identify individual buildings/homes.

**Recommendation:**
- Reduce coordinate precision to 1 decimal place (~11km) or use geohashing
- Consider aggregating location data to city/neighborhood level instead of raw coordinates
- Add a data retention policy to purge old analytics events (e.g., 90 days)

---

### 11. Clean Up Stale WebSocket Connections

The client has reconnection logic, but the server doesn't actively clean up dead connections from the `clients` Map. Long-running sessions can accumulate stale entries.

**Recommendation:**
- Implement server-side heartbeat/ping-pong (ws library supports this natively)
- Set a timeout (e.g., 30 seconds without pong) to terminate dead connections
- Clean up the `clients` Map entry on connection close/error events
- Log connection lifecycle events for debugging

---

### 12. Add Keyboard Support for Swiping

The custom `SwipeCard` component relies entirely on drag gestures and button clicks. Users who rely on keyboard navigation (accessibility requirement) cannot use the core swipe interaction via keyboard alone.

**Recommendation:**
- Add keyboard shortcuts: Arrow Left (dislike), Arrow Right (like), Arrow Up (super like)
- Add visible keyboard shortcut hints on the swipe screen
- Ensure focus management works correctly when cards transition
- Test with screen readers to verify restaurant details are announced
