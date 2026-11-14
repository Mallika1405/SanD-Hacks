import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";

const Body = z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional(), speed: z.number().nullish() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad" }, { status: 400 });
  // only records during an active session
  const r = await q(
    `INSERT INTO location_points(session_id, geom, accuracy, speed)
     SELECT $1, ST_SetSRID(ST_MakePoint($3,$2),4326)::geography, $4, $5 WHERE EXISTS (SELECT 1 FROM sessions WHERE id=$1 AND status='active') RETURNING id`,
    [id, p.data.lat, p.data.lng, p.data.accuracy ?? null, p.data.speed ?? null]);
  return NextResponse.json({ ok: r.length > 0 });
}
