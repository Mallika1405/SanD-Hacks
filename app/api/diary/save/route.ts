import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";

const Body = z.object({
  title: z.string().min(1).max(80), summary: z.string().min(1).max(900), heard: z.string().max(600).default(""),
  feelings: z.array(z.string().max(30)).max(6).default([]), themes: z.array(z.string().max(30)).max(6).default([]),
  intensity: z.number().int().min(1).max(10).nullable().default(null), quote: z.string().max(200).default(""),
  risk: z.enum(["none", "watch", "concerning", "urgent"]).default("none"), risk_note: z.string().max(400).nullable().default(null),
  transcript: z.string().max(20000).nullable().default(null), duration_s: z.number().int().min(0).max(7200).default(0),
});

// Only runs when she taps "Save to my diary". The full transcript is stored only if she turned that on.
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const d = p.data, device = await ensureDevice();
  const [row] = await q<{ id: string }>(
    "INSERT INTO diary_entries(device_id,title,summary,heard,feelings,themes,intensity,quote,transcript,duration_s,risk,risk_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
    [device, d.title, d.summary, d.heard, d.feelings, d.themes, d.intensity, d.quote || null, d.transcript, d.duration_s, d.risk, d.risk_note]);
  return NextResponse.json({ id: row.id });
}
