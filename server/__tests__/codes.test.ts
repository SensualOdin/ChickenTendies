import { describe, it, expect, vi, afterEach } from "vitest";
import { generateJoinCode, JOIN_CODE_ALPHABET } from "../codes";

describe("generateJoinCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates a 6-character code by default", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  it("generates a code of the requested length", () => {
    expect(generateJoinCode(4)).toHaveLength(4);
    expect(generateJoinCode(10)).toHaveLength(10);
  });

  it("only uses characters from the 32-char alphabet", () => {
    expect(JOIN_CODE_ALPHABET).toHaveLength(32);
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      for (const char of code) {
        expect(JOIN_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it("excludes ambiguous characters (I, O, 0, 1)", () => {
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it("does not use Math.random (uses CSPRNG)", () => {
    const mathRandomSpy = vi.spyOn(Math, "random");
    for (let i = 0; i < 20; i++) {
      generateJoinCode();
    }
    expect(mathRandomSpy).not.toHaveBeenCalled();
  });

  it("produces varying codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateJoinCode());
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});
