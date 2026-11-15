import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { setDeviceCookie, setEntered } from "@/lib/device";
import { DEMOS, demosEnabled } from "@/lib/demo";

// Try the app as one of the demo people (full dummy data, created by `npm run seed`). Local/demo use only.
export async function POST(req: Request) {
  if (!demosEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { handle } = await req.json().catch(() => ({}));
  if (!DEMOS.some((d) => d.handle === handle)) return NextResponse.json({ error: "unknown profile" }, { status: 400 });
  const [a] = await q<{ device_id: string }>("SELECT device_id FROM accounts WHERE handle=$1", [handle]);
  if (!a) return NextResponse.json({ error: "That demo profile isn't set up yet. Run npm run seed." }, { status: 404 });
  await setDeviceCookie(a.device_id); await setEntered("demo");
  return NextResponse.json({ ok: true });
}
