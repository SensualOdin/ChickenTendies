# ChickenTinders — Migration Plan: Replit → Self-Hosted

Last updated: February 15, 2026

## Overview

This document outlines the full migration of ChickenTinders off Replit to a self-hosted stack using **Supabase** (database + auth) and **GitHub Pages** (PWA frontend). The Express backend with WebSocket support needs a separate host since GitHub Pages is static-only.

### Target Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CURRENT (Replit)                          │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Single Replit container                                  │    │
│  │  Express server (API + WebSocket + static files)          │    │
│  │  PostgreSQL 16 (Replit-managed)                           │    │
│  │  Replit OpenID Connect auth                               │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘

                              ↓  migrates to  ↓

┌──────────────────────────────────────────────────────────────────┐
│                        TARGET (Self-hosted)                      │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐   │
│  │  GitHub Pages    │  │  Railway/Fly.io   │  │  Supabase     │   │
│  │  (Static PWA)   │  │  (Express + WS)   │  │  (DB + Auth)  │   │
│  │                  │  │                   │  │               │   │
│  │  - React SPA    │→ │  - REST API       │→ │  - PostgreSQL │   │
│  │  - Vite build   │  │  - WebSocket      │  │  - Auth       │   │
│  │  - Service worker│  │  - Cron jobs      │  │  - Row-Level  │   │
│  │  - PWA manifest │  │  - Push notifs    │  │    Security   │   │
│  └─────────────────┘  └──────────────────┘  └───────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Why This Stack

| Concern | Choice | Reasoning |
|---------|--------|-----------|
| **Frontend hosting** | GitHub Pages | Free, fast CDN, custom domain support, perfect for static PWA |
| **Database** | Supabase PostgreSQL | Free tier (500MB, 50k MAU auth), managed Postgres, direct connection string works with existing Drizzle ORM |
| **Authentication** | Supabase Auth | Replaces Replit OIDC. Supports Google, GitHub, email/password, magic links. Free tier is generous |
| **Backend hosting** | Railway or Fly.io | Express + WebSocket requires a long-running process. GitHub Pages can't do this. Railway free tier = $5/mo credit. Fly.io free tier = 3 shared VMs |
| **Real-time** | Keep existing WebSocket | Supabase Realtime exists but rewriting the WS sync layer is high-risk for low reward right now |

---

## Phase 1: Supabase Setup & Database Migration

**Goal**: Stand up Supabase project, migrate PostgreSQL schema, verify data layer works.

### 1.1 Create Supabase Project

- [ ] Create account at [supabase.com](https://supabase.com)
- [ ] Create new project (pick region closest to target users)
- [ ] Note the connection credentials:
  - `SUPABASE_URL` (project URL)
  - `SUPABASE_ANON_KEY` (public anon key for client)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose to client)
  - `DATABASE_URL` (direct Postgres connection string for Drizzle)

### 1.2 Migrate Database Schema

The existing Drizzle ORM schema (`shared/models/auth.ts` + `shared/models/social.ts`) should work directly against Supabase PostgreSQL with minimal changes.

- [ ] Point `DATABASE_URL` to Supabase and run `npm run db:push` (Drizzle Kit will create all tables)
- [ ] Verify all tables created:
  - `users`, `sessions` (auth)
  - `friendships`, `persistent_groups`, `dining_sessions`, `session_swipes`, `session_matches` (social)
  - `notifications`, `push_subscriptions`, `group_push_subscriptions` (notifications)
  - `dining_history`, `user_achievements` (engagement)
  - `analytics_events`, `lifecycle_events` (analytics)
  - `anonymous_groups`, `anonymous_group_swipes`, `restaurant_cache` (anonymous parties)
  - `google_places_cache` (API cache)
- [ ] Verify indexes were created (analytics, lifecycle, anonymous swipes, google cache)

### 1.3 Update `server/db.ts`

No code changes needed — it already reads `DATABASE_URL` from env and uses `postgres` + `drizzle-orm`. Just swap the env var to point at Supabase.

