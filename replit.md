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
- **In-Memory Storage**: Current implementation uses in-memory storage (see `server/storage.ts`) with mock restaurant data, designed to be replaced with database queries
- **WebSocket Sync**: Real-time updates broadcast group state changes to all connected members

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