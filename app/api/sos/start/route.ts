import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";

const Body = z.object({ flow: z.enum(["panic", "intrusive", "overwhelm", "unsure", "checkin", "talk"]).default("unsure"), checkinId: z.string().uuid().optional(), where: z.enum(["at home", "at work or school", "out in public", "in bed"]).optional() });

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const device = await ensureDevice();
  const [s] = await q<{ id: string }>("INSERT INTO sessions(device_id, flow, state, ctx) VALUES ($1,$2,'start',$3) RETURNING id", [device, p.data.flow, JSON.stringify({ ...(p.data.checkinId ? { checkinId: p.data.checkinId } : {}), ...(p.data.where ? { where: p.data.where } : {}) })]);
  return NextResponse.json({ id: s.id, flow: p.data.flow });
}
