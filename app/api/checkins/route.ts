import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";
import { getExercise } from "@/lib/exercises";

const Body = z.object({ sessionId: z.string().uuid().optional(), hour: z.number().int().min(0).max(23).optional(), inHours: z.number().min(0).max(72).optional() });
const bucket = (h: number) => (h < 5 ? "late nights" : h < 12 ? "mornings" : h < 17 ? "afternoons" : h < 21 ? "evenings" : "nights");

// Called only after she says yes to "check in tomorrow?". Saves the check-in and (with the same consent) what helped.
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const device = await ensureDevice();
  const prefers: Record<string, string> = {};
  if (p.data.sessionId) {
    const [s] = await q<{ helpful_exercise_ids: string[]; ctx: any }>("SELECT helpful_exercise_ids, ctx FROM sessions WHERE id=$1 AND device_id=$2", [p.data.sessionId, device]);
    const fav = s?.helpful_exercise_ids?.[0] ?? s?.ctx?.tried?.[0];
    if (fav) { try { getExercise(fav); prefers.favorite_exercise = fav; } catch {} }
  }
  if (p.data.hour != null) prefers.hard_times = bucket(p.data.hour);
  await q(
    `INSERT INTO preferences(device_id, prefers, checkins_opt_in) VALUES ($1,$2,true)
     ON CONFLICT (device_id) DO UPDATE SET prefers=preferences.prefers || $2::jsonb, checkins_opt_in=true, updated_at=now()`,
    [device, JSON.stringify(prefers)]);
  await q("DELETE FROM checkins WHERE device_id=$1 AND done_at IS NULL", [device]);
  const [c] = await q<{ id: string; due_at: string }>("INSERT INTO checkins(device_id, due_at) VALUES ($1, now() + ($2 || ' hours')::interval) RETURNING id, due_at", [device, String(p.data.inHours ?? 20)]);
  return NextResponse.json(c);
}

// Turn check-ins off and forget the pending one.
export async function DELETE() {
  const device = await ensureDevice();
  await q("DELETE FROM checkins WHERE device_id=$1 AND done_at IS NULL", [device]);
  await q("UPDATE preferences SET checkins_opt_in=false, updated_at=now() WHERE device_id=$1", [device]);
  return NextResponse.json({ ok: true });
}
