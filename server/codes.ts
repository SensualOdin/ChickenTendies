import { randomInt } from "crypto";

// 32-char alphabet excluding ambiguous characters (I, O, 0, 1)
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a join/invite code using a CSPRNG (crypto.randomInt)
 * instead of Math.random, which is predictable.
 */
export function generateJoinCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
