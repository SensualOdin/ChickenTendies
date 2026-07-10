import type { Request, Response, NextFunction } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Stateless signed CSRF tokens (double-submit pattern).
 *
 * Token format: `<nonce>.<expiryMs>.<hmac>` where hmac = HMAC-SHA256(nonce + "." + expiryMs)
 * using COOKIE_SECRET as the key. This lets us verify tokens without a server-side
 * store, which matters because Render spins down idle instances.
 *
 * Flow:
 *  - Client calls GET /api/csrf-token → server issues a token, sets it as a
 *    non-HttpOnly cookie (web) and also returns it in the response body (native).
 *  - On mutating requests (POST/PUT/PATCH/DELETE), client sends the token back
 *    in the X-CSRF-Token header. Web can read it from the cookie; native reads
 *    it from a localStorage cache populated from the body.
 *  - Middleware verifies signature + expiry using constant-time comparison.
 *
 * Native apps (Capacitor) don't share cookies cross-origin with our API, so they
 * rely on the header-only path. The CORS allowlist already restricts which
 * origins can send this header, so header-only still provides defense in depth.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

function getSecret(): string {
  const s = process.env.COOKIE_SECRET;
  if (!s) {
    if (process.env.NODE_ENV !== "development") {
      throw new Error("COOKIE_SECRET environment variable is required for CSRF");
    }
    return "chickentinders-dev-secret-DO-NOT-USE-IN-PROD";
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString("base64url");
  const expiry = String(Date.now() + TOKEN_TTL_MS);
  const payload = `${nonce}.${expiry}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyCsrfToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expiryStr, sig] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const expected = sign(`${nonce}.${expiryStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Set the CSRF cookie on the response (for web clients). */
export function issueCsrfCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(CSRF_COOKIE_NAME, token, {
    // NOT HttpOnly — client JS must read this to echo it in the header.
    httpOnly: false,
    secure: isProd,
    // Must match the member-bindings cookie's sameSite so cross-site requests
    // from evil.com genuinely can't read or forge this value.
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

/**
 * Routes exempt from CSRF enforcement:
 *  - GET requests (safe by definition)
 *  - The token-issuing endpoint itself
 *  - Health check
 *  - WebSocket upgrade path
 *
 * Login/OAuth bootstrap endpoints are NOT exempt — by the time the client POSTs
 * there it has already fetched a CSRF token on page load.
 */
const EXEMPT_PATHS = new Set<string>([
  "/api/health",
  "/api/csrf-token",
]);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  if (EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  // Double-submit: token from header must be valid AND (when present) match
  // the cookie. Native apps don't send the cookie, so header-only is accepted
  // when origin has been validated by CORS.
  const headerToken = req.headers[CSRF_HEADER_NAME];
  const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (!verifyCsrfToken(token)) {
    res.status(403).json({ error: "Invalid or missing CSRF token", code: "CSRF_INVALID" });
    return;
  }

  // If a cookie was sent (web), double-submit: cookie must also verify and
  // match the header. This prevents an attacker who somehow planted only a
  // cookie (e.g. subdomain attack) from bypassing the header check.
  const cookieToken = (req as any).cookies?.[CSRF_COOKIE_NAME] as string | undefined;
  if (cookieToken) {
    if (!verifyCsrfToken(cookieToken)) {
      res.status(403).json({ error: "Invalid CSRF cookie", code: "CSRF_INVALID" });
      return;
    }
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(token as string);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(403).json({ error: "CSRF token mismatch", code: "CSRF_INVALID" });
      return;
    }
  }

  next();
}

export const CSRF_CONSTANTS = {
  HEADER: "X-CSRF-Token",
  COOKIE: CSRF_COOKIE_NAME,
  TTL_MS: TOKEN_TTL_MS,
};
