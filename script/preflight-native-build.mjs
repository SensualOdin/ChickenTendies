#!/usr/bin/env node
// Fails fast before a native build if VITE_* keys Vite would silently
// inline as `undefined` are missing. Without this guard, the build "succeeds"
// and ships an APK/AAB/IPA that blanks at startup because Supabase can't
// initialize. See blank-screen incident on v1.0.10 build 12.
import { existsSync, readFileSync } from "node:fs";

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_API_URL",
];

// Vite reads .env automatically at build time, so we check there too — the
// shell may not have these exported even when .env is present.
const fromEnvFile = {};
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) fromEnvFile[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const missing = required.filter(
  (k) => !process.env[k] && !fromEnvFile[k],
);

if (missing.length) {
  console.error("\n✗ Native build aborted — missing required env vars:");
  for (const k of missing) console.error(`    ${k}`);
  console.error(
    "\nVite would inline these as `undefined`, the bundle would build clean,",
  );
  console.error(
    "and the app would crash at startup with a blank screen. Fix by either:",
  );
  console.error("  • placing a populated .env in the current directory, or");
  console.error("  • exporting the vars in the shell before re-running.\n");
  if (!existsSync(".env")) {
    console.error("Hint: no .env found in cwd. If you're in a git worktree,");
    console.error("copy it from the main checkout: cp ../../../../.env .\n");
  }
  process.exit(1);
}
