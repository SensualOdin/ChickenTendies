import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";

export const CSRF_COOKIE = "csrf-token";
export const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PATHS = new Set(["/api/callback", "/api/login", "/api/logout"]);

export function shouldEnforceCsrf(method: string, path: string): boolean {
  if (SAFE_METHODS.has(method)) return false;
  if (!path.startsWith("/api/")) return false;
  if (EXEMPT_PATHS.has(path)) return false;
  return true;
}

export function validateCsrfTokens(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (!headerToken || !cookieToken) return false;
  return headerToken === cookieToken;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
  }

  if (!shouldEnforceCsrf(req.method, req.path)) {
    return next();
  }

  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  if (!validateCsrfTokens(token, headerToken)) {
    return res.status(403).json({ error: "CSRF token missing or invalid" });
  }

  next();
}
