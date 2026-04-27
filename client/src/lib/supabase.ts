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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
