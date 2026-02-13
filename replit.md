# ChickenTinders

## Overview

ChickenTinders is a fun, Tinder-style collaborative restaurant discovery app that helps groups decide where to eat together. Users create or join "parties," set dining preferences (location, cuisine types, dietary restrictions, price range), then swipe through restaurant options with playful animations. When all group members like the same restaurant, it becomes a "match" with celebration effects!

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, local state with React hooks
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Animations**: Framer Motion for swipe card interactions
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js (v5) running on Node.js
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Real-time Communication**: WebSocket server (ws library) for live group updates
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod schemas shared between client and server via `@shared/*` path alias

### Data Storage
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` contains all database schemas and Zod validation
- **Migrations**: Drizzle Kit manages database migrations in `./migrations` directory
- **Session Storage**: Uses connect-pg-simple for PostgreSQL-backed sessions

### Key Design Patterns
- **Shared Schema**: TypeScript types and Zod schemas are defined once in `shared/` and imported by both client and server
- **Path Aliases**: `@/*` maps to client source, `@shared/*` maps to shared code
- **Persistent Storage**: Anonymous party groups, swipes, and restaurant cache are stored in PostgreSQL (`anonymous_groups`, `anonymous_group_swipes`, `restaurant_cache` tables). `DbStorage` class in `server/storage.ts` implements `IStorage` interface with Drizzle ORM.
- **Google Places Cache**: Google Places API results cached in `google_places_cache` table with 24-hour TTL, using upsert to prevent stale data
- **Automatic Cleanup**: `server/cleanup.ts` runs hourly to delete anonymous groups older than 24 hours (cascading to swipes/cache) and expired Google Places cache entries
- **Yelp Integration**: Real restaurant data fetched from Yelp Fusion API (see `server/yelp.ts`), with fallback to mock data
- **WebSocket Sync**: Real-time updates broadcast group state changes to all connected members

### Key Features (Recent)
- **Final Vote Mode**: When indecisive, users can trigger a "Final Vote" with their liked restaurants and a countdown timer
- **Smart Exclusions**: "Been here before" badges show on swipe cards for previously visited restaurants
- **Session Lifecycle**: Sessions auto-complete when users take action on matches (directions, DoorDash, "We went here", reserve). Starting a new session also auto-completes any previous active session. Dashboard shows "New Session" + conditional "Join Session" buttons with settings cog for crew management.
- **Visit Tracking**: "We Went Here" logging in dining sessions to track actual restaurant visits
- **Reservation Integration**: Direct links to Yelp reservation pages from match cards
- **Mobile-First PWA**: Full Progressive Web App with viewport-fit=cover, safe area insets for notched phones (iPhone Dynamic Island), responsive text/spacing with sm: breakpoints, 100dvh swipe page, 2-column mobile dashboard grid, hidden decorative elements on small screens
- **Analytics Intent Engine**: Every swipe action (left/right/super-like) is logged server-side to `analytics_events` table with full context (cuisine, price, location, time). Both party and crew swipe endpoints log analytics server-side only (no client-side duplicate). Stats endpoint (`GET /api/stats`) queries `analytics_events` by hashed auth userId for swipe/super-like counts. API endpoints: `GET /api/analytics/summary`, `GET /api/analytics/demand?cuisine=X`, `GET /api/analytics/restaurant/:id`, `POST /api/analytics/events`
- **PWA Link Handling**: Join page (`/join?code=XXX`) shows a helpful hint banner when opened in a browser (not standalone PWA), telling users they can open their installed app and enter the code there or continue in the browser
- **Rate Limiting**: `express-rate-limit` protects all API endpoints (200 req/15min general, 10 req/15min for group creation, 60 req/min for swipes)
- **Group Membership Validation**: GET `/api/groups/:id` accepts optional `memberId` query param; if provided, verifies the caller is a group member before returning data. WebSocket connections also validate memberId belongs to the group before allowing connection.
- **Crew Authorization**: All `/api/crews/:id/*` and `/api/sessions/:id/*` endpoints enforce crew membership checks via `requireCrewMembership()` and `requireSessionMembership()` helpers, preventing unauthorized access (IDOR protection). Delete operations require owner role.
- **leaderToken Security**: `leaderToken` is stripped from all REST API responses (except the initial create response to the host) and from WebSocket sync broadcasts. API response logging recursively redacts `leaderToken` fields.
- **Session Identity Binding**: Anonymous party members are bound to their browser session via express-session. `bindMemberToSession()` stores `memberBindings[groupId] = memberId` in the session on create/join. All action endpoints (swipe, done-swiping, nudge, reaction, remove-member, start-session, preferences, push-subscribe) verify via `verifyMemberIdentity()` that the caller's session matches the claimed memberId, preventing impersonation attacks.
- **CSRF Protection**: Double-submit cookie pattern via `server/csrf.ts`. Server sets `csrf-token` cookie (JS-readable, SameSite=Strict), client sends back as `X-CSRF-Token` header. Auth routes exempted.
- **Keyboard Swiping**: Arrow keys (Left=dislike, Right=like, Up=super-like) for desktop swiping with visible keyboard hints below swipe buttons (hidden on mobile)

### Testing
- **Framework**: Vitest with config at `vitest.config.ts` (separate from Vite's client config)
- **Run**: `npx vitest run --config vitest.config.ts`
- **Coverage**: 40 unit tests covering match algorithm, CSRF logic, leader token expiration, analytics coordinate truncation

### Build Process
- **Development**: Vite dev server with HMR, Express backend via tsx
- **Production**: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Build Script**: Custom build script in `script/build.ts` handles both client and server bundling

## External Dependencies

### Database
- PostgreSQL database (connection via DATABASE_URL environment variable)
- Drizzle ORM for database operations
- connect-pg-simple for session storage

### UI Framework
- Radix UI primitives (comprehensive set: dialogs, menus, forms, etc.)
- Tailwind CSS for styling
- Framer Motion for animations
- Lucide React for icons

### Development Tools
- Replit-specific Vite plugins for development (cartographer, dev-banner, runtime-error-modal)
- TypeScript with strict mode
- ESBuild for production server bundling