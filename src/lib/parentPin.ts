import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// The parent PIN that locks Parent view (a child shares the family login, so the login alone can't tell them apart).
// Entering it gives a signed cookie that lasts an hour. hashPin/checkPin are ready for per-family PINs later.

export const PIN_LENGTH = 4;
export const UNLOCK_MINUTES = 60;

export const validPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("base64url");
  return `${salt}:${scryptSync(pin, salt, 32).toString("base64url")}`;
}

export function checkPin(pin: string, stored: string | null | undefined) {
  const [salt, hash] = (stored ?? "").split(":");
  if (!salt || !hash || !validPin(pin)) return false;
  const want = Buffer.from(hash, "base64url");
  const got = scryptSync(pin, salt, 32);
  return want.length === got.length && timingSafeEqual(want, got);
}

// A small signed token: { uid, kind, exp } with an HMAC, for the unlock cookie and the "forgot PIN" link.
type Token = { uid: string; kind: "unlock" | "reset"; exp: number };
const mac = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signToken(t: Omit<Token, "exp">, minutes: number, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...t, exp: now + minutes * 60_000 })).toString("base64url");
  return `${payload}.${mac(payload, secret)}`;
}

export function readToken(value: string | undefined, kind: Token["kind"], uid: string, secret: string, now = Date.now()) {
  const [payload, sig] = (value ?? "").split(".");
  if (!payload || !sig) return false;
  const want = Buffer.from(mac(payload, secret));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try {
    const t = JSON.parse(Buffer.from(payload, "base64url").toString()) as Token;
    return t.kind === kind && t.uid === uid && t.exp > now;
  } catch {
    return false;
  }
}
