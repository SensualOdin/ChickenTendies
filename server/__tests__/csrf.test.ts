import { describe, it, expect } from "vitest";
import { shouldEnforceCsrf, validateCsrfTokens } from "../csrf";

describe("shouldEnforceCsrf", () => {
  it("skips GET requests", () => {
    expect(shouldEnforceCsrf("GET", "/api/groups")).toBe(false);
  });

  it("skips HEAD requests", () => {
    expect(shouldEnforceCsrf("HEAD", "/api/groups")).toBe(false);
  });

  it("skips OPTIONS requests", () => {
    expect(shouldEnforceCsrf("OPTIONS", "/api/groups")).toBe(false);
  });

  it("enforces POST to /api/*", () => {
    expect(shouldEnforceCsrf("POST", "/api/groups")).toBe(true);
  });

  it("enforces DELETE to /api/*", () => {
    expect(shouldEnforceCsrf("DELETE", "/api/groups/123")).toBe(true);
  });

  it("enforces PATCH to /api/*", () => {
    expect(shouldEnforceCsrf("PATCH", "/api/groups/123")).toBe(true);
  });

  it("enforces PUT to /api/*", () => {
    expect(shouldEnforceCsrf("PUT", "/api/groups/123")).toBe(true);
  });

  it("skips non-api paths", () => {
    expect(shouldEnforceCsrf("POST", "/some/other/path")).toBe(false);
  });

  it("exempts /api/callback", () => {
    expect(shouldEnforceCsrf("POST", "/api/callback")).toBe(false);
  });

  it("exempts /api/login", () => {
    expect(shouldEnforceCsrf("POST", "/api/login")).toBe(false);
  });

  it("exempts /api/logout", () => {
    expect(shouldEnforceCsrf("POST", "/api/logout")).toBe(false);
  });
});

describe("validateCsrfTokens", () => {
  it("returns true when tokens match", () => {
    expect(validateCsrfTokens("valid-token", "valid-token")).toBe(true);
  });

  it("returns false when tokens mismatch", () => {
    expect(validateCsrfTokens("token-a", "token-b")).toBe(false);
  });

  it("returns false when header is undefined", () => {
    expect(validateCsrfTokens("valid-token", undefined)).toBe(false);
  });

  it("returns false when cookie is undefined", () => {
    expect(validateCsrfTokens(undefined, "valid-token")).toBe(false);
  });

  it("returns false when both are undefined", () => {
    expect(validateCsrfTokens(undefined, undefined)).toBe(false);
  });
});
