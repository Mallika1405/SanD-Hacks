import { cookies } from "next/headers";
import { q } from "./db";

const COOKIE = "sw_device";

/** Anonymous device id (no accounts). Creates a device row + cookie on first use. Route handlers only. */
export async function ensureDevice(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) {
    const r = await q("UPDATE devices SET last_seen_at=now() WHERE id=$1 RETURNING id", [existing]);
    if (r.length) return existing;
  }
  const [d] = await q<{ id: string }>("INSERT INTO devices DEFAULT VALUES RETURNING id");
  jar.set(COOKIE, d.id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return d.id;
}

export async function currentDevice(): Promise<string | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/.test(v) ? v : null;
}

/** Signing in points this browser at the account's device id, so all of its data follows the account. */
export async function setDeviceCookie(id: string) {
  (await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
}
export async function clearDeviceCookie() { (await cookies()).delete(COOKIE); }