```ts
// server/db.ts — NO CHANGES NEEDED
// Just set DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 1.4 Data Migration (if keeping existing data)

If you need to carry over existing Replit data:

- [ ] Export from Replit PostgreSQL: `pg_dump --no-owner --no-privileges -Fc $OLD_DATABASE_URL > chickentinders.dump`
- [ ] Import to Supabase: `pg_restore --no-owner --no-privileges -d $NEW_DATABASE_URL chickentinders.dump`
- [ ] Verify row counts match across all tables

---

## Phase 2: Authentication — Replit OIDC → Supabase Auth

**Goal**: Replace Replit OpenID Connect with Supabase Auth. This is the biggest single change.

### 2.1 What's Being Replaced

These files are Replit-specific and will be **deleted or completely rewritten**:

| File | Current Purpose | Action |
|------|----------------|--------|
| `server/replit_integrations/auth/replitAuth.ts` | Replit OIDC strategy, Passport.js, session setup | **Delete** |
| `server/replit_integrations/auth/routes.ts` | `/api/login`, `/api/callback`, `/api/logout`, `/api/auth/user` | **Rewrite** |
| `server/replit_integrations/auth/storage.ts` | User upsert tied to Replit claims | **Rewrite** |
| `server/replit_integrations/auth/index.ts` | Re-exports | **Rewrite** |
| `client/src/pages/login.tsx` | Branded Replit login gateway | **Rewrite** |
| `client/src/hooks/use-auth.ts` | Auth hook (calls `/api/auth/user`) | **Rewrite** |

### 2.2 Supabase Auth Setup

- [ ] Enable auth providers in Supabase Dashboard → Authentication → Providers:
  - **Email/Password** (default, enable immediately)
  - **Google OAuth** (create OAuth app at console.cloud.google.com, set redirect URI to `https://<supabase-project>.supabase.co/auth/v1/callback`)
  - **GitHub OAuth** (optional, create at github.com/settings/applications)
  - **Magic Links** (email-based, low friction — good for anonymous→registered conversion)
- [ ] Configure Supabase Auth settings:
  - Site URL: `https://chickentinders.app` (or your GitHub Pages domain)
  - Redirect URLs: add your domain(s)
  - JWT expiry: 3600 seconds (1 hour)
  - Enable refresh tokens

### 2.3 Install Supabase Client Libraries

```bash
# Client-side (React)
npm install @supabase/supabase-js

# Server-side (Express) — same package, different usage
# @supabase/supabase-js works server-side too with the service role key
```

### 2.4 Remove Replit Dependencies

```bash
npm uninstall openid-client passport passport-local connect-pg-simple memoizee
npm uninstall @types/passport @types/passport-local @types/connect-pg-simple @types/memoizee
```

Also remove `express-session` and `memorystore` — Supabase Auth uses JWTs, not server-side sessions.

### 2.5 New Auth Architecture

**Before (Replit):**
```
Client → /api/login → Replit OIDC → /api/callback → express-session cookie → Passport.js middleware
```

**After (Supabase):**
```
Client → Supabase Auth UI/SDK (client-side) → JWT in Authorization header → Server validates JWT
```

Key difference: Auth happens **client-side** via Supabase JS SDK. The server **validates** the JWT on protected routes instead of managing sessions.

### 2.6 New Client-Side Auth

