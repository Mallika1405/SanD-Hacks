import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { setDeviceCookie, setEntered } from "@/lib/device";
import { checkPassword, normHandle } from "@/lib/auth";

const Body = z.object({ handle: z.string().max(40), password: z.string().max(100) });
const fails = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  const handle = normHandle(p.data.handle);
  const f = fails.get(handle);
  if (f && f.n >= 6 && Date.now() - f.t < 10 * 60_000) return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  const [a] = await q<any>("SELECT password_hash, salt, device_id FROM accounts WHERE handle=$1", [handle]);
  if (!a || !checkPassword(p.data.password, a.salt, a.password_hash)) {
    fails.set(handle, { n: (f?.n ?? 0) + 1, t: Date.now() });
    return NextResponse.json({ error: "That username and password don't match." }, { status: 401 });
  }
  fails.delete(handle);
  await setDeviceCookie(a.device_id); await setEntered("account");
  return NextResponse.json({ ok: true, handle });
}
