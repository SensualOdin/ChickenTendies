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
- **In-Memory Storage**: Current implementation uses in-memory storage (see `server/storage.ts`) with restaurant caching
- **Yelp Integration**: Real restaurant data fetched from Yelp Fusion API (see `server/yelp.ts`), with fallback to mock data
- **WebSocket Sync**: Real-time updates broadcast group state changes to all connected members

### Key Features (Recent)
- **Live Reactions**: Real-time emoji reactions during swiping visible to the whole group (WebSocket-powered)
- **Final Vote Mode**: When indecisive, users can trigger a "Final Vote" with their liked restaurants and a countdown timer
- **Smart Exclusions**: "Been here before" badges show on swipe cards for previously visited restaurants
- **Session Lifecycle**: Sessions auto-complete when users take action on matches (directions, DoorDash, "We went here", reserve). Starting a new session also auto-completes any previous active session. Dashboard shows "New Session" + conditional "Join Session" buttons with settings cog for crew management.
- **Visit Tracking**: "We Went Here" logging in dining sessions to track actual restaurant visits
- **Reservation Integration**: Direct links to Yelp reservation pages from match cards
- **Mobile-First PWA**: Full Progressive Web App with viewport-fit=cover, safe area insets for notched phones (iPhone Dynamic Island), responsive text/spacing with sm: breakpoints, 100dvh swipe page, 2-column mobile dashboard grid, hidden decorative elements on small screens
- **Analytics Intent Engine**: Every swipe action (left/right/super-like) is logged to `analytics_events` table with full context (cuisine, price, location, time). Frontend `useAnalytics` hook batches events for efficiency. Dashboard at `/analytics` shows top cuisines, price preferences, hourly/daily activity, top restaurants, and demand lookups via recharts. API endpoints: `GET /api/analytics/summary`, `GET /api/analytics/demand?cuisine=X`, `GET /api/analytics/restaurant/:id`, `POST /api/analytics/events`

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