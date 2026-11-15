import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { ensureDevice, setEntered } from "@/lib/device";
import { hashPassword, normHandle, validHandle } from "@/lib/auth";

const Body = z.object({ handle: z.string().max(40), password: z.string().min(8).max(100), displayName: z.string().max(40).optional() });

// Creates an account for THIS browser's data. Anything already here (diary, history) becomes the account's.
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Use a username and a password of at least 8 characters." }, { status: 400 });
  const handle = normHandle(p.data.handle);
  if (!validHandle(handle)) return NextResponse.json({ error: "Usernames are 3 to 24 letters, numbers or underscores." }, { status: 400 });
  const device = await ensureDevice();
  const [mine] = await q("SELECT 1 FROM accounts WHERE device_id=$1", [device]);
  if (mine) return NextResponse.json({ error: "This browser already has an account. Log out first." }, { status: 409 });
  const { salt, hash } = hashPassword(p.data.password);
  try {
    await q("INSERT INTO accounts(handle, password_hash, salt, device_id) VALUES ($1,$2,$3,$4)", [handle, hash, salt, device]);
  } catch { return NextResponse.json({ error: "That username is taken." }, { status: 409 }); }
  if (p.data.displayName) await q("INSERT INTO profiles(device_id, display_name) VALUES ($1,$2) ON CONFLICT (device_id) DO UPDATE SET display_name=$2", [device, p.data.displayName.trim()]);
  await setEntered("account");
  return NextResponse.json({ ok: true, handle });
}
