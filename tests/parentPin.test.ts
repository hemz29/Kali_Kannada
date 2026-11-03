import { describe, expect, it } from "vitest";
import { checkPin, hashPin, readToken, signToken, UNLOCK_MINUTES } from "@/lib/parentPin";

const NOW = Date.parse("2026-11-03T10:00:00Z");

describe("parent PIN", () => {
  it("unlocks for an hour, for this account only, and can't be forged", () => {
    const t = signToken({ uid: "u1", kind: "unlock" }, UNLOCK_MINUTES, "secret", NOW);
    expect(readToken(t, "unlock", "u1", "secret", NOW + 59 * 60_000)).toBe(true);
    expect(readToken(t, "unlock", "u1", "secret", NOW + 61 * 60_000)).toBe(false);
    expect(readToken(t, "unlock", "u2", "secret", NOW)).toBe(false);
    expect(readToken(t, "reset", "u1", "secret", NOW)).toBe(false);
    expect(readToken(t, "unlock", "u1", "other-secret", NOW)).toBe(false);
    expect(readToken(undefined, "unlock", "u1", "secret", NOW)).toBe(false);
  });
  it("hashes PINs for when families set their own", () => {
    const h = hashPin("1111");
    expect(checkPin("1111", h)).toBe(true);
    expect(checkPin("1112", h)).toBe(false);
    expect(checkPin("abcd", h)).toBe(false);
  });
});
