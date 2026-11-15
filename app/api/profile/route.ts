import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";

const Body = z.object({ name: z.string().max(40).optional(), conditions: z.array(z.enum(["panic", "ocd", "gad", "social", "overwhelm", "other"])).max(6).default([]) });

export async function PUT(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const device = await ensureDevice();
  await q(
    `INSERT INTO profiles(device_id, display_name, conditions, onboarded) VALUES ($1,$2,$3,true)
     ON CONFLICT (device_id) DO UPDATE SET display_name=$2, conditions=$3, onboarded=true`,
    [device, p.data.name?.trim() || null, p.data.conditions]);
  return NextResponse.json({ ok: true });
}
