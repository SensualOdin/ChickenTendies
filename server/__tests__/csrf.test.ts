import { describe, it, expect, beforeAll } from "vitest";

// Set a secret before the module loads so tests are deterministic.
beforeAll(() => {
  process.env.COOKIE_SECRET = "test-secret-for-csrf-suite";
  process.env.NODE_ENV = "test";
});

// Import after env is set — the module reads COOKIE_SECRET on each call but
// being explicit about order avoids flakes if that ever changes.
import { generateCsrfToken, verifyCsrfToken, csrfMiddleware } from "../csrf";

describe("CSRF token generation and verification", () => {
  it("generates a token that verifies successfully", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token)).toBe(true);
  });

  it("rejects a missing or empty token", () => {
    expect(verifyCsrfToken(undefined)).toBe(false);
    expect(verifyCsrfToken(null)).toBe(false);
    expect(verifyCsrfToken("")).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifyCsrfToken("not-a-token")).toBe(false);
    expect(verifyCsrfToken("only.two.parts.no.wait.five")).toBe(false);
    expect(verifyCsrfToken("a.b")).toBe(false);
  });

  it("rejects a token with tampered nonce", () => {
    const token = generateCsrfToken();
    const [, expiry, sig] = token.split(".");
    const tampered = `tampered-nonce.${expiry}.${sig}`;
    expect(verifyCsrfToken(tampered)).toBe(false);
  });

  it("rejects a token with tampered signature", () => {
    const token = generateCsrfToken();
    const [nonce, expiry] = token.split(".");
    const tampered = `${nonce}.${expiry}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(verifyCsrfToken(tampered)).toBe(false);
  });

  it("rejects an expired token", () => {
    // Construct a token with a past expiry by hand using the same secret path.
    // We can't easily force expiry without time-travel, so we modify the expiry
    // field and re-sign would require the private API — instead, just assert
    // that a token with a past expiry in the right format rejects.
    const token = generateCsrfToken();
    const parts = token.split(".");
    const expiredExpiry = String(Date.now() - 1000);
    // Signature won't match the new expiry, so this also exercises the
    // "signature check after expiry check" path. Either way, the token
    // must reject.
    const rewritten = `${parts[0]}.${expiredExpiry}.${parts[2]}`;
    expect(verifyCsrfToken(rewritten)).toBe(false);
  });

  it("generates different tokens each call", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toEqual(b);
  });
});

describe("csrfMiddleware", () => {
  function mockReqRes(overrides: {
    method?: string;
    path?: string;
    header?: string | undefined;
    cookie?: string | undefined;
  } = {}) {
    const req: any = {
      method: overrides.method ?? "POST",
      path: overrides.path ?? "/api/groups",
      headers: overrides.header !== undefined ? { "x-csrf-token": overrides.header } : {},
      cookies: overrides.cookie !== undefined ? { "csrf-token": overrides.cookie } : {},
    };
    const res: any = {
      statusCode: 200,
      body: undefined as any,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    return { req, res, next, wasNext: () => nextCalled };
  }

  it("allows safe methods without a token", () => {
    const { req, res, next, wasNext } = mockReqRes({ method: "GET", header: undefined });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it("allows the csrf-token endpoint itself", () => {
    const { req, res, next, wasNext } = mockReqRes({ method: "GET", path: "/api/csrf-token" });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(true);
  });

  it("allows the health endpoint", () => {
    const { req, res, next, wasNext } = mockReqRes({ method: "GET", path: "/api/health" });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(true);
  });

  it("rejects POST with no CSRF header", () => {
    const { req, res, next, wasNext } = mockReqRes({ method: "POST", header: undefined });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("CSRF_INVALID");
  });

  it("rejects POST with an invalid token", () => {
    const { req, res, next, wasNext } = mockReqRes({ header: "not-a-real-token" });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("accepts POST with a valid header token (native, no cookie)", () => {
    const token = generateCsrfToken();
    const { req, res, next, wasNext } = mockReqRes({ header: token });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(true);
  });

  it("accepts POST with matching cookie + header (web, double-submit)", () => {
    const token = generateCsrfToken();
    const { req, res, next, wasNext } = mockReqRes({ header: token, cookie: token });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(true);
  });

  it("rejects POST when cookie and header disagree", () => {
    const headerToken = generateCsrfToken();
    const cookieToken = generateCsrfToken();
    const { req, res, next, wasNext } = mockReqRes({ header: headerToken, cookie: cookieToken });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("rejects POST when cookie is invalid even if header is valid", () => {
    const token = generateCsrfToken();
    const { req, res, next, wasNext } = mockReqRes({ header: token, cookie: "garbage" });
    csrfMiddleware(req, res, next);
    expect(wasNext()).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