Create `client/src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Rewrite `client/src/hooks/use-auth.ts`:
```ts
// Replace the current Replit-based useAuth with Supabase auth
// - supabase.auth.getSession() for current session
// - supabase.auth.onAuthStateChange() for reactive auth state
// - supabase.auth.signInWithOAuth({ provider: 'google' }) for login
// - supabase.auth.signOut() for logout
// - Access token from session.access_token for API calls
```

Rewrite `client/src/pages/login.tsx`:
```
- Remove Replit branding
- Add Google Sign-In button (supabase.auth.signInWithOAuth)
- Add email/password form (supabase.auth.signInWithPassword)
- Add magic link option (supabase.auth.signInWithOtp)
- Style to match existing ChickenTinders brand
```

### 2.7 New Server-Side Auth Middleware

Replace `server/replit_integrations/auth/` with a new `server/auth/` directory:

**`server/auth/middleware.ts`** — JWT validation middleware:
```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function isAuthenticated(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  req.user = user; // user.id, user.email, user.user_metadata
  next();
}
```

**`server/auth/routes.ts`** — Simplified auth routes:
```ts
// GET /api/auth/user — return user profile from our users table
// PATCH /api/auth/profile — update display name
// POST /api/auth/sync — called after Supabase login to upsert user in our users table
```

### 2.8 User ID Migration

Replit uses `claims.sub` (Replit user ID string). Supabase uses `user.id` (UUID). The `users` table already uses `varchar` for ID, so UUIDs will work. However:

- [ ] For existing users: Run a migration script that maps old Replit IDs to new Supabase UUIDs
- [ ] For new installs (no existing users): No migration needed, start fresh
- [ ] Update all `req.user.claims.sub` references to `req.user.id` across:
  - `server/routes.ts` (multiple places)
  - `server/social-routes.ts` (heavily used)
  - `server/replit_integrations/auth/routes.ts` → `server/auth/routes.ts`

### 2.9 Update Auth References Across Codebase

Files that import from `./replit_integrations/auth`:

| File | Import | Change To |
|------|--------|-----------|
| `server/routes.ts` | `setupAuth, registerAuthRoutes, isAuthenticated` | Import from `./auth/middleware` and `./auth/routes` |
| `server/social-routes.ts` | `isAuthenticated` | Import from `./auth/middleware` |

All `req.user.claims.sub` → `req.user.id` (search for `claims.sub` — appears in routes.ts and social-routes.ts).

---

## Phase 3: Frontend — GitHub Pages Deployment

**Goal**: Host the Vite-built PWA on GitHub Pages with proper SPA routing.

### 3.1 Remove Replit Vite Plugins

Update `vite.config.ts`:

```ts
// REMOVE these imports and usages:
// - @replit/vite-plugin-runtime-error-modal
// - @replit/vite-plugin-cartographer
// - @replit/vite-plugin-dev-banner
```

```bash
npm uninstall @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-cartographer @replit/vite-plugin-dev-banner
```

Clean `vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
```

### 3.2 Configure API Base URL

The frontend needs to know where the backend lives. Currently it makes relative API calls (`/api/...`) because frontend and backend are on the same origin.

Create `client/src/lib/api.ts`:
```ts
export const API_BASE = import.meta.env.VITE_API_URL || '';

// Update all fetch() calls and React Query hooks to use:
// `${API_BASE}/api/groups/...` instead of `/api/groups/...`
```

Environment variables:
- **Development**: `VITE_API_URL=http://localhost:5000` (Express dev server)
- **Production**: `VITE_API_URL=https://api.chickentinders.app` (Railway/Fly.io URL)

### 3.3 Handle SPA Routing on GitHub Pages

GitHub Pages doesn't support server-side routing. All routes (`/dashboard`, `/group/:id/swipe`, etc.) will 404 unless handled.

**Solution**: Add a `404.html` redirect trick:

Create `client/public/404.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <script>
    // Redirect all paths to index.html with the path as a query parameter
    // GitHub Pages serves 404.html for unknown routes
    const path = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace(window.location.origin + '/?redirect=' + encodeURIComponent(path));
  </script>
</head>
</html>
```

Add redirect handler in `client/src/main.tsx` (before React mount):
```ts
// Handle GitHub Pages SPA redirect
const redirect = new URLSearchParams(window.location.search).get('redirect');
if (redirect) {
  window.history.replaceState(null, '', redirect);
}
```

### 3.4 GitHub Actions CI/CD

Create `.github/workflows/deploy-frontend.yml`:
```yaml
name: Deploy PWA to GitHub Pages
on:
  push:
    branches: [main]
    paths:
      - 'client/**'
      - 'shared/**'
      - 'vite.config.ts'
      - 'package.json'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - run: npx vite build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/public

      - uses: actions/deploy-pages@v4
```

- [ ] Enable GitHub Pages in repo Settings → Pages → Source: GitHub Actions
- [ ] Add repository secrets for the env vars above
- [ ] (Optional) Configure custom domain: `chickentinders.app` → CNAME to `<username>.github.io`

### 3.5 Update PWA Manifest

Update `client/public/manifest.json`:
- [ ] Change `start_url` to match GitHub Pages path (likely `/` if using custom domain)
- [ ] Update icons if needed
- [ ] Set `scope` appropriately

### 3.6 Update Service Worker

- [ ] Ensure the service worker caches the correct paths
- [ ] API calls should NOT be cached by the service worker (they go to a different origin now)
- [ ] Add `VITE_API_URL` to the service worker's "network-only" list

---

## Phase 4: Backend — Express on Railway or Fly.io

