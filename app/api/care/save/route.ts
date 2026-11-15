import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";

const Body = z.object({ providerIds: z.array(z.string().uuid()).max(20).default([]), groupIds: z.array(z.string().uuid()).max(20).default([]) });

// Only runs when she taps "Save this list": nothing about care searches is stored otherwise.
export async function POST(req: Request) {
  const device = await currentDevice();
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!device || !p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  for (const id of p.data.providerIds) await q("INSERT INTO provider_matches(device_id, provider_id, reason) VALUES ($1,$2,'saved by user')", [device, id]);
  for (const id of p.data.groupIds) await q("INSERT INTO provider_matches(device_id, group_id, reason) VALUES ($1,$2,'saved by user')", [device, id]);
  return NextResponse.json({ ok: true });
}
