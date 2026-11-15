import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";

// Demo helper: makes a check-in due right now (local dev only) so judges can see the check-in card immediately.
export async function POST() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "disabled" }, { status: 404 });
  const device = await ensureDevice();
  await q("INSERT INTO preferences(device_id, checkins_opt_in) VALUES ($1,true) ON CONFLICT (device_id) DO UPDATE SET checkins_opt_in=true", [device]);
  await q("DELETE FROM checkins WHERE device_id=$1 AND done_at IS NULL", [device]);
  await q("INSERT INTO checkins(device_id, due_at) VALUES ($1, now() - interval '1 minute')", [device]);
  return NextResponse.json({ ok: true });
}