**Goal**: Deploy the Express + WebSocket server to a PaaS with persistent process support.

### 4.1 Choose a Host

| Platform | Free Tier | WebSocket Support | Pros | Cons |
|----------|-----------|-------------------|------|------|
| **Railway** | $5/mo credit | Yes | Easy deploy from GitHub, good DX | Credit runs out with moderate traffic |
| **Fly.io** | 3 shared VMs | Yes | Global edge, great for WebSocket | Slightly more config |
| **Render** | Free web service | Yes | Simple, good free tier | Free tier sleeps after 15min inactivity |

**Recommendation**: **Railway** for simplicity during migration, move to **Fly.io** if you need global edge or more control.

### 4.2 Remove Replit Config Files

- [ ] Delete `.replit`
- [ ] Delete `replit.md` (or rename to `ARCHITECTURE.md` if useful)
- [ ] Remove the `server/vite.ts` dev server proxy (won't be needed — frontend is separate origin)

### 4.3 Add CORS Configuration

Since frontend (GitHub Pages) and backend (Railway/Fly.io) are now different origins, add CORS:

```bash
npm install cors
npm install @types/cors --save-dev
```

Update `server/index.ts`:
```ts
import cors from 'cors';

app.use(cors({
  origin: [
    'https://chickentinders.app',         // Production (GitHub Pages)
    'http://localhost:5173',               // Vite dev server
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));
```

### 4.4 Update CSRF Protection

The current CSRF implementation uses double-submit cookies. With cross-origin requests (frontend on different domain), cookies won't work the same way.

Options:
1. **Drop CSRF, rely on JWT auth** — Since Supabase Auth uses Bearer tokens (not cookies), CSRF attacks aren't possible on authenticated endpoints. Anonymous endpoints are already rate-limited.
2. **Keep CSRF for anonymous party endpoints** — These don't use auth tokens, so they could be vulnerable. Mitigate with rate limiting (already in place) + origin checking.

**Recommendation**: Remove `server/csrf.ts` cookie-based CSRF. The JWT Bearer token pattern is inherently CSRF-safe. Keep rate limiting on anonymous endpoints.

### 4.5 Update WebSocket Connection

The client currently connects to WebSocket on the same origin (`ws://same-host/ws`). Update to use the API URL:

```ts
// client — update WebSocket connection URL
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${new URL(import.meta.env.VITE_API_URL).host}/ws`;
```

### 4.6 Environment Variables

Set these on Railway/Fly.io:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://postgres:...@db.xxx.supabase.co:5432/postgres` | Supabase direct connection |
| `SUPABASE_URL` | `https://xxx.supabase.co` | For server-side Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Server-only, never expose |
| `VAPID_PUBLIC_KEY` | (existing value) | Keep existing VAPID keys |
| `VAPID_PRIVATE_KEY` | (existing value) | Keep existing VAPID keys |
| `PORT` | `5000` (or platform default) | Railway auto-sets `PORT` |
| `NODE_ENV` | `production` | |
| `YELP_API_KEY` | (existing value) | Restaurant data |
| `GOOGLE_PLACES_API_KEY` | (existing value) | Google Places data |

### 4.7 Update Build Script

The build script (`script/build.ts`) currently builds both client and server. Split this:

- **Frontend build**: Handled by GitHub Actions (`npx vite build`)
- **Server build**: Handled by Railway/Fly.io deploy

Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "dev:client": "vite --config vite.config.ts",
    "build:client": "vite build",
    "build:server": "tsx script/build-server.ts",
    "build": "npm run build:server",
    "start": "NODE_ENV=production node dist/index.cjs",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  }
}
```

Create `script/build-server.ts` (server-only build):
```ts
// Same as current build.ts but without the viteBuild() call
// Only runs esbuild for the server bundle
```

### 4.8 Remove Static File Serving

Since the frontend is on GitHub Pages, the Express server no longer serves static files.

- [ ] Delete or disable `server/static.ts`
- [ ] Remove the static file serving code from `server/index.ts` (the `serveStatic(app)` call)
- [ ] The Vite dev server middleware in `server/vite.ts` is also no longer needed for production

### 4.9 Railway Deployment

If using Railway:

- [ ] Connect GitHub repo to Railway
- [ ] Set build command: `npm run build`
- [ ] Set start command: `npm start`
- [ ] Add all environment variables
- [ ] Railway auto-detects Node.js, provides `PORT`

Or add a `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node dist/index.cjs",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### 4.10 Add Health Check Endpoint

