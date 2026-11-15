import crypto from "crypto";

export const normHandle = (h: string) => h.trim().toLowerCase();
export const validHandle = (h: string) => /^[a-z0-9_]{3,24}$/.test(h);
export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}
export function checkPassword(password: string, salt: string, hash: string) {
  const h = crypto.scryptSync(password, salt, 64);
  const want = Buffer.from(hash, "hex");
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}
