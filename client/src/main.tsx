import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import "./index.css";

// Handle GitHub Pages SPA redirect (404.html redirects here with ?redirect=path)
const redirectParam = new URLSearchParams(window.location.search).get("redirect");
if (redirectParam) {
  window.history.replaceState(null, "", redirectParam);
}

// No automatic service-worker registration.
//
// Previously this unconditionally registered /sw.js on every web visit. That
// SW cached JS/CSS bundles by URL with no versioning, so when the Vite build
// hash changed users on chickentinders.app occasionally served a cached
// index.html pointing to a JS bundle URL that no longer existed on the
// server — producing a blank page.
//
// The SW is now registered on demand by use-push-notifications.ts only when a
// user opts in to push notifications. The current /sw.js is a passthrough
// (no fetch interception, clears every old cache on activate), so even
// opted-in users can't hit the stale-bundle bug. Any browser that still has
// the legacy SW registered will fetch the new /sw.js on its next visit,
// install it, activate it (wiping stale caches), and take over automatically.

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