For Railway/Fly.io health monitoring:

```ts
// server/routes.ts — add at top
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

---

## Phase 5: Cleanup & Polish

### 5.1 Remove All Replit-Specific Code

- [ ] Delete `server/replit_integrations/` directory entirely
- [ ] Delete `.replit`
- [ ] Delete `replit.md` (or rename to `ARCHITECTURE.md`)
- [ ] Remove Replit Vite plugins from `vite.config.ts`
- [ ] Remove Replit packages from `package.json`:
  - `@replit/vite-plugin-cartographer`
  - `@replit/vite-plugin-dev-banner`
  - `@replit/vite-plugin-runtime-error-modal`
  - `openid-client`
  - `passport`, `passport-local`
  - `connect-pg-simple`
  - `memoizee`, `@types/memoizee`
  - `express-session` (if fully moving to JWT)
  - `memorystore`
- [ ] Remove `REPL_ID` and `ISSUER_URL` references from codebase
- [ ] Clean up `server/index.ts` — remove session middleware, Passport setup
- [ ] Update `server/routes.ts` imports to point to `./auth/` instead of `./replit_integrations/auth`

### 5.2 Update Docs

- [ ] Update `FEATURES.md` — remove Replit references, update login flow description
- [ ] Update `NEXT-STEPS.md` — mark infra migration as complete
- [ ] Create a proper `README.md` with setup instructions for the new stack
- [ ] Update `Money.md` — add hosting costs to the cost model:
  - GitHub Pages: **Free**
  - Supabase Free Tier: **Free** (500MB DB, 50k MAU auth, 500MB storage)
  - Railway: **~$5/mo** (or Fly.io free tier)
  - Total Phase 0 cost: **$0–5/mo** vs Replit (comparable or cheaper)

### 5.3 Local Development Setup

Update the dev workflow since frontend and backend are now decoupled:

**Option A: Run separately** (recommended):
```bash
# Terminal 1 — Backend
npm run dev
# Runs Express on http://localhost:5000

# Terminal 2 — Frontend
npm run dev:client
# Runs Vite on http://localhost:5173, proxied to backend
```

**Option B: Use Vite proxy** (simpler):
Update `vite.config.ts` to proxy `/api` and `/ws` to the local Express server:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:5000',
    '/ws': { target: 'ws://localhost:5000', ws: true },
  },
},
```

### 5.4 Environment Variable Management

Create `.env.example`:
```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Backend API (for frontend in production)
VITE_API_URL=https://api.chickentinders.app

# Push Notifications
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key

# Restaurant APIs
YELP_API_KEY=your-yelp-key
GOOGLE_PLACES_API_KEY=your-google-key

# Server
PORT=5000
NODE_ENV=development
```

---

## Phase 6: Future — PWA → Native App

**Goal**: Convert the PWA to a native mobile app for App Store/Play Store distribution.

### 6.1 Options

| Approach | Effort | Result | Pros | Cons |
|----------|--------|--------|------|------|
| **Capacitor** (Ionic) | Low | Wrap existing web app in native shell | Reuse 95% of code, quick to ship | Performance limited by WebView |
| **React Native (Expo)** | High | True native app, rewrite UI | Best performance, native feel | Full UI rewrite, ~60% code reuse (shared logic/types) |
| **PWA as-is** | None | Keep PWA, improve install flow | Already works, no app store needed | No app store visibility, limited iOS push support |

### 6.2 Recommended Path: Capacitor First, Then React Native

**Step 1 — Capacitor (weeks, not months)**:
```bash
npm install @capacitor/core @capacitor/cli
npx cap init ChickenTinders com.chickentinders.app
npx cap add ios
npx cap add android
```
- Wraps the existing Vite build in a native shell
- Gets you into App Store/Play Store quickly
- Push notifications work natively via Capacitor plugins
- Deep links work natively
- Camera, haptics, share sheet — all available as plugins
- Keep the PWA on GitHub Pages as the web version

**Step 2 — React Native (when scale demands it)**:
- Only pursue if Capacitor performance becomes a bottleneck
- Share the `shared/` directory (Zod schemas, types) between web and native
- Rewrite UI components with React Native equivalents
- The Express backend and Supabase setup stays exactly the same

