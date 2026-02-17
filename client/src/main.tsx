import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { isNative } from "./lib/platform";
import "./index.css";

// Handle GitHub Pages SPA redirect (404.html redirects here with ?redirect=path)
const redirectParam = new URLSearchParams(window.location.search).get("redirect");
if (redirectParam) {
  window.history.replaceState(null, "", redirectParam);
}

// Only register service worker on web (native handles push/caching natively)
if (!isNative() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
