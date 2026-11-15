import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { currentDevice, ensureDevice } from "@/lib/device";

const STEP: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 30 };

export async function GET() {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ plan: null, homework: [], sessions: [], adherence: null });
  const [plan] = await q<any>("SELECT therapist_name, modality, frequency, next_at, notes FROM therapy_plans WHERE device_id=$1", [device]);
  const homework = await q<any>("SELECT id, title, detail, due_on, done_at, created_at FROM therapy_homework WHERE device_id=$1 ORDER BY done_at NULLS FIRST, due_on NULLS LAST, created_at DESC LIMIT 30", [device]);
  const sessions = await q<any>("SELECT id, held_at, attended, notes FROM therapy_sessions WHERE device_id=$1 ORDER BY held_at DESC LIMIT 12", [device]);
  const last8 = sessions.slice(0, 8);
  const adherence = last8.length ? { attended: last8.filter((s) => s.attended).length, total: last8.length, lastMissed: sessions[0] ? !sessions[0].attended : false } : null;
  return NextResponse.json({ plan: plan ?? null, homework, sessions, adherence });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), therapist_name: z.string().max(80).optional(), modality: z.string().max(60).optional(), frequency: z.enum(["weekly", "biweekly", "monthly"]).default("weekly"), next_at: z.string().datetime().nullable().optional(), notes: z.string().max(400).optional() }),
  z.object({ action: z.literal("plan_delete") }),
  z.object({ action: z.literal("homework_add"), title: z.string().min(1).max(120), detail: z.string().max(300).optional(), due_on: z.string().max(10).nullable().optional() }),
  z.object({ action: z.literal("homework_toggle"), id: z.string().uuid(), done: z.boolean() }),
  z.object({ action: z.literal("homework_delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("session_log"), attended: z.boolean(), held_at: z.string().datetime().optional(), notes: z.string().max(500).optional() }),
]);

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const d = p.data, device = await ensureDevice();
  if (d.action === "plan") {
    await q(`INSERT INTO therapy_plans(device_id, therapist_name, modality, frequency, next_at, notes) VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (device_id) DO UPDATE SET therapist_name=$2, modality=$3, frequency=$4, next_at=$5, notes=$6, updated_at=now()`,
      [device, d.therapist_name ?? null, d.modality ?? null, d.frequency, d.next_at ?? null, d.notes ?? null]);
  } else if (d.action === "plan_delete") {
    await q("DELETE FROM therapy_plans WHERE device_id=$1", [device]);
  } else if (d.action === "homework_add") {
    await q("INSERT INTO therapy_homework(device_id, title, detail, due_on) VALUES ($1,$2,$3,$4)", [device, d.title, d.detail ?? null, d.due_on || null]);
  } else if (d.action === "homework_toggle") {
    await q("UPDATE therapy_homework SET done_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1 AND device_id=$2", [d.id, device, d.done]);
  } else if (d.action === "homework_delete") {
    await q("DELETE FROM therapy_homework WHERE id=$1 AND device_id=$2", [d.id, device]);
  } else {
    await q("INSERT INTO therapy_sessions(device_id, held_at, attended, notes) VALUES ($1, COALESCE($2::timestamptz, now()), $3, $4)", [device, d.held_at ?? null, d.attended, d.notes ?? null]);
    // roll the next appointment forward by her chosen rhythm, to the next future slot
    const [pl] = await q<any>("SELECT frequency, next_at FROM therapy_plans WHERE device_id=$1", [device]);
    if (pl?.next_at && new Date(pl.next_at).getTime() < Date.now()) {
      const step = (STEP[pl.frequency] ?? 7) * 864e5, next = new Date(pl.next_at).getTime();
      const n = Math.ceil((Date.now() - next) / step);
      await q("UPDATE therapy_plans SET next_at=$2 WHERE device_id=$1", [device, new Date(next + Math.max(1, n) * step).toISOString()]);
    }
  }
  return NextResponse.json({ ok: true });
}