### 6.3 Capacitor-Specific Changes

When you're ready to add Capacitor:

- [ ] Install Capacitor CLI and core
- [ ] Configure `capacitor.config.ts` with your API URL and app metadata
- [ ] Add iOS and Android projects
- [ ] Replace web push notifications with `@capacitor/push-notifications` (uses APNs/FCM)
- [ ] Add `@capacitor/share` for native share sheet
- [ ] Add `@capacitor/app` for deep link handling
- [ ] Set up Xcode/Android Studio for building
- [ ] Apple Developer Program ($99/yr) + Google Play Developer ($25 one-time)

---

## Migration Sequence (Recommended Order)

Execute in this order to minimize risk. Each phase is independently deployable.

| Step | Phase | Est. Effort | Risk | Rollback |
|------|-------|-------------|------|----------|
| 1 | **Phase 1**: Supabase DB setup | 1–2 hours | Low | Point `DATABASE_URL` back to Replit |
| 2 | **Phase 2**: Auth migration | 1–2 days | **High** | This is the biggest change. Test thoroughly. Keep Replit auth code until verified. |
| 3 | **Phase 3**: GitHub Pages frontend | 2–4 hours | Low | Revert to Replit serving static files |
| 4 | **Phase 4**: Railway/Fly.io backend | 2–4 hours | Medium | Keep Replit as fallback until backend is stable |
| 5 | **Phase 5**: Cleanup | 1–2 hours | Low | N/A |
| 6 | **Phase 6**: Capacitor native app | 1–2 days | Medium | PWA continues working regardless |

**Total estimated effort**: 3–5 days of focused work.

---

## Cost Comparison

| Service | Replit (Current) | Self-Hosted (Target) |
|---------|-----------------|---------------------|
| Hosting (frontend) | Included | GitHub Pages: **Free** |
| Hosting (backend) | Replit Autoscale: ~$7–20/mo | Railway: **$5/mo** / Fly.io: **Free** |
| Database | Replit PostgreSQL: Included | Supabase: **Free** (500MB) |
| Auth | Replit OIDC: Free | Supabase Auth: **Free** (50k MAU) |
| Custom domain | Replit: varies | GitHub Pages: **Free** (CNAME) |
| **Total** | **~$7–20/mo** | **$0–5/mo** |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebSocket connectivity on Railway/Fly.io | Group sync breaks | Test WS in staging first. Both platforms support WS. Fly.io is particularly good at it. |
| Auth migration breaks existing users | Users locked out | Run both auth systems in parallel during transition. Feature flag new auth. |
| CORS misconfiguration | All API calls fail | Test thoroughly in staging. Start with permissive CORS, tighten later. |
| GitHub Pages SPA routing | Deep links 404 | The `404.html` redirect trick handles this. Test all routes. |
| Supabase free tier limits | DB full or auth limit hit | 500MB is generous for Phase 0. Monitor usage. Upgrade to Pro ($25/mo) if needed. |
| Service worker caching stale API URL | Old API calls fail | Version the service worker. Add cache-busting on deploy. |

---

## Checklist Summary

### Pre-Migration
- [ ] Create Supabase project
- [ ] Set up Google OAuth credentials for Supabase Auth
- [ ] Choose backend host (Railway or Fly.io)
- [ ] Export existing Replit data (if needed)

### Migration
- [ ] Migrate database schema to Supabase (`db:push`)
- [ ] Rewrite auth layer (Replit OIDC → Supabase Auth)
- [ ] Add CORS to Express
- [ ] Update all API calls to use configurable base URL
- [ ] Remove Replit Vite plugins
- [ ] Set up GitHub Actions for frontend deploy
- [ ] Deploy backend to Railway/Fly.io
- [ ] Set up `404.html` SPA routing for GitHub Pages
- [ ] Update WebSocket connection URL
- [ ] Remove CSRF (replaced by JWT auth pattern)

### Post-Migration
- [ ] Delete `server/replit_integrations/` directory
- [ ] Delete `.replit`
- [ ] Remove all Replit npm packages
- [ ] Update documentation
- [ ] Create `.env.example`
- [ ] Verify all features work end-to-end
- [ ] Set up custom domain on GitHub Pages
- [ ] Monitor Supabase usage dashboard
- [ ] (Later) Add Capacitor for native app
