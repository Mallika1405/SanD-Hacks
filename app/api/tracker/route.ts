import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { currentDevice, ensureDevice } from "@/lib/device";

const KINDS = ["ocd_urge", "panic_episode", "daily"] as const;
const Schemas = {
  ocd_urge: z.object({ trigger: z.string().max(60), urge: z.string().max(60), response: z.enum(["did", "delayed", "resisted"]), delay_min: z.number().min(0).max(240).optional(), before: z.number().min(0).max(10).optional(), after: z.number().min(0).max(10).optional(), note: z.string().max(240).optional() }),
  panic_episode: z.object({ intensity: z.number().min(0).max(10), minutes: z.number().min(0).max(240), trigger: z.string().max(60).optional(), helped: z.array(z.string().max(40)).max(6).default([]), where: z.string().max(40).optional() }),
  daily: z.object({ mood: z.number().min(1).max(5), anxiety: z.number().min(0).max(10), sleep: z.string().max(20).optional(), helped: z.array(z.string().max(40)).max(6).default([]) }),
};
const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
const top = (a: (string | undefined)[], n = 3) => { const m = new Map<string, number>(); a.filter(Boolean).forEach((x) => m.set(x!, (m.get(x!) ?? 0) + 1)); return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => ({ name: k, n: v })); };

function insights(kind: string, rows: any[]) {
  const d = rows.map((r) => r.data); // newest first
  if (kind === "ocd_urge") {
    const did = d.filter((x) => x.response === "did").length, delayed = d.filter((x) => x.response === "delayed").length, resisted = d.filter((x) => x.response === "resisted").length;
    const rate = (a: any[]) => (a.length ? Math.round((a.filter((x) => x.response !== "did").length / a.length) * 100) : null);
    const last = d.slice(0, 7), prev = d.slice(7, 14);
    const delays = d.filter((x) => x.response === "delayed" && x.delay_min != null).map((x) => x.delay_min as number);
    return { total: d.length, did, delayed, resisted, avgDelay: avg(delays), rateLast: rate(last), ratePrev: prev.length ? rate(prev) : null, relief: avg(d.filter((x) => x.before != null && x.after != null).map((x) => x.before - x.after)), triggers: top(d.map((x) => x.trigger)), urges: top(d.map((x) => x.urge)), delayTrend: [...d].reverse().map((x) => x.response === "delayed" ? x.delay_min ?? 0 : x.response === "resisted" ? 30 : 0) };
  }
  if (kind === "panic_episode") {
    const week = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 864e5).length;
    return { total: d.length, thisWeek: week, avgIntensity: avg(d.map((x) => x.intensity)), avgMinutes: avg(d.map((x) => x.minutes)), helped: top(d.flatMap((x) => x.helped ?? [])), triggers: top(d.map((x) => x.trigger)), minutesTrend: [...d].reverse().map((x) => x.minutes) };
  }
  return { total: d.length, avgMood: avg(d.slice(0, 7).map((x) => x.mood)), avgAnxiety: avg(d.slice(0, 7).map((x) => x.anxiety)), helped: top(d.flatMap((x) => x.helped ?? [])), anxietyTrend: [...d].reverse().map((x) => x.anxiety) };
}

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  if (!(KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const device = await currentDevice();
  if (!device) return NextResponse.json({ logs: [], insights: insights(kind, []) });
  const rows = await q<any>("SELECT id, data, created_at FROM tracker_logs WHERE device_id=$1 AND kind=$2 ORDER BY created_at DESC LIMIT 80", [device, kind]);
  return NextResponse.json({ logs: rows, insights: insights(kind, rows) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const p = Schemas[kind].safeParse(body.data);
  if (!p.success) return NextResponse.json({ error: "Please fill in the required parts." }, { status: 400 });
  const device = await ensureDevice();
  const [r] = await q<{ id: string }>("INSERT INTO tracker_logs(device_id, kind, data) VALUES ($1,$2,$3) RETURNING id", [device, kind, JSON.stringify(p.data)]);
  return NextResponse.json({ id: r.id });
}

export async function DELETE(req: Request) {
  const device = await currentDevice(); const id = new URL(req.url).searchParams.get("id") ?? "";
  if (device && /^[0-9a-f-]{36}$/.test(id)) await q("DELETE FROM tracker_logs WHERE id=$1 AND device_id=$2", [id, device]);
  return NextResponse.json({ ok: true });
}
