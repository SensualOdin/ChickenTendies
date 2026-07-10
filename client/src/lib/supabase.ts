import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud failure beats silent fallback to localhost: native builds can't reach
  // localhost:54321 and would otherwise crash on every auth call with an
  // unhelpful network error. Throwing here surfaces the missing-env at boot.
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter(Boolean).join(', ');
  throw new Error(
    `Supabase env not configured: missing ${missing}. ` +
    `Set these in .env (web) or vite build env (native).`
  );
}

// Pin to PKCE explicitly. With Capacitor we open the auth URL in a system
// browser (SFSafariViewController / Chrome Custom Tabs) and return via a
// chickentinders:// deep link with `?code=...`. PKCE is the supported flow
// for that pattern — the code_verifier is stored in THIS WebView's
// localStorage and stays put across the deep-link round trip, so the
// subsequent exchangeCodeForSession call works.
//
// detectSessionInUrl: false because App.tsx handles deep-link callbacks
// itself; otherwise the SDK would race with our handler and double-process
// the auth code.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
